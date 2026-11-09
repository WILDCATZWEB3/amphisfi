# Amphis deployment notes

**Status:** documentation and local/build configuration only. Nothing in this document claims a live Railway (or other) production deploy was performed.

## Current hosting

- App: Lovable / TanStack Start (this repo)
- Database: Lovable Cloud (Supabase-compatible Postgres) with Drizzle SQL migrations in `drizzle/migrations/`
- Chain data: server-side Alchemy (or `ROBINHOOD_RPC_URL`) + public RPC fallback

## Environment variables (server)

| Variable                    | Required             | Purpose                                                                                        |
| --------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | yes                  | Database / auth API                                                                            |
| `SUPABASE_PUBLISHABLE_KEY`  | yes                  | User-scoped Supabase client                                                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | yes                  | Server writes (indexing, analytics) — never expose to browser                                  |
| `ROBINHOOD_RPC_URL`         | strongly recommended | Alchemy (or other) Robinhood Chain RPC; used for sync + live ETH balance                       |
| `VITE_ROBINHOOD_CHAIN_ID`   | optional             | Defaults to `4663`                                                                             |
| `VITE_ROBINHOOD_RPC_URL`    | optional             | **Public** RPC for wallet `wallet_addEthereumChain` only — do not put Alchemy keys in `VITE_*` |
| `AMPHIS_ADMIN_USER_IDS`     | optional             | Comma-separated auth user UUIDs for `/admin`                                                   |
| `EMAIL_PROVIDER`            | optional             | Set to `resend` to enable email; omit/`none` keeps email off                                   |
| `RESEND_API_KEY`            | if email on          | Resend API key — never commit                                                                  |
| `EMAIL_FROM`                | if email on          | Verified sender address for Resend                                                             |
| `PUBLIC_API_RATE_LIMIT`     | optional             | Max public server-fn calls per IP per window (default 60)                                      |
| `PUBLIC_API_RATE_WINDOW_MS` | optional             | Rate-limit window ms (default 60000)                                                           |
| `WORKER_ID`                 | optional             | Worker instance id                                                                             |
| `WORKER_LOOP_MS`            | optional             | Idle sleep between ticks (default 5000)                                                        |
| `WORKER_BUDGET_MS`          | optional             | Max processing time per tick (default 25000)                                                   |

OAuth (Google / X) is configured in Lovable/Supabase dashboard callback URLs for the production domain.

## Build / start (local or container)

```bash
bun install --frozen-lockfile
bun run build
bun run preview --host 0.0.0.0 --port ${PORT:-4173}
```

Tests:

```bash
bun test src/test
```

## Migrations

Apply in order on the live DB (additive only; include through `0011_worker_admin_privacy.sql`):

1. `0000` … `0007` (existing)
2. `0008_discovery_social.sql`
3. `0009_notifications_reputation.sql`
4. `0010_alert_definitions.sql`

Do not drop production tables. Prefer Lovable/Supabase SQL editor or a controlled drizzle migrate with service credentials.

## Health check

- `GET /api/health` (also `/healthz`)
- Returns JSON `{ ok, service, time, rpc, chain }`
- Does **not** include secrets or full RPC URLs with keys
- `ok: false` / HTTP 503 when chain RPC is unreachable

## Railway plan (not executed)

`railway.toml` sketches a single web service. A complete production cutover still needs:

1. Railway project + GitHub repo link
2. Railway PostgreSQL **or** continued Supabase with private networking review
3. Env vars listed above set as Railway secrets
4. Separate **worker** service for autonomous indexing, pricing, leaderboard refresh, price-alert evaluation
5. Custom domain + HTTPS
6. Post-deploy verification: health, wallet sync, persistence after restart

Until those steps are done and verified, deployment status remains **not LIVE VERIFIED**.

## Web / worker split (honest)

| Service          | Responsibility today                                                            | Gap                                      |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| Web              | SSR UI, server functions, user-triggered sync batches                           | Sync is request-budgeted, not continuous |
| Worker (planned) | Incremental indexing, price backfill, leaderboard/reputation jobs, price alerts | Not implemented as a separate process    |

Do not use browser timers as an alert or indexing engine.

## Railway: web + worker (exact setup)

**Status:** documented and code-ready. **Not LIVE VERIFIED** — no production Railway deploy was performed in this branch.

### 1) Create two services from the same GitHub repo

| Service    | Root config                                           | Start command                                 | Public domain | Healthcheck           |
| ---------- | ----------------------------------------------------- | --------------------------------------------- | ------------- | --------------------- |
| **web**    | `railway.toml`                                        | `bun run preview --host 0.0.0.0 --port $PORT` | yes           | `/api/health` (30s)   |
| **worker** | same repo; override start (see `railway.worker.toml`) | `bun run worker`                              | **no**        | none (process worker) |

Build command (both): `bun install --frozen-lockfile && bun run build`

### 2) Shared environment variables (set on both services)

Required: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ROBINHOOD_RPC_URL`  
Optional: `AMPHIS_ADMIN_USER_IDS`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, worker tuning vars, rate-limit vars.

### 3) Database

Apply additive migrations through **`0012_phase5_worker_protocols_email.sql`** before relying on atomic claim, protocols, or email prefs.

### 4) Worker behaviour (Phase 5)

- Atomic claim via Postgres `claim_worker_job` (`FOR UPDATE SKIP LOCKED` + lease)
- Lease timeout recovers stuck `running` jobs
- Per-wallet coordination (no concurrent sync of the same wallet)
- Retries + exponential backoff
- Graceful SIGINT/SIGTERM shutdown
- Price alerts only when DefiLlama returns a real price

### 5) Email

Email is **off** unless `EMAIL_PROVIDER=resend` **and** `RESEND_API_KEY` **and** `EMAIL_FROM` are set, **and** the user opts in (`notification_preferences.email`). Missing config never sends.

### 6) Local run commands

```bash
bun install --frozen-lockfile
bun run build
bun run preview --host 0.0.0.0 --port ${PORT:-4173}   # web
bun run worker                                         # worker
bun test src/test
```
