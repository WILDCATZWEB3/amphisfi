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

## Worker service (Phase 4)

Run continuous wallet sync + price-alert evaluation as a **separate** Railway service from the same repo.

### Run command

```bash
bun run worker
# equivalent: bun run scripts/worker.ts
```

Environment (same as web, plus optional):

| Variable                    | Required             | Purpose                                          |
| --------------------------- | -------------------- | ------------------------------------------------ |
| `SUPABASE_URL`              | yes                  | DB                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | yes                  | Job claim / sync writes                          |
| `ROBINHOOD_RPC_URL`         | strongly recommended | Wallet sync RPC                                  |
| `WORKER_ID`                 | optional             | Worker instance id (auto-generated)              |
| `WORKER_LOOP_MS`            | optional             | Idle sleep between ticks (default 5000)          |
| `WORKER_BUDGET_MS`          | optional             | Max processing time per tick (default 25000)     |
| `AMPHIS_ADMIN_USER_IDS`     | optional             | Comma-separated Supabase user UUIDs for `/admin` |

### Behaviour

- DB-backed `worker_jobs` with queued/running/completed/failed, retries + exponential backoff
- Unique running sync per wallet (no concurrent processing of the same wallet)
- Graceful shutdown on SIGINT/SIGTERM
- `wallet_sync` jobs call existing `syncRobinhoodWallet` + trade detect / value / PnL within a processing budget
- `price_alerts` jobs call DefiLlama `currentPrices` for Robinhood tokens; **if price is null, the alert is not triggered** (skipped, never invented)

### Railway web + worker split

1. Create service **web** — build as in this file; start `bun run preview --host 0.0.0.0 --port $PORT`; health `/api/health`
2. Create service **worker** — same build; start `bun run worker`; no public HTTP
3. Apply migrations `0008`–`0011` on the database before relying on jobs/admin/privacy columns
4. Set `AMPHIS_ADMIN_USER_IDS` (or insert into `admin_roles`) before using `/admin`

**Status:** code + docs only — not claimed LIVE VERIFIED on Railway.
