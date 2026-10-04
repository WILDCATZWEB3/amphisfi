CREATE TABLE public.evm_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL DEFAULT 'robinhood',
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.evm_transactions(id) ON DELETE CASCADE,
  transaction_hash text NOT NULL,
  block_time timestamptz,
  sold_token text NOT NULL,
  sold_amount_raw numeric NOT NULL,
  sold_decimals integer,
  bought_token text NOT NULL,
  bought_amount_raw numeric NOT NULL,
  bought_decimals integer,
  parser_version integer NOT NULL,
  valuation_status text NOT NULL DEFAULT 'pending',
  sold_price_usd numeric,
  bought_price_usd numeric,
  trade_value_usd numeric,
  price_source text,
  valued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, transaction_id)
);
CREATE INDEX evm_trades_wallet_time ON public.evm_trades (wallet_id, block_time);

CREATE TABLE public.evm_price_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL,
  token text NOT NULL,
  requested_ts bigint NOT NULL,
  price_usd numeric,
  observed_ts bigint,
  status text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, token, requested_ts)
);

CREATE TABLE public.evm_position_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  token text NOT NULL,
  source_trade_id uuid NOT NULL REFERENCES public.evm_trades(id) ON DELETE CASCADE,
  acquired_at timestamptz,
  quantity numeric NOT NULL,
  remaining_quantity numeric NOT NULL,
  cost_basis_usd numeric NOT NULL,
  remaining_cost_basis_usd numeric NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evm_position_lots_wallet ON public.evm_position_lots (wallet_id);

CREATE TABLE public.evm_realized_pnl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.evm_trades(id) ON DELETE CASCADE,
  token text NOT NULL,
  disposed_at timestamptz,
  quantity numeric NOT NULL,
  matched_quantity numeric NOT NULL,
  cost_basis_usd numeric NOT NULL,
  proceeds_usd numeric NOT NULL,
  pnl_usd numeric NOT NULL,
  fully_matched boolean NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evm_realized_pnl_wallet ON public.evm_realized_pnl (wallet_id);

CREATE TABLE public.evm_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  period text NOT NULL,
  realized_pnl_usd numeric,
  volume_usd numeric,
  trade_count integer NOT NULL DEFAULT 0,
  priced_trade_count integer NOT NULL DEFAULT 0,
  closed_trade_count integer NOT NULL DEFAULT 0,
  winning_trades integer NOT NULL DEFAULT 0,
  losing_trades integer NOT NULL DEFAULT 0,
  win_rate numeric,
  open_cost_basis_usd numeric,
  data_completeness text NOT NULL DEFAULT 'insufficient',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, period)
);

GRANT SELECT ON public.evm_trades, public.evm_price_snapshots, public.evm_position_lots, public.evm_realized_pnl, public.evm_performance_snapshots TO anon, authenticated;
GRANT ALL ON public.evm_trades, public.evm_price_snapshots, public.evm_position_lots, public.evm_realized_pnl, public.evm_performance_snapshots TO service_role;

ALTER TABLE public.evm_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_position_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_realized_pnl ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evm_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "EVM trades are publicly readable" ON public.evm_trades FOR SELECT USING (true);
CREATE POLICY "EVM prices are publicly readable" ON public.evm_price_snapshots FOR SELECT USING (true);
CREATE POLICY "EVM lots are publicly readable" ON public.evm_position_lots FOR SELECT USING (true);
CREATE POLICY "EVM realized PnL is publicly readable" ON public.evm_realized_pnl FOR SELECT USING (true);
CREATE POLICY "EVM performance is publicly readable" ON public.evm_performance_snapshots FOR SELECT USING (true);