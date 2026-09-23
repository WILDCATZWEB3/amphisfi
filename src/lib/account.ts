import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function sanitizeUsername(v: string) {
  return v.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, ready };
}

export type MyProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  wallet_address: string | null;
};

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, wallet_address")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function isProfileComplete(p: MyProfile | null | undefined) {
  return Boolean(p?.username && p?.wallet_address);
}

/** Avatars live in a private bucket; resolve a short-lived signed URL for display. */
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar", path],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("avatars").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  }).data;
}
