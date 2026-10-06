ALTER TABLE public.evm_trades
  ADD COLUMN IF NOT EXISTS block_number bigint,
  ADD COLUMN IF NOT EXISTS direction text,
  ADD COLUMN IF NOT EXISTS router_address text,
  ADD COLUMN IF NOT EXISTS protocol text,
  ADD COLUMN IF NOT EXISTS gas_fee_wei numeric,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS detection_source text;
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS classification text;
ALTER TABLE public.evm_performance_snapshots
  ADD COLUMN IF NOT EXISTS unrealized_pnl_usd numeric,
  ADD COLUMN IF NOT EXISTS open_market_value_usd numeric,
  ADD COLUMN IF NOT EXISTS total_pnl_usd numeric,
  ADD COLUMN IF NOT EXISTS roi numeric,
  ADD COLUMN IF NOT EXISTS capital_deployed_usd numeric,
  ADD COLUMN IF NOT EXISTS average_trade_usd numeric,
  ADD COLUMN IF NOT EXISTS best_trade_pnl_usd numeric,
  ADD COLUMN IF NOT EXISTS worst_trade_pnl_usd numeric,
  ADD COLUMN IF NOT EXISTS unclassified_tx_count integer,
  ADD COLUMN IF NOT EXISTS performance_ready boolean NOT NULL DEFAULT false;