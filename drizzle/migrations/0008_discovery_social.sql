-- Phase 1: discovery, social graph, watchlists, notifications, profile visibility.
-- Additive only. Does not drop or rewrite existing tables.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_visibility_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_visibility_check
  CHECK (visibility IN ('public', 'private'));

-- Aggregated trader metrics derived from real performance snapshots (never fabricated).
CREATE TABLE IF NOT EXISTS public.trader_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  period text NOT NULL,
  realized_pnl_usd numeric,
  unrealized_pnl_usd numeric,
  total_pnl_usd numeric,
  roi numeric,
  win_rate numeric,
  volume_usd numeric,
  trade_count integer NOT NULL DEFAULT 0,
  priced_trade_count integer NOT NULL DEFAULT 0,
  closed_trade_count integer NOT NULL DEFAULT 0,
  winning_trades integer NOT NULL DEFAULT 0,
  losing_trades integer NOT NULL DEFAULT 0,
  capital_deployed_usd numeric,
  average_trade_usd numeric,
  best_trade_pnl_usd numeric,
  worst_trade_pnl_usd numeric,
  data_completeness text NOT NULL DEFAULT 'insufficient',
  performance_ready boolean NOT NULL DEFAULT false,
  leaderboard_eligible boolean NOT NULL DEFAULT false,
  eligibility_notes text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, period)
);
CREATE INDEX IF NOT EXISTS trader_metrics_period_eligible
  ON public.trader_metrics (period, leaderboard_eligible, realized_pnl_usd DESC NULLS LAST);

-- Durable leaderboard snapshots (optional cache; live queries fall back to trader_metrics / performance).
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  category text NOT NULL,
  methodology text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  entry_count integer NOT NULL DEFAULT 0,
  UNIQUE (period, category, calculated_at)
);

CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.leaderboard_snapshots(id) ON DELETE CASCADE,
  rank integer NOT NULL,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metric_value numeric,
  metric_available boolean NOT NULL DEFAULT false,
  UNIQUE (snapshot_id, rank),
  UNIQUE (snapshot_id, wallet_id)
);
CREATE INDEX IF NOT EXISTS leaderboard_entries_snapshot ON public.leaderboard_entries (snapshot_id, rank);

-- Social follows (profile → profile).
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_profile_id, following_profile_id),
  CHECK (follower_profile_id <> following_profile_id)
);
CREATE INDEX IF NOT EXISTS follows_follower ON public.follows (follower_profile_id);
CREATE INDEX IF NOT EXISTS follows_following ON public.follows (following_profile_id);

-- Watchlists
CREATE TABLE IF NOT EXISTS public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, name)
);

CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id uuid NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  chain text,
  token_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (item_type IN ('wallet', 'trader', 'token', 'protocol')),
  CHECK (
    (item_type = 'wallet' AND wallet_id IS NOT NULL) OR
    (item_type = 'trader' AND profile_id IS NOT NULL) OR
    (item_type = 'token' AND chain IS NOT NULL AND token_address IS NOT NULL) OR
    (item_type = 'protocol')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_wallet_uidx
  ON public.watchlist_items (watchlist_id, wallet_id) WHERE wallet_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_trader_uidx
  ON public.watchlist_items (watchlist_id, profile_id) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_items_token_uidx
  ON public.watchlist_items (watchlist_id, chain, token_address)
  WHERE chain IS NOT NULL AND token_address IS NOT NULL;

-- In-app notifications (basics)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_profile_created
  ON public.notifications (profile_id, created_at DESC);

GRANT SELECT ON public.trader_metrics, public.leaderboard_snapshots, public.leaderboard_entries TO anon, authenticated;
GRANT SELECT ON public.follows TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.watchlists, public.watchlist_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.watchlists, public.watchlist_items TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.trader_metrics, public.leaderboard_snapshots, public.leaderboard_entries,
  public.follows, public.watchlists, public.watchlist_items, public.notifications TO service_role;

ALTER TABLE public.trader_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trader metrics publicly readable"
  ON public.trader_metrics FOR SELECT USING (true);
CREATE POLICY "Leaderboard snapshots publicly readable"
  ON public.leaderboard_snapshots FOR SELECT USING (true);
CREATE POLICY "Leaderboard entries publicly readable"
  ON public.leaderboard_entries FOR SELECT USING (true);

CREATE POLICY "Follows publicly readable"
  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users follow as themselves"
  ON public.follows FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = follower_profile_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "Users unfollow as themselves"
  ON public.follows FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = follower_profile_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Own watchlists readable"
  ON public.watchlists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own watchlists insert"
  ON public.watchlists FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own watchlists update"
  ON public.watchlists FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own watchlists delete"
  ON public.watchlists FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Own watchlist items readable"
  ON public.watchlist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists w
      JOIN public.profiles p ON p.id = w.profile_id
      WHERE w.id = watchlist_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "Own watchlist items insert"
  ON public.watchlist_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.watchlists w
      JOIN public.profiles p ON p.id = w.profile_id
      WHERE w.id = watchlist_id AND p.user_id = auth.uid()
    )
  );
CREATE POLICY "Own watchlist items delete"
  ON public.watchlist_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.watchlists w
      JOIN public.profiles p ON p.id = w.profile_id
      WHERE w.id = watchlist_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Own notifications readable"
  ON public.notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));
CREATE POLICY "Own notifications update"
  ON public.notifications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

-- Hide private profiles from anon/authenticated unless owner.
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Public profiles readable"
  ON public.profiles FOR SELECT
  USING (
    visibility = 'public'
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );
