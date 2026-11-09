-- Phase 2: notification preferences + versioned reputation snapshots. Additive only.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  follows boolean NOT NULL DEFAULT true,
  wallet_sync boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reputation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  score_version text NOT NULL,
  score numeric,
  status text NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  methodology text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, score_version)
);
CREATE INDEX IF NOT EXISTS reputation_snapshots_wallet ON public.reputation_snapshots (wallet_id);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT SELECT ON public.reputation_snapshots TO anon, authenticated;
GRANT ALL ON public.reputation_snapshots TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own notification prefs readable"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own notification prefs upsert"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own notification prefs update"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Reputation publicly readable"
  ON public.reputation_snapshots FOR SELECT USING (true);

-- Allow service role inserts for notifications (already ALL); ensure authenticated cannot forge others' notifications.
-- Dedupe helper index: one unread notification of same type+payload fingerprint per profile is handled in app code.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_uidx
  ON public.notifications (profile_id, type, (payload->>'dedupeKey'))
  WHERE read_at IS NULL AND payload ? 'dedupeKey';
