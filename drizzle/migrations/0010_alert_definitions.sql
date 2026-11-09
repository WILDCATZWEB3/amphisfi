-- Phase 3: user alert definitions. Evaluation of price alerts needs a worker + price coverage.
-- Wallet-activity alerts can be evaluated on read against indexed trades.

CREATE TABLE IF NOT EXISTS public.alert_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  chain text,
  token_address text,
  target_price_usd numeric,
  direction text,
  label text,
  last_evaluated_at timestamptz,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind IN ('wallet_activity', 'token_price')),
  CHECK (
    (kind = 'wallet_activity' AND wallet_id IS NOT NULL) OR
    (kind = 'token_price' AND chain IS NOT NULL AND token_address IS NOT NULL AND target_price_usd IS NOT NULL AND direction IN ('above', 'below'))
  )
);
CREATE INDEX IF NOT EXISTS alert_definitions_profile ON public.alert_definitions (profile_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_definitions TO authenticated;
GRANT ALL ON public.alert_definitions TO service_role;

ALTER TABLE public.alert_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own alerts readable"
  ON public.alert_definitions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own alerts insert"
  ON public.alert_definitions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own alerts update"
  ON public.alert_definitions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own alerts delete"
  ON public.alert_definitions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
