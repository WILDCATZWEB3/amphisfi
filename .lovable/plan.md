# Trade values and gains/losses for Robinhood Chain

## Important prerequisite
Amphis does not detect Robinhood Chain trades yet. It only stores raw token transfers. To show what each trade was worth and its profit, trades have to be detected first, so this plan covers both steps.

## What you will see
- On My Profile and on trader pages, a list of trades: what was sold, what was bought, when, and the dollar value at that moment.
- Realized gains/losses per trade, and totals: realized profit, open-position value, win rate, trade count.
- Clear labels when a price can't be found ("Price unavailable"). Those trades are left out of totals, never guessed.

## Steps
1. **Trade detection.** Turn each stored transaction into a swap when the wallet sent one token and received another in the same transaction (ETH included, via WETH and value). Transactions that don't clearly look like a swap are skipped. Each trade records its rule version so it can be reprocessed when the rules improve.
2. **Price feed.** Fetch historical USD prices at the trade's time from DefiLlama, which tracks Robinhood Chain (chain 4663), and cache every lookup, including misses. Stablecoins are only priced by the feed, never assumed to be $1. If one side of a swap has a price, value the whole trade from that side.
3. **Cost basis tracker.** First-in-first-out lots for each token: buys open lots at their USD cost, and sells close the oldest lots first and record the realized profit. Sells with no known purchase are marked "partially matched" and kept out of win rate.
4. **Summary.** Store 7D, 30D and All Time snapshots per wallet with a data-completeness label.
5. **Pipeline.** After each sync batch: detect trades, price them, then recalculate. This runs from the existing Sync button, so there are no new background jobs.

## Technical details
- New tables (additive, server-written, public read-only): `evm_trades`, `evm_price_snapshots`, `evm_position_lots`, `evm_realized_pnl`, `evm_performance_snapshots`, keyed by `wallet_id` and `chain`. The retired Solana tables stay untouched.
- Files: `src/lib/chains/robinhood/trades.server.ts` (detector + `PARSER_VERSION`), `src/lib/prices/defillama.server.ts` (`coins.llama.fi/prices/historical/{ts}/{chainSlug}:{addr}`, with the slug verified at build time), `src/lib/pnl/fifo.server.ts`. The pipeline is called from `syncMyWallet` after `syncRobinhoodWallet`.
- UI: extend `WalletActivity.tsx` and add a trades/performance section on `trader.$walletAddress.tsx` and `u.$username.tsx`, using existing Card/EmptyState components.
- Known limit: tokens DefiLlama doesn't price stay unvalued. Plain ETH transfers are still not discovered.
- Update AGENTS.md: point the parser-version rule at the new detector file.
