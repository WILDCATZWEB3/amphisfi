ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'robinhood',
  ADD COLUMN IF NOT EXISTS address_normalized text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ownership_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_indexed_block bigint,
  ADD COLUMN IF NOT EXISTS oldest_indexed_block bigint,
  ADD COLUMN IF NOT EXISTS last_indexed_transaction text,
  ADD COLUMN IF NOT EXISTS txs_discovered integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS txs_stored integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocks_processed bigint NOT NULL DEFAULT 0;

-- Existing rows were linked under the previous Solana stack.
UPDATE public.wallets SET chain = 'solana', address_normalized = address WHERE address NOT LIKE '0x%';
CREATE UNIQUE INDEX IF NOT EXISTS wallets_chain_address_normalized_key ON public.wallets (chain, address_normalized);
CREATE INDEX IF NOT EXISTS wallets_profile_chain_idx ON public.wallets (profile_id, chain);

CREATE TABLE public.evm_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL,
  hash text NOT NULL,
  block_number bigint NOT NULL,
  block_hash text,
  block_time timestamptz,
  tx_index integer,
  from_address text NOT NULL,
  to_address text,
  contract_address text,
  value_wei numeric NOT NULL DEFAULT 0,
  nonce bigint,
  gas_limit numeric,
  gas_used numeric,
  gas_price_wei numeric,
  effective_gas_price_wei numeric,
  status text NOT NULL,
  method_selector text,
  input text,
  tx_type text,
  log_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, hash)
);
GRANT SELECT ON public.evm_transactions TO anon, authenticated;
GRANT ALL ON public.evm_transactions TO service_role;
ALTER TABLE public.evm_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EVM transactions are publicly readable" ON public.evm_transactions FOR SELECT USING (true);
CREATE INDEX evm_transactions_block_idx ON public.evm_transactions (chain, block_number DESC);

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.evm_transactions(id) ON DELETE CASCADE,
  block_number bigint NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, transaction_id)
);
GRANT SELECT ON public.wallet_transactions TO anon, authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wallet transactions are publicly readable" ON public.wallet_transactions FOR SELECT USING (true);
CREATE INDEX wallet_transactions_wallet_block_idx ON public.wallet_transactions (wallet_id, block_number DESC);

CREATE TABLE public.evm_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.evm_transactions(id) ON DELETE CASCADE,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  block_number bigint NOT NULL,
  address text NOT NULL,
  topic0 text,
  topics text[] NOT NULL DEFAULT '{}',
  data text NOT NULL DEFAULT '0x',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, transaction_hash, log_index)
);
GRANT SELECT ON public.evm_logs TO anon, authenticated;
GRANT ALL ON public.evm_logs TO service_role;
ALTER TABLE public.evm_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EVM logs are publicly readable" ON public.evm_logs FOR SELECT USING (true);
CREATE INDEX evm_logs_topic0_idx ON public.evm_logs (chain, topic0);

CREATE TABLE public.evm_tokens (
  chain text NOT NULL,
  address text NOT NULL,
  symbol text,
  name text,
  decimals integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chain, address)
);
GRANT SELECT ON public.evm_tokens TO anon, authenticated;
GRANT ALL ON public.evm_tokens TO service_role;
ALTER TABLE public.evm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EVM tokens are publicly readable" ON public.evm_tokens FOR SELECT USING (true);

CREATE TABLE public.token_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.evm_transactions(id) ON DELETE CASCADE,
  transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  block_number bigint NOT NULL,
  block_time timestamptz,
  token_address text NOT NULL,
  standard text NOT NULL DEFAULT 'erc20',
  from_address text NOT NULL,
  to_address text NOT NULL,
  amount_raw numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, transaction_hash, log_index)
);
GRANT SELECT ON public.token_transfers TO anon, authenticated;
GRANT ALL ON public.token_transfers TO service_role;
ALTER TABLE public.token_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Token transfers are publicly readable" ON public.token_transfers FOR SELECT USING (true);
CREATE INDEX token_transfers_from_idx ON public.token_transfers (chain, from_address);
CREATE INDEX token_transfers_to_idx ON public.token_transfers (chain, to_address);

COMMENT ON TABLE public.transactions IS 'DEPRECATED: Solana-era index; replaced by evm_transactions/wallet_transactions';
COMMENT ON TABLE public.trades IS 'DEPRECATED: Solana-era trade detection';
COMMENT ON TABLE public.token_assets IS 'DEPRECATED: Solana-era token metadata; replaced by evm_tokens';