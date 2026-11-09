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
