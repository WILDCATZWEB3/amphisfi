import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/amphis/Avatar";
import { Button } from "@/components/amphis/Button";
import { Card, CardHeader } from "@/components/amphis/Card";
import { PageHeader } from "@/components/amphis/PageHeader";
import { inputCls, ProfileEditor, WalletLinker } from "@/components/amphis/ProfileForms";
import { ErrorState, LoadingState } from "@/components/amphis/States";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/lib/account";
import { WalletActivity } from "@/components/amphis/WalletActivity";
import { TradePerformance } from "@/components/amphis/TradePerformance";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "My Profile — Amphis" },
      { name: "description", content: "Manage your Amphis identity, picture and verified Robinhood Chain wallet." },
      { property: "og:title", content: "My Profile — Amphis" },
      { property: "og:description", content: "Manage your Amphis identity, picture and verified Robinhood Chain wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyProfilePage,
});

function MyProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const q = useMyProfile(user.id);
  const p = q.data;

  if (q.isLoading) return <div className="container-page py-16"><LoadingState label="Loading profile" /></div>;
  if (q.isError)
    return (
      <div className="container-page py-16">
        <ErrorState title="Could not load profile" description="Please try again." onRetry={() => void q.refetch()} />
      </div>
    );

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader title="My Profile" description={user.email ?? ""} />
      <div className="mt-8 flex items-center gap-4">
        <Avatar path={p?.avatar_url} size={72} />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{p?.username ? `@${p.username}` : "No username yet"}</p>
          {p?.bio ? <p className="mt-1 text-sm text-muted-foreground">{p.bio}</p> : null}
          {p?.username ? (
            <Link to="/u/$username" params={{ username: p.username }} className="mt-1 inline-block text-xs text-accent">
              View public profile
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identity" />
          <ProfileEditor userId={user.id} profile={p} />
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Wallet" />
            {p ? (
              <>
                <WalletLinker userId={user.id} linked={p.wallet_address} />
                {p.wallet_address ? <WalletActivity profileId={p.id} /> : null}
                {p.wallet_address ? <div className="mt-4"><TradePerformance address={p.wallet_address} /></div> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Save a username first.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Security" />
            <MfaSetup />
          </Card>
          <Button
            variant="ghost"
            onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/", replace: true }))}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function MfaSetup() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const v = data?.totp.find((f) => f.status === "verified");
    setVerified(Boolean(v));
    setFactorId(v?.id ?? null);
  };
  useEffect(() => {
    void load();
  }, []);

  const start = async () => {
    setError(null);
    setBusy(true);
    const { data: all } = await supabase.auth.mfa.listFactors();
    for (const f of all?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) return setError(error.message);
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  };

  const confirm = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) return setError("Invalid code.");
    setQr(null);
    setCode("");
    void load();
  };

  const remove = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return setError(error.message);
    void load();
  };

  if (verified)
    return (
      <div className="space-y-3">
        <p className="text-sm">Authenticator app is on.</p>
        <Button variant="secondary" size="sm" onClick={() => void remove()} disabled={busy}>Turn off</Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );

  return (
    <div className="space-y-3">
      {qr ? (
        <>
          <p className="text-sm text-muted-foreground">Scan with your authenticator app, then enter the 6-digit code.</p>
          <img src={qr} alt="Authenticator QR code" className="h-40 w-40 rounded-md bg-foreground p-2" />
          <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={inputCls} placeholder="123456" />
          <Button size="sm" onClick={() => void confirm()} disabled={busy || code.length !== 6}>Confirm</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Add an authenticator app as a second sign-in step.</p>
          <Button variant="secondary" size="sm" onClick={() => void start()} disabled={busy}>Set up</Button>
        </>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
