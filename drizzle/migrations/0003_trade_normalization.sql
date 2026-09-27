ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS protocol text,
  ADD COLUMN IF NOT EXISTS fee_lamports bigint,
  ADD COLUMN IF NOT EXISTS parser_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.trades ADD CONSTRAINT trades_direction_check CHECK (direction IN ('buy','sell','swap','unknown'));
ALTER TABLE public.trades DROP CONSTRAINT trades_confidence_check;
ALTER TABLE public.trades ADD CONSTRAINT trades_confidence_check CHECK (confidence IN ('high','medium','low'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS parser_version integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_trades_signature ON public.trades (signature);
CREATE INDEX IF NOT EXISTS idx_trades_wallet_time ON public.trades (wallet_id, block_time DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_parser ON public.transactions (wallet_id, parser_version);
INSERT INTO public.token_assets (mint) SELECT input_mint FROM public.trades UNION SELECT output_mint FROM public.trades ON CONFLICT DO NOTHING;
ALTER TABLE public.trades ADD CONSTRAINT trades_input_mint_fkey FOREIGN KEY (input_mint) REFERENCES public.token_assets(mint);
ALTER TABLE public.trades ADD CONSTRAINT trades_output_mint_fkey FOREIGN KEY (output_mint) REFERENCES public.token_assets(mint);