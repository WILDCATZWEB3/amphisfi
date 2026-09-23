import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/amphis/Button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { isProfileComplete, type MyProfile } from "@/lib/account";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Amphis" },
      { name: "description", content: "Create your Amphis identity and start building your verified trading profile." },
      { property: "og:title", content: "Sign in — Amphis" },
      { property: "og:description", content: "Create your Amphis identity and start building your verified trading profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const inputCls =
  "h-11 w-full rounded-md border border-border bg-input px-3 text-sm outline-none focus:ring-1 focus:ring-ring";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"social" | "signin" | "signup" | "mfa">("social");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const route = async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      setMode("mfa");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, bio, wallet_address")
      .eq("user_id", u.user.id)
      .maybeSingle();
    navigate({ to: isProfileComplete(p as MyProfile | null) ? "/me" : "/onboarding", replace: true });
  };

  useEffect(() => {
    void route();
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") void route();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const oauth = (provider: "google" | "apple") =>
    run(async () => {
      const res = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
      if (res.error) throw res.error instanceof Error ? res.error : new Error(String(res.error));
      if (!res.redirected) await route();
    });

  const emailSubmit = () =>
    run(async () => {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        if (!data.session) setNotice("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    });

  const verifyMfa = () =>
    run(async () => {
      const { data: f, error: fe } = await supabase.auth.mfa.listFactors();
      if (fe) throw fe;
      const factor = f.totp.find((x) => x.status === "verified");
      if (!factor) throw new Error("No authenticator found.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
      if (error) throw new Error("Invalid code.");
      await route();
    });

  return (
    <div className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Build your trading reputation.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Create your Amphis identity and connect your Solana wallet to start building your verified trading profile.
        </p>

        <div className="mt-8 space-y-3">
          {mode === "mfa" ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); verifyMfa(); }}>
              <label className="text-xs text-muted-foreground" htmlFor="code">Authenticator code</label>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={inputCls} placeholder="123456" />
              <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Verify</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut().then(() => setMode("social"))}>
                Use another account
              </Button>
            </form>
          ) : mode === "social" ? (
            <>
              <Button className="w-full" onClick={() => oauth("google")} disabled={busy}>Continue with Google</Button>
              <Button variant="secondary" className="w-full" onClick={() => oauth("apple")} disabled={busy}>Continue with Apple</Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode("signin")} disabled={busy}>Continue with email</Button>
            </>
          ) : (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); emailSubmit(); }}>
              <input type="email" required autoComplete="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              <Button type="submit" className="w-full" disabled={busy}>{mode === "signup" ? "Create account" : "Sign in"}</Button>
              <div className="flex justify-between text-xs text-muted-foreground">
                <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
                </button>
                <button type="button" onClick={() => setMode("social")}>Back</button>
              </div>
            </form>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-accent">{notice}</p> : null}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Signing in creates your Amphis account. It does not prove ownership of any Solana wallet — that is verified separately with a wallet signature.
        </p>
      </div>
    </div>
  );
}
