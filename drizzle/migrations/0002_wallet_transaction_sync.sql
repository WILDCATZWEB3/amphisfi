ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS newest_signature text,
  ADD COLUMN IF NOT EXISTS oldest_signature text,
  ADD COLUMN IF NOT EXISTS newest_block_time timestamptz,
  ADD COLUMN IF NOT EXISTS oldest_block_time timestamptz,
  ADD COLUMN IF NOT EXISTS last_signature text,
  ADD COLUMN IF NOT EXISTS backfill_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS sync_started_at timestamptz;

ALTER TABLE public.wallets ADD CONSTRAINT wallets_sync_status_values
  CHECK (sync_status IN ('never_synced','syncing','completed','partial','failed'));

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  signature text NOT NULL,
  slot bigint NOT NULL,
  block_time timestamptz,
  status text NOT NULL CHECK (status IN ('success','failed')),
  fee_lamports bigint,
  source text,
  raw_transaction_reference text,
  parsed_type text NOT NULL DEFAULT 'unknown' CHECK (parsed_type IN ('swap','transfer','token_transfer','sol_transfer','nft','staking','program_interaction','unknown')),
  programs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, signature)
);
CREATE INDEX idx_transactions_wallet ON public.transactions (wallet_id);
CREATE INDEX idx_transactions_signature ON public.transactions (signature);
CREATE INDEX idx_transactions_block_time ON public.transactions (block_time DESC);
CREATE INDEX idx_transactions_slot ON public.transactions (slot DESC);
GRANT SELECT ON public.transactions TO anon, authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transactions are publicly readable" ON public.transactions FOR SELECT USING (true);
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE CASCADE,
  signature text NOT NULL,
  block_time timestamptz,
  input_mint text NOT NULL,
  input_amount numeric NOT NULL,
  output_mint text NOT NULL,
  output_amount numeric NOT NULL,
  input_decimals int NOT NULL,
  output_decimals int NOT NULL,
  source text,
  confidence text NOT NULL CHECK (confidence IN ('high','medium')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trades_wallet ON public.trades (wallet_id);
CREATE INDEX idx_trades_block_time ON public.trades (block_time DESC);
CREATE INDEX idx_trades_input_mint ON public.trades (input_mint);
CREATE INDEX idx_trades_output_mint ON public.trades (output_mint);
GRANT SELECT ON public.trades TO anon, authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trades are publicly readable" ON public.trades FOR SELECT USING (true);
CREATE TRIGGER trades_set_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.token_assets (
  mint text PRIMARY KEY,
  symbol text,
  name text,
  decimals int,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.token_assets TO anon, authenticated;
GRANT ALL ON public.token_assets TO service_role;
ALTER TABLE public.token_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Token assets are publicly readable" ON public.token_assets FOR SELECT USING (true);
CREATE TRIGGER token_assets_set_updated_at BEFORE UPDATE ON public.token_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();