"""
g4f LLM client — dynamically fetches a verified working model from
the Free-AI-Things/g4f-working health monitor, then uses it with
the gpt4free OpenAI-compatible client.

Usage:
  python g4f_client.py                          # run demo
  echo "prompt" | python g4f_client.py --stdin  # read prompt from stdin, print completion

Dependencies:
    pip install g4f requests
"""

import json
import os
import re
import sys
import requests
from g4f.client import Client

# ---------------------------------------------------------------------------
# 1. Helper: fetch and parse the latest working text models
# ---------------------------------------------------------------------------

G4F_MODELS_URL = (
    "https://raw.githubusercontent.com/"
    "Free-AI-Things/g4f-working/main/working/models.txt"
)
DEFAULT_MODEL = "gpt-3.5-turbo"

_SKIP_PATTERNS = re.compile(
    r"(tts|diffusion|stable|flux|sd-|dall-e|default$)", re.IGNORECASE
)


def fetch_working_models(url: str = G4F_MODELS_URL,
                         fallback: str = DEFAULT_MODEL) -> list[str]:
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
    except requests.RequestException:
        return [fallback]

    pattern = re.compile(r"^(.+?)\s*\((\w+)\)\s*$")
    models: list[str] = []
    for line in resp.text.splitlines():
        line = line.strip()
        if not line:
            continue
        match = pattern.match(line)
        if not match:
            continue
        model_name = match.group(1).strip()
        model_type = match.group(2).lower()
        if model_type != "text":
            continue
        if _SKIP_PATTERNS.search(model_name):
            continue
        models.append(model_name)

    return models if models else [fallback]


# ---------------------------------------------------------------------------
# 2. Client factory
# ---------------------------------------------------------------------------

def make_client() -> tuple[Client, list[str]]:
    models = fetch_working_models()
    client = Client()
    return client, models


# ---------------------------------------------------------------------------
# 3. Chat helper (with automatic retry across models)
# ---------------------------------------------------------------------------

def chat(user_message: str,
         system_prompt: str = "You are a helpful assistant.",
         client: Client | None = None,
         models: list[str] | None = None,
         max_retries: int = 5) -> tuple[str, str]:
    """Send a single-turn chat completion. Returns (response_text, model_used)."""
    if client is None or models is None:
        client, models = make_client()

    env_model = os.environ.get("G4F_MODEL", "").strip()
    if env_model:
        models = [env_model] + [m for m in models if m != env_model]

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_message},
    ]

    last_err: Exception | None = None
    for model in models[:max_retries]:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
            )
            text = response.choices[0].message.content
            return text, model
        except Exception as e:
            last_err = e
            print(f"[g4f] model '{model}' failed ({e.__class__.__name__}), "
                  f"trying next ...", file=sys.stderr)

    raise RuntimeError(
        f"All {max_retries} model(s) failed. Last error: {last_err}"
    )


# ---------------------------------------------------------------------------
# 4. CLI entry points
# ---------------------------------------------------------------------------

def run_stdin_mode():
    """Read a full prompt from stdin, return completion on stdout."""
    prompt = sys.stdin.read().strip()
    if not prompt:
        print("error: empty prompt on stdin", file=sys.stderr)
        sys.exit(1)

    client, models = make_client()
    text, model_used = chat(prompt, client=client, models=models)

    result = {"text": text, "provider": "g4f", "model": model_used}
    print(json.dumps(result))


def run_demo():
    print("Fetching latest verified text models ...")
    client, models = make_client()
    print(f"Model candidates: {models[:5]}  (showing first 5)\n")

    question = "Explain in two sentences what the g4f library does."
    print(f"Q: {question}")

    answer, model_used = chat(question, client=client, models=models)
    print(f"A: [{model_used}] {answer}")


if __name__ == "__main__":
    if "--stdin" in sys.argv:
        run_stdin_mode()
    else:
        run_demo()
