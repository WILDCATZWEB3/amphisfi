ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;
ALTER TABLE public.profiles ALTER COLUMN wallet_address DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_wallet_address_uidx ON public.profiles(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx ON public.profiles(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS wallets_address_uidx ON public.wallets(address);

CREATE OR REPLACE FUNCTION public.is_reserved_username(_u text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(_u) = ANY (ARRAY['admin','administrator','amphis','root','system','support','help','api','auth','me','settings','explore','leaderboard','trader','onboarding','login','signin','signup','logout','null','undefined','moderator','staff','official','team','security','www','mail','about','terms','privacy']);
$$;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_not_reserved CHECK (username IS NULL OR NOT public.is_reserved_username(username));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 160);

CREATE OR REPLACE FUNCTION public.check_username(_u text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _u IS NULL OR _u !~ '^[a-z0-9_]{3,20}$' THEN 'invalid'
    WHEN public.is_reserved_username(_u) THEN 'reserved'
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(_u) AND p.user_id IS DISTINCT FROM auth.uid()) THEN 'taken'
    ELSE 'available' END;
$$;
GRANT EXECUTE ON FUNCTION public.check_username(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create a profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can update a profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can create a wallet row" ON public.wallets;
DROP POLICY IF EXISTS "Anyone can update a wallet row" ON public.wallets;

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM anon, authenticated;
GRANT SELECT ON public.profiles, public.wallets TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.profiles, public.wallets TO service_role;

CREATE POLICY "Users create own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND wallet_address IS NULL);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlink own wallets" ON public.wallets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.wallet_address IS DISTINCT FROM OLD.wallet_address THEN
      RAISE EXCEPTION 'wallet_address can only be set through verified wallet linking';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_protect_fields ON public.profiles;
CREATE TRIGGER profiles_protect_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatar own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','gif'));
CREATE POLICY "Avatar own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp','gif'));
CREATE POLICY "Avatar own delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);