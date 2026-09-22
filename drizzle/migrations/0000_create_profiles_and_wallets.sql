CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL UNIQUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'never_synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_wallet_address ON public.profiles (wallet_address);
CREATE INDEX idx_profiles_username ON public.profiles (username);
CREATE INDEX idx_wallets_profile_id ON public.wallets (profile_id);
CREATE INDEX idx_wallets_address ON public.wallets (address);
CREATE INDEX idx_wallets_sync_status ON public.wallets (sync_status);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.wallets TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.wallets TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can create a profile"
  ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update a profile"
  ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Wallets are publicly readable"
  ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Anyone can create a wallet row"
  ON public.wallets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update a wallet row"
  ON public.wallets FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER wallets_set_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();