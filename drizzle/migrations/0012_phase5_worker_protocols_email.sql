-- Phase 5: worker lease fields + atomic claim RPC, protocols registry, email prefs.
-- Additive only. Protocol seed data is limited to Uniswap SDK-verified Robinhood Chain (4663) contracts.

ALTER TABLE public.worker_jobs
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS worker_jobs_lease_idx
  ON public.worker_jobs (status, lease_expires_at)
  WHERE status = 'running';

-- Atomic claim: SKIP LOCKED + lease. Recovers expired leases into the candidate set.
CREATE OR REPLACE FUNCTION public.claim_worker_job(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS public.worker_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.worker_jobs;
  now_ts timestamptz := now();
  lease_ts timestamptz := now() + make_interval(secs => GREATEST(30, LEAST(coalesce(p_lease_seconds, 120), 3600)));
BEGIN
  -- Release expired leases back to queued so they can be reclaimed.
  UPDATE public.worker_jobs
  SET status = 'queued',
      locked_at = NULL,
      locked_by = NULL,
      lease_expires_at = NULL,
      updated_at = now_ts,
      last_error = coalesce(last_error, 'lease_expired')
  WHERE status = 'running'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now_ts;

  WITH candidate AS (
    SELECT j.id
    FROM public.worker_jobs j
    WHERE j.status = 'queued'
      AND j.run_after <= now_ts
      AND (
        j.kind <> 'wallet_sync'
        OR j.wallet_id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.worker_jobs r
          WHERE r.kind = 'wallet_sync'
            AND r.wallet_id = j.wallet_id
            AND r.status = 'running'
            AND (r.lease_expires_at IS NULL OR r.lease_expires_at >= now_ts)
        )
      )
    ORDER BY j.created_at ASC
    FOR UPDATE OF j SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.worker_jobs j
  SET status = 'running',
      locked_at = now_ts,
      locked_by = p_worker_id,
      lease_expires_at = lease_ts,
      attempts = coalesce(j.attempts, 0) + 1,
      updated_at = now_ts
  FROM candidate c
  WHERE j.id = c.id
  RETURNING j.* INTO claimed;

  RETURN claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_worker_job(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_worker_job(text, integer) TO service_role;

-- Email preference (off by default until provider configured + user opts in)
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  website_url text,
  docs_url text,
  source text NOT NULL,
  source_url text NOT NULL,
  verification_status text NOT NULL DEFAULT 'verified',
  chain_id integer NOT NULL DEFAULT 4663,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (verification_status IN ('verified', 'unverified', 'unknown')),
  CHECK (category IN ('dex', 'lending', 'bridge', 'yield', 'other'))
);

CREATE TABLE IF NOT EXISTS public.protocol_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id uuid NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
  chain_id integer NOT NULL DEFAULT 4663,
  role text NOT NULL,
  address text NOT NULL,
  address_normalized text NOT NULL,
  source text NOT NULL,
  source_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain_id, address_normalized),
  CHECK (address ~* '^0x[0-9a-fA-F]{40}$')
);
CREATE INDEX IF NOT EXISTS protocol_contracts_protocol_idx ON public.protocol_contracts (protocol_id);

GRANT SELECT ON public.protocols, public.protocol_contracts TO authenticated, anon;
GRANT ALL ON public.protocols, public.protocol_contracts TO service_role;

ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Protocols publicly readable"
  ON public.protocols FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Protocol contracts publicly readable"
  ON public.protocol_contracts FOR SELECT TO authenticated, anon USING (true);

-- Seed ONLY Uniswap contracts verified from official Uniswap SDK sdk-core addresses (ChainId.ROBINHOOD = 4663).
-- Source: https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts (+ weth9.ts)
INSERT INTO public.protocols (slug, name, category, website_url, docs_url, source, source_url, verification_status, notes)
VALUES
  (
    'uniswap-v2',
    'Uniswap V2',
    'dex',
    'https://app.uniswap.org/',
    'https://docs.uniswap.org/',
    'uniswap-sdk-core',
    'https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts',
    'verified',
    'Robinhood Chain factory/router from CHAIN_TO_ADDRESSES / V2_* maps in Uniswap sdk-core.'
  ),
  (
    'uniswap-v3',
    'Uniswap V3',
    'dex',
    'https://app.uniswap.org/',
    'https://docs.uniswap.org/',
    'uniswap-sdk-core',
    'https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts',
    'verified',
    'Robinhood Chain V3 core addresses from ROBINHOOD_ADDRESSES in Uniswap sdk-core.'
  ),
  (
    'uniswap-v4',
    'Uniswap V4',
    'dex',
    'https://app.uniswap.org/',
    'https://docs.uniswap.org/',
    'uniswap-sdk-core',
    'https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts',
    'verified',
    'Robinhood Chain V4 addresses from ROBINHOOD_ADDRESSES in Uniswap sdk-core.'
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.protocol_contracts (protocol_id, chain_id, role, address, address_normalized, source, source_url)
SELECT p.id, 4663, c.role, c.address, lower(c.address), 'uniswap-sdk-core', 'https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts'
FROM (VALUES
  ('uniswap-v2', 'v2_factory', '0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f'),
  ('uniswap-v2', 'v2_router', '0x89e5db8b5aa49aa85ac63f691524311aeb649eba'),
  ('uniswap-v3', 'v3_factory', '0x1f7d7550b1b028f7571e69a784071f0205fd2efa'),
  ('uniswap-v3', 'multicall', '0x282a3c4d320cc7f0d5eaf56b8029e4b88338f0a3'),
  ('uniswap-v3', 'quoter', '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7'),
  ('uniswap-v3', 'nonfungible_position_manager', '0x73991a25c818bf1f1128deaab1492d45638de0d3'),
  ('uniswap-v3', 'tick_lens', '0x7dfd4f31be6814d2906bde155c3e1b146eac1468'),
  ('uniswap-v3', 'swap_router_02', '0xcaf681a66d020601342297493863e78c959e5cb2'),
  ('uniswap-v4', 'v4_pool_manager', '0x8366a39cc670b4001a1121b8f6a443a643e40951'),
  ('uniswap-v4', 'v4_position_manager', '0x58daec3116aae6d93017baaea7749052e8a04fa7'),
  ('uniswap-v4', 'v4_state_view', '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b'),
  ('uniswap-v4', 'v4_quoter', '0x8dc178efb8111bb0973dd9d722ebeff267c98f94')
) AS c(slug, role, address)
JOIN public.protocols p ON p.slug = c.slug
ON CONFLICT (chain_id, address_normalized) DO NOTHING;

-- WETH from Uniswap sdk-core weth9.ts for ChainId 4663 (token helper, not a protocol itself — stored as note under v3 for explorer linking)
-- Intentionally NOT invented; verified in https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/entities/weth9.ts
INSERT INTO public.protocol_contracts (protocol_id, chain_id, role, address, address_normalized, source, source_url)
SELECT p.id, 4663, 'weth9', '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', lower('0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'),
       'uniswap-sdk-core', 'https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/entities/weth9.ts'
FROM public.protocols p WHERE p.slug = 'uniswap-v3'
ON CONFLICT (chain_id, address_normalized) DO NOTHING;
