-- Phase 4: durable worker jobs, admin roles/audit, wallet public contribution flag.
-- Additive only.

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS public_contribute boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.worker_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (kind IN ('wallet_sync', 'price_alerts')),
  CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS worker_jobs_claim_idx
  ON public.worker_jobs (status, run_after, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS worker_jobs_wallet_idx ON public.worker_jobs (wallet_id, created_at DESC);
-- One running sync job per wallet (coordination).
CREATE UNIQUE INDEX IF NOT EXISTS worker_jobs_one_running_sync_per_wallet
  ON public.worker_jobs (wallet_id)
  WHERE kind = 'wallet_sync' AND status = 'running' AND wallet_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  CHECK (role IN ('admin'))
);

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_created ON public.audit_events (created_at DESC);

GRANT SELECT ON public.worker_jobs TO authenticated;
GRANT ALL ON public.worker_jobs, public.admin_roles, public.audit_events TO service_role;
GRANT SELECT ON public.admin_roles TO authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

ALTER TABLE public.worker_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Clients cannot mutate worker jobs or admin tables; service role bypasses RLS.
CREATE POLICY "Admins read worker jobs"
  ON public.worker_jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));
CREATE POLICY "Admins read admin roles"
  ON public.admin_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));
CREATE POLICY "Admins read audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_roles ar WHERE ar.user_id = auth.uid()));
