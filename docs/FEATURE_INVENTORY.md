# Amphis feature inventory (Phase 1)

Branch: `amphis-full-build`  
Decision: extend the existing TanStack Start + Lovable Cloud app in place. Do **not** migrate to a Next.js monorepo or move the database.

## Preserved (working features kept)

| Area                        | Location                                      | Notes                                   |
| --------------------------- | --------------------------------------------- | --------------------------------------- |
| Branding / logo             | `BrandMark`, `src/assets/amphis-logo.png`     | Official mark only                      |
| Homepage / visual identity  | `routes/index.tsx`, `styles.css`              | Premium black / cyan accents            |
| Google + X auth             | Lovable Cloud / Supabase auth                 | Existing OAuth                          |
| Username claim, avatar, bio | `_authenticated/me`, onboarding, ProfileForms | Unchanged                               |
| Wallet link (signature)     | `wallet-link.functions.ts`                    | Ownership verification via message sign |
| Robinhood Chain sync        | `chains/robinhood/sync.server.ts`             | Alchemy asset transfers + log fallback  |
| Trade detection             | `chains/robinhood/trades.server.ts`           | Parser versioned                        |
| Pricing                     | `prices/defillama.server.ts`                  | Misses stored as null                   |
| FIFO PnL                    | `pnl/fifo.server.ts`                          | Exact decimals via numeric              |
| Trader performance UI       | `TradePerformance`, `/trader/$walletAddress`  | Real snapshots only                     |
| Migrations 0000–0007        | `drizzle/migrations`                          | Preserved; no destructive changes       |
| Public profile by username  | `/u/$username`                                | Extended with follow + visibility       |

## Upgraded in Phase 1

| Feature                  | Change                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| `/explore`               | Real eligible traders from `evm_performance_snapshots` (was empty stub)    |
| `/leaderboard`           | Real rankings with eligibility, methodology, last-updated (was empty stub) |
| `/trader/$walletAddress` | Follow/unfollow for public linked profiles                                 |
| `/u/$username`           | Follow button; private profiles hidden via RLS                             |
| Navbar                   | Search + Tokens links                                                      |
| Profiles                 | Additive `visibility` (`public` \| `private`)                              |
| Supabase types           | Extended for Phase 1 tables                                                |

## New in Phase 1

| Feature                          | Artifacts                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature register                 | `docs/FEATURE_REGISTER.md`                                                                                                                        |
| Feature inventory                | `docs/FEATURE_INVENTORY.md`                                                                                                                       |
| Migration 0008                   | `trader_metrics`, `leaderboard_snapshots`, `leaderboard_entries`, `follows`, `watchlists`, `watchlist_items`, `notifications`, profile visibility |
| Eligibility / ranking logic      | `src/lib/discovery/eligibility.ts` (+ bun tests)                                                                                                  |
| Explore / leaderboard server fns | `discovery.functions.ts`                                                                                                                          |
| Search                           | `/search` + `search.functions.ts`                                                                                                                 |
| Tokens                           | `/tokens`, `/tokens/$chainId/$contractAddress`                                                                                                    |
| Follow graph                     | `follow.functions.ts`, `FollowButton`                                                                                                             |

## Explicitly not done in Phase 1 (see register)

Next.js monorepo, Railway multi-service deploy, reputation engine, watchlist UI, alerts worker, admin console, protocol registry UI, chart suite, email notifications, ownership of Redis/workers split, live production verification.

## Phase 2 additions

| Feature              | Artifacts                                                                               |
| -------------------- | --------------------------------------------------------------------------------------- |
| Watchlist UI/API     | `/watchlist`, `watchlist.functions.ts`                                                  |
| Notifications UI/API | `/notifications`, `notifications.functions.ts`, `notify.server.ts`; sync + follow hooks |
| Portfolio            | `/portfolio`, `portfolio.functions.ts` (explicit wallet)                                |
| Activity             | `/activity`                                                                             |
| Reputation v1        | `reputation/score.ts`, `ReputationCard`, tests                                          |
| Legal                | `/about`, `/privacy`, `/terms`; footer links                                            |
| Migration 0009       | notification_preferences, reputation_snapshots, dedupe index                            |

## Phase 3 additions

| Feature                 | Artifacts                                                                     |
| ----------------------- | ----------------------------------------------------------------------------- |
| Following activity feed | `/activity` Following tab, `following-activity.functions.ts`                  |
| Live ETH balance        | `rpc/provider.server.ts`, portfolio wiring                                    |
| Real-data charts        | `charts/series.ts`, `PerformanceCharts`, chart-data server fn                 |
| Alert definitions       | migration 0010, `/alerts`, on-read wallet-activity eval; price alerts blocked |
| Health + Railway docs   | `/api/health`, `railway.toml`, `docs/DEPLOYMENT.md`                           |

## Phase 4 additions

| Feature                 | Artifacts                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Durable worker          | `scripts/worker.ts`, `src/lib/worker/jobs.server.ts`, `backoff.ts`, `bun run worker` |
| Migration 0011          | `worker_jobs`, `admin_roles`, `audit_events`, `wallets.public_contribute`            |
| Privacy settings        | `/settings/privacy` — visibility, public_contribute, export JSON, deletion request   |
| Admin basics            | `/admin` — indexing sample, jobs retry/enqueue, data-quality, audit (server-gated)   |
| Discovery privacy       | Explore/leaderboard skip `public_contribute=false` wallets                           |
| Railway web+worker docs | `railway.toml`, `docs/DEPLOYMENT.md` worker section                                  |
| Tests                   | `src/test/backoff.test.ts`                                                           |

## Explicitly not claimed in Phase 4

Railway LIVE VERIFIED deploy, email notifications, protocol registry, Redis, WalletConnect cloud id, production OAuth verification, merging to `main`.
