/**
 * LLM client — pluggable completion providers for the AI rebooking pipeline.
 *
 * Providers (selected via LLM_PROVIDER env var):
 *  - "ollama"    : OllamaFreeAPI community nodes (standard Ollama HTTP API).
 *                  Rotates across nodes; retries with backoff on 429/5xx.
 *                  Nodes: OLLAMA_BASE_URLS (comma-separated), model: OLLAMA_MODEL.
 *  - "dashscope" : Alibaba Qwen via OpenAI-compatible endpoint.
 *                  Requires DASHSCOPE_API_KEY.
 *  - "mock"      : No network — throws LlmUnavailableError so the planner
 *                  falls back to deterministic plans (offline demos).
 *
 * All keys/endpoints come from environment variables — nothing hardcoded.
 */

import { execFile } from 'child_process';
import path from 'path';
import { logPipeline, withTimeout } from '@/lib/pipeline/logger';

export interface LlmCompletion {
  text: string;
  provider: string;
  model: string;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/** Default OllamaFreeAPI community nodes (public, from the repo's config). */
const DEFAULT_OLLAMA_NODES = [
  'http://108.181.196.208:11434',
  'http://172.236.213.60:11434',
];

function ollamaNodes(): string[] {
  const env = process.env.OLLAMA_BASE_URLS;
  if (env && env.trim()) {
    return env.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_OLLAMA_NODES;
}

function timeoutMs(): number {
  const v = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(v) && v > 0 ? v : 90_000; // free CPU nodes are slow
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Model resolution: free community nodes rarely host the configured model.
 * Query /api/tags once per node and pick the best text model available.
 */
const resolvedModels = new Map<string, string | null>();

/** Rank candidate models — prefer capable chat models, avoid vision-only/micro. */
function pickModel(available: string[], preferred: string): string | null {
  if (available.includes(preferred)) return preferred;
  const score = (name: string): number => {
    const n = name.toLowerCase();
    if (/deepseek|qwen|mistral|gemma|phi|llama|gpt-oss/.test(n)) {
      // larger parameter counts are smarter — extract size token
      const m = n.match(/(\d+(?:\.\d+)?)\s*b/);
      const size = m ? parseFloat(m[1]) : 3;
      return 100 + size;
    }
    if (/smollm|tiny|135m|500m/.test(n)) return 1; // micro models — last resort
    if (/llava|vision|moondream|bakllava/.test(n)) return 0; // vision-only — skip
    return 50;
  };
  const ranked = [...available].sort((a, b) => score(b) - score(a));
  return ranked.length > 0 && score(ranked[0]) > 0 ? ranked[0] : null;
}

async function resolveModel(baseUrl: string, preferred: string): Promise<string | null> {
  const key = `${baseUrl}|${preferred}`;
  if (resolvedModels.has(key)) return resolvedModels.get(key)!;
  let resolved: string | null = preferred;
  try {
    const res = await withTimeout(fetch(`${baseUrl}/api/tags`), 8000, `Ollama tags ${baseUrl}`);
    if (res.ok) {
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      const available = (json.models ?? []).map((m) => m.name);
      resolved = pickModel(available, preferred);
      if (resolved !== preferred) {
        await logPipeline('AI_RESPONSE', 'WARN',
          `Ollama node ${baseUrl} lacks '${preferred}' — using '${resolved ?? 'nothing'}' (available: ${available.join(', ') || 'none'})`);
      }
    }
  } catch {
    // keep preferred; the generate call will surface the real error
  }
  resolvedModels.set(key, resolved);
  return resolved;
}

/** Call one Ollama node's /api/generate endpoint. */
async function callOllamaNode(baseUrl: string, model: string, prompt: string): Promise<string> {
  const res = await withTimeout(
    fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    }),
    timeoutMs(),
    `Ollama node ${baseUrl}`
  );

  if (res.status === 429) {
    // Surface rate limits explicitly so the caller can back off / rotate
    throw new RateLimitError(`Ollama node ${baseUrl} rate limited (429)`);
  }
  if (!res.ok) {
    throw new Error(`Ollama node ${baseUrl} returned ${res.status}`);
  }

  const json = (await res.json()) as { response?: string };
  if (typeof json.response !== 'string') {
    throw new Error(`Ollama node ${baseUrl} returned malformed response`);
  }
  return json.response;
}

class RateLimitError extends Error {}

/** Rotate across free nodes with one retry round; 429 gets a short backoff. */
async function completeOllama(prompt: string): Promise<LlmCompletion> {
  const preferredModel = process.env.OLLAMA_MODEL || 'deepseek-r1:latest';
  const nodes = ollamaNodes();
  const errors: string[] = [];

  for (let round = 0; round < 2; round++) {
    for (const node of nodes) {
      try {
        const model = await resolveModel(node, preferredModel);
        if (!model) {
          throw new Error(`Ollama node ${node} has no usable text model`);
        }
        const text = await callOllamaNode(node, model, prompt);
        return { text, provider: 'ollama', model: `${model} @ ${node}` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        await logPipeline('AI_RESPONSE', 'WARN', `Ollama node failed: ${msg}`);
        if (err instanceof RateLimitError) {
          await sleep(1500 * (round + 1)); // back off before retry round
        }
      }
    }
  }

  throw new LlmUnavailableError(`All Ollama nodes failed: ${errors.join('; ')}`);
}

/** DashScope (Alibaba Qwen) — OpenAI-compatible chat completions. */
async function completeDashScope(prompt: string): Promise<LlmCompletion> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new LlmUnavailableError('DASHSCOPE_API_KEY is not set');
  }
  const model = process.env.DASHSCOPE_MODEL || 'qwen-plus';

  const res = await withTimeout(
    fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    }),
    timeoutMs(),
    'DashScope chat completions'
  );

  if (res.status === 429) {
    throw new LlmUnavailableError('DashScope rate limited (429)');
  }
  if (!res.ok) {
    throw new LlmUnavailableError(`DashScope returned ${res.status}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text) {
    throw new LlmUnavailableError('DashScope returned empty completion');
  }
  return { text, provider: 'dashscope', model };
}

/** g4f (gpt4free) — spawns Python script, passes prompt via stdin. */
async function completeG4f(prompt: string): Promise<LlmCompletion> {
  const scriptPath = path.resolve(process.cwd(), 'g4f_client.py');
  const pythonBin = process.env.PYTHON_BIN || 'python';

  const result = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      pythonBin,
      [scriptPath, '--stdin'],
      { timeout: timeoutMs(), maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`g4f script failed: ${stderr || err.message}`));
          return;
        }
        resolve(stdout.trim());
      },
    );
    child.stdin?.write(prompt);
    child.stdin?.end();
  });

  const parsed = JSON.parse(result) as { text?: string; model?: string };
  if (typeof parsed.text !== 'string' || !parsed.text) {
    throw new LlmUnavailableError('g4f returned empty completion');
  }
  return { text: parsed.text, provider: 'g4f', model: parsed.model ?? 'unknown' };
}

/**
 * Generate a completion for the prompt using the configured provider.
 * Throws LlmUnavailableError when no provider can deliver — the planner
 * catches this and switches to deterministic fallback plans.
 */
export async function completeLlm(prompt: string): Promise<LlmCompletion> {
  const provider = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();

  switch (provider) {
    case 'mock':
      throw new LlmUnavailableError('LLM_PROVIDER=mock — deterministic fallback only');
    case 'dashscope':
      return completeDashScope(prompt);
    case 'g4f':
      return completeG4f(prompt);
    case 'ollama':
    default:
      return completeOllama(prompt);
  }
}
