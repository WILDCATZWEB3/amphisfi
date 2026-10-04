<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Robinhood swap detection lives in src/lib/chains/robinhood/trades.server.ts; bump PARSER_VERSION on rule changes so older trades are re-detected. Prices come from src/lib/prices/defillama.server.ts (cached, misses stored as null) and FIFO cost basis from src/lib/pnl/fifo.server.ts, run after each sync batch. Why: values are never guessed and rules can improve without re-linking wallets.
- The uploaded Amphis logo is the canonical brand mark; use src/components/amphis/BrandMark.tsx and never generate or substitute a logo. Why: brand consistency.
- Robinhood Chain (EVM, chain 4663) is the active chain: wallet connection in src/lib/evm/WalletContext.tsx (EIP-1193/6963, no wagmi), indexing in src/lib/chains/robinhood/sync.server.ts. Why: chain-specific logic stays isolated from UI.
- Indexed chain data (evm_transactions, evm_logs, token_transfers, wallet_transactions, evm_tokens) is written only server-side; clients have read-only access. Why: browser must never write blockchain data.
- Solana-era tables (transactions, trades, token_assets, realized_pnl, etc.) are retired, not dropped. Why: zero-downtime migration.
