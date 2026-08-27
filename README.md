# Pathfinder — Proactive Travel Disruption Agent

> **Prediction prepares. Atlas confirms. You approve.**

Pathfinder is a hackathon MVP that demonstrates intelligent, proactive handling of flight disruptions. It monitors risk factors, prepares alternatives before disruption occurs, and only executes rebooking after explicit human approval.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Pathfinder Frontend                          │
│  (Next.js 14 App Router + Tailwind CSS + shadcn/ui)                  │
├─────────────────────────────────────────────────────────────────────┤
│  Dashboard    │  Recovery Page   │  Admin Panel   │  Auth Pages      │
└───────┬───────┴────────┬─────────┴────────┬───────┴────────┬────────┘
        │                │                  │                │
┌───────▼────────────────▼──────────────────▼────────────────▼────────┐
│                         API Layer (Route Handlers)                   │
│  /api/predictions  │  /api/webhooks/atlas  │  /api/recoveries/*      │
└───────┬────────────────┬──────────────────┬────────────────┬────────┘
        │                │                  │                │
┌───────▼────────────────▼──────────────────▼────────────────▼────────┐
│                          Services Layer                              │
│  RiskScoring  │  PredictionEngine  │  RecoveryManager  │  Notifier  │
└───────┬────────────────┬──────────────────┬────────────────┬────────┘
        │                │                  │                │
┌───────▼────────────────▼──────────────────▼────────────────▼────────┐
│                       Atlas Adapter (Singleton)                       │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │  Demo Mode   │  │ Sandbox Mode │                                  │
│  │(Deterministic)│  │  (Real API)  │                                  │
│  └──────────────┘  └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
        │                │                  │                │
┌───────▼────────────────▼──────────────────▼────────────────▼────────┐
│                    PostgreSQL + Prisma ORM                           │
│  16 Tables: User, Booking, BookingSegment, DisruptionRisk,          │
│  RecoveryCase, RecoveryPackage, AtlasOperation, AtlasWebhook,       │
│  PriceVerification, Payment, Ticketing, Notification                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Three-Stage Flow

### Stage 1: Prediction (Automatic & Silent)
- Calculates disruption risk score using weighted factors:
  - Weather severity: **50%**
  - Airport disruption: **30%**
  - Inbound delay: **15%**
  - Historical cancellation rate: **5%**
- If score >= **0.70 threshold**, silently calls Atlas `search.do` → `verify.do`
- Caches up to 3 replacement packages:
  - **Fastest** arrival time
  - **Lowest** all-in cost
  - **Least disruption** (closest to original timing)
- **No user alerts or charges at this stage**

### Stage 2: Confirmation (Webhook-Driven)
- `POST /api/webhooks/atlas` is the **sole trigger** for converting monitoring to recovery
- On `order.schedulechange` event:
  1. Verifies HMAC signature
  2. Validates payload with Zod
  3. Deduplicates by event ID
  4. Evaluates change type (MINOR, MATERIAL, CANCELLED)
  5. Activates prepared packages
  6. Creates in-app notification with deep link
  7. Returns **fast 2xx response** while processing async

### Stage 3: Approval (Human-Gated)
- Traveler must authenticate (proves booking ownership)
- Reviews **refreshed pricing** (cached sessions may be stale)
- Only after explicit confirmation:
  1. `order.do` — creates new booking
  2. `pay.do` — processes payment
  3. `queryOrderDetails.do` — polls with exponential backoff until ticketed
- **Idempotency locks** prevent double-clicks and duplicate orders

---

## AI Rebooking Pipeline

An end-to-end pipeline that turns a confirmed disruption into **3 empathetic, AI-generated rebooking options**. Responsibilities are split between the two surfaces:

- **Ops Console (`/admin`)** — *only* simulates the disruption (Step 2) and hands off the captured payload. It contains no Atlas route fetching or AI logic.
- **Flight Board (`/dashboard`)** — owns Step 1 (Atlas API route fetch) and Step 3 (LLM plan generation). Trigger it from the *AI Recovery Desk* panel or call the endpoint directly:

```
POST /api/ai/plans
{ "bookingId": "..." }
```

| Step | Owner | Module | What it does |
|------|-------|--------|--------------|
| 2 | Ops Console | `src/lib/pipeline/disruption-sim.ts` | Simulates a schedule change (cancellation or 6h+ delay). Captures the disrupted flight, the passenger's original itinerary, and the reason, then **persists the payload as a clean handoff** (`DISRUPTION_PAYLOAD` pipeline log) for the Flight Board to pick up. |
| 1 | Flight Board | `src/lib/pipeline/routes-catalog.ts` | Authenticates via the Atlas adapter and sweeps a route matrix, storing all available routes (origin, destination, flight no, departure/arrival) in a structured catalog with origin-indexed lookup. 5-min TTL cache, per-pair error isolation, 10s timeouts. |
| 3 | Flight Board | `src/lib/ai/planner.ts` + `llm-client.ts` | Takes the disruption payload (Step 2 handoff) and the available routes (Step 1) as context and asks the LLM for **exactly 3 distinct plans** as strict JSON (flight numbers, layovers, empathetic explanation). Responses are repaired (`<think>` blocks, fences, prose) and validated with Zod; one repair retry. |

**Handoff** — the Ops Console and Flight Board run in separate browser contexts, so the disruption payload is passed through the `PipelineLog` table (`step = DISRUPTION_PAYLOAD`) and re-read by the Flight Board via `getLatestDisruption(bookingId)`. No schema change required.

**Error handling (Flight Board)** — the `/api/ai/plans` endpoint returns a typed contract that the Recovery Desk renders verbatim: `404 NO_DISRUPTION` (Ops Console hasn't handed off a payload yet), `502 ATLAS_FETCH_FAILED` (Atlas route sweep failed), `400 INVALID_BODY`, `500 PIPELINE_FAILED`. LLM failures degrade to deterministic fallback plans rather than erroring.

**Resilience** — LLM node rotation with 429 backoff, network timeouts, and a deterministic fallback generator guarantee exactly 3 plans even when every LLM node fails. Every step logs to console **and** the `PipelineLog` table; the API returns the full trace so the Flight Board can render the Ops Console → Atlas → AI data flow.

**LLM providers** (environment variables):

```bash
LLM_PROVIDER=ollama          # ollama | dashscope | mock
OLLAMA_BASE_URLS=            # comma-separated OllamaFreeAPI nodes (empty = built-in pool)
OLLAMA_MODEL=                # empty = auto-discover best model from each node's /api/tags
LLM_TIMEOUT_MS=90000
DASHSCOPE_API_KEY=           # only for LLM_PROVIDER=dashscope
DASHSCOPE_MODEL=qwen-plus
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | NextAuth.js (v4) |
| Validation | Zod |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Testing | Vitest (unit) + Playwright (E2E) |
| Travel API | Atlas (atriptech.com) |

---

## Prerequisites

- **Node.js 18+** (LTS recommended)
- **PostgreSQL 14+** (local or cloud-hosted)
- **npm** or **yarn**

---

## Setup Instructions

### 1. Clone and Install

```bash
cd c:\VS\Hackathon
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Atlas Configuration
ATLAS_MODE=demo                    # 'demo' or 'sandbox'
ATLAS_SANDBOX_URL=https://sandbox.atriptech.com
ATLAS_CLIENT_ID=                   # From Atlas dashboard (sandbox mode)
ATLAS_CLIENT_SECRET=               # From Atlas dashboard (sandbox mode)
ATLAS_WEBHOOK_SECRET=your-secret   # For webhook verification

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/journeyguard

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Set Up Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (or use migrations)
npm run db:push

# Seed demo data
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Demo Walkthrough

### Login
- Navigate to `/`
- Use pre-filled credentials: `demo@pathfinder.dev` / `demo123`
- Click "Sign In"

### View Bookings (Dashboard)
- See 3 demo bookings with risk scores:
  - **SIN → KUL** (AirAsia AK701) — Risk: 35%
  - **BKK → HKT** (Thai AirAsia FD302) — Risk: 42%
  - **SYD → SIN → BKK** (Multi-segment) — Risk: 28%

### Trigger Disruption (Admin Panel)
1. Click "Admin" in the header
2. Select a booking from the dropdown
3. Click "Trigger Risk Assessment" (Stage 1)
   - Watch risk score update
   - If >70%, alternatives are prepared silently
4. Click "Send Webhook Event" (Stage 2)
   - Select change type: CANCELLED, MATERIAL, or MINOR
   - Watch notifications appear

### Review & Approve (Recovery Page)
1. Return to Dashboard
2. Click "Review Options" on the disrupted booking
3. See 3 prepared alternatives:
   - Fastest (Zap icon)
   - Best Value (Tag icon)
   - Closest Match (Refresh icon)
4. Select a package
5. Click "Confirm & Rebook"
6. Watch the execution: verify → order → pay → ticketed

### Demo Scenarios
Use the "Demo Scenario" selector in the admin panel to test:
- **success** — Normal flow completes
- **stale_session** — Package session expired, re-verification needed
- **price_change** — Price changed during verification
- **no_inventory** — No alternatives available
- **payment_fail** — Payment declined

---

## API Reference

### `POST /api/predictions`
Run prediction for all bookings or trigger with custom inputs.

### `POST /api/webhooks/atlas`
Receive Atlas schedule change events (Stage 2 trigger).

### `GET /api/recoveries/[id]`
Get recovery case details with packages.

### `POST /api/recoveries/[id]/approve`
Approve and execute a recovery package (Stage 3).

### `POST /api/admin/trigger`
Admin endpoints for demo scenarios.

### `GET/POST /api/notifications`
Get and manage user notifications.

---

## Testing

### Unit Tests
```bash
npm run test
```

Covers:
- Risk scoring formula and weights
- Stale package detection
- Idempotency lock behavior
- Webhook deduplication

### E2E Tests
```bash
npm run test:e2e
```

Covers:
- Full cancellation-to-ticketed flow
- Notification delivery after disruption

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # Route handlers
│   │   ├── auth/[...nextauth]  # NextAuth.js
│   │   ├── predictions         # Stage 1 API
│   │   ├── webhooks/atlas      # Stage 2 webhook
│   │   ├── recoveries/[id]     # Stage 3 API
│   │   ├── bookings/[id]       # Booking details
│   │   ├── admin/trigger       # Demo controls
│   │   └── notifications       # Notification API
│   ├── dashboard/              # Booking list page
│   ├── recovery/[id]/          # Recovery review page
│   ├── admin/                  # Admin control panel
│   └── page.tsx                # Landing/login page
├── lib/
│   ├── atlas/                  # Atlas adapter
│   │   ├── adapter.ts          # Interface
│   │   ├── client.ts           # Sandbox implementation
│   │   ├── demo.ts             # Demo mock implementation
│   │   └── types.ts            # API types
│   ├── services/               # Business logic
│   │   ├── risk-scoring.ts     # Risk calculation
│   │   ├── prediction.ts       # Stage 1 engine
│   │   ├── recovery.ts         # Stage 2-3 manager
│   │   ├── notification.ts     # Notification service
│   │   └── idempotency.ts      # Dedup & locks
│   ├── webhooks/               # Webhook handling
│   │   ├── atlas-handler.ts    # Event processor
│   │   └── signature.ts        # HMAC verification
│   ├── utils/                  # Utilities
│   │   ├── lock.ts             # Distributed lock
│   │   └── constants.ts        # Config constants
│   ├── auth.ts                 # NextAuth config
│   ├── db.ts                   # Prisma client
│   └── utils.ts                # Helper functions
├── components/
│   ├── dashboard/              # Dashboard components
│   ├── recovery/               # Recovery components
│   └── Providers.tsx           # Session provider
└── types/index.ts              # Shared types

prisma/
├── schema.prisma               # Database schema (16 tables)
└── seed.ts                     # Demo data seeder

tests/
├── unit/                       # Vitest unit tests
└── e2e/                        # Playwright E2E tests
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ATLAS_MODE` | `demo` or `sandbox` | `demo` |
| `ATLAS_SANDBOX_URL` | Atlas sandbox base URL | `https://sandbox.atriptech.com` |
| `ATLAS_CLIENT_ID` | Atlas OAuth client ID | — |
| `ATLAS_CLIENT_SECRET` | Atlas OAuth client secret | — |
| `ATLAS_WEBHOOK_SECRET` | Webhook HMAC secret | `dev-webhook-secret...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `NEXTAUTH_URL` | App URL for auth | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth encryption secret | — |

---

## Deployment

### Local Production Build
```bash
npm run build
npm run start
```

### Alibaba Cloud Deployment
1. Create ECS instance or Function Compute
2. Set environment variables
3. Run `npm run build`
4. Use PM2 or systemd to manage the process

### Vercel Deployment
```bash
npx vercel --prod
```

---

## License

MIT — Built for hackathon demonstration purposes.

---

## Credits

- **Atlas API** — [atriptech.com](https://atlaslovestravel.com)
- **Alibaba Cloud** — Infrastructure and Qwen model
- **Next.js** — [nextjs.org](https://nextjs.org)
- **Prisma** — [prisma.io](https://prisma.io)
