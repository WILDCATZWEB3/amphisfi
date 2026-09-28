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
- Trade classification lives in src/lib/solana/parser.ts; bump PARSER_VERSION on logic changes so reprocessWalletBatch re-parses older rows. Why: parser improves over time without re-linking wallets.
- The uploaded Amphis logo is the canonical brand mark; use src/components/amphis/BrandMark.tsx and never generate or substitute a logo. Why: brand consistency.
