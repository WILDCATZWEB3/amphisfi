-- Trade valuation (historical USD values; null = unavailable, never guessed)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS valuation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS input_value_usd numeric,
  ADD COLUMN IF NOT EXISTS output_value_usd numeric,
  ADD COLUMN IF NOT EXISTS trade_value_usd numeric,
  ADD COLUMN IF NOT EXISTS fee_usd numeric,
  ADD COLUMN IF NOT EXISTS price_source text,
  ADD COLUMN IF NOT EXISTS price_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS valued_at timestamptz;
CREATE INDEX IF NOT EXISTS trades_wallet_valuation_idx ON public.trades(wallet_id, valuation_status);
CREATE INDEX IF NOT EXISTS trades_wallet_time_idx ON public.trades(wallet_id, block_time);

-- Historical price observations (cache)
CREATE TABLE public.price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL,
  requested_at timestamptz NOT NULL,
  observed_at timestamptz,
  price_usd numeric,
  status text NOT NULL DEFAULT 'ok',
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mint, requested_at, source)
);
CREATE INDEX price_snapshots_mint_time_idx ON public.price_snapshots(mint, requested_at);
GRANT SELECT ON public.price_snapshots TO anon, authenticated;
GRANT ALL ON public.price_snapshots TO service_role;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price snapshots are publicly readable" ON public.price_snapshots FOR SELECT USING (true);

-- FIFO acquisition lots
CREATE TABLE public.position_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  mint text NOT NULL,
  source_trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  acquired_at timestamptz,
  quantity numeric NOT NULL,
  remaining_quantity numeric NOT NULL,
  cost_basis_usd numeric NOT NULL,
  remaining_cost_basis_usd numeric NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_trade_id, mint)
);
CREATE INDEX position_lots_wallet_mint_idx ON public.position_lots(wallet_id, mint);
GRANT SELECT ON public.position_lots TO anon, authenticated;
GRANT ALL ON public.position_lots TO service_role;
ALTER TABLE public.position_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Position lots are publicly readable" ON public.position_lots FOR SELECT USING (true);

-- Realized PnL events (one per disposing trade and token)
CREATE TABLE public.realized_pnl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  mint text NOT NULL,
  disposed_at timestamptz,
  quantity numeric NOT NULL,
  matched_quantity numeric NOT NULL,
  cost_basis_usd numeric NOT NULL,
  proceeds_usd numeric NOT NULL,
  pnl_usd numeric NOT NULL,
  fully_matched boolean NOT NULL,
  price_source text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, mint)
);
CREATE INDEX realized_pnl_wallet_time_idx ON public.realized_pnl(wallet_id, disposed_at);
GRANT SELECT ON public.realized_pnl TO anon, authenticated;
GRANT ALL ON public.realized_pnl TO service_role;
ALTER TABLE public.realized_pnl ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Realized PnL is publicly readable" ON public.realized_pnl FOR SELECT USING (true);

-- Performance snapshots (one row per wallet and period)
CREATE TABLE public.performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  period text NOT NULL,
  realized_pnl_usd numeric,
  unrealized_pnl_usd numeric,
  total_pnl_usd numeric,
  volume_usd numeric,
  network_fees_usd numeric,
  trade_count integer NOT NULL DEFAULT 0,
  priced_trade_count integer NOT NULL DEFAULT 0,
  closed_trade_count integer NOT NULL DEFAULT 0,
  winning_trades integer NOT NULL DEFAULT 0,
  losing_trades integer NOT NULL DEFAULT 0,
  win_rate numeric,
  average_trade_pnl_usd numeric,
  largest_win_usd numeric,
  largest_loss_usd numeric,
  data_completeness text NOT NULL DEFAULT 'insufficient',
  notes text[] NOT NULL DEFAULT '{}',
  method text NOT NULL DEFAULT 'fifo',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, period)
);
GRANT SELECT ON public.performance_snapshots TO anon, authenticated;
GRANT ALL ON public.performance_snapshots TO service_role;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Performance snapshots are publicly readable" ON public.performance_snapshots FOR SELECT USING (true);