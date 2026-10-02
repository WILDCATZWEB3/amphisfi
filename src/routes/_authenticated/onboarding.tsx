import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/amphis/Button";
import { ProfileEditor, WalletLinker } from "@/components/amphis/ProfileForms";
import { LoadingState } from "@/components/amphis/States";
import { useMyProfile } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — Amphis" },
      { name: "description", content: "Claim your username, add a picture and verify your Robinhood Chain wallet." },
      { property: "og:title", content: "Set up your profile — Amphis" },
      { property: "og:description", content: "Claim your username, add a picture and verify your Robinhood Chain wallet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const q = useMyProfile(user.id);
  const p = q.data;
  const step = !p?.username ? 1 : !p.wallet_address ? 2 : 3;

  return (
    <div className="container-page flex min-h-[calc(100vh-8rem)] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Step {step} of 3</p>
        {q.isLoading ? (
          <LoadingState label="Loading" />
        ) : step === 1 ? (
          <>
            <h1 className="mt-3 mb-6 text-3xl font-semibold tracking-tight">Claim your username.</h1>
            <ProfileEditor userId={user.id} profile={p} submitLabel="Continue" onSaved={() => void q.refetch()} />
          </>
        ) : step === 2 ? (
          <>
            <h1 className="mt-3 mb-6 text-3xl font-semibold tracking-tight">Verify your wallet.</h1>
            <WalletLinker userId={user.id} linked={p?.wallet_address} onLinked={() => void q.refetch()} />
            <Button variant="ghost" className="mt-3 w-full" onClick={() => navigate({ to: "/me" })}>
              Skip for now
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-3 mb-6 text-3xl font-semibold tracking-tight">You're set, @{p?.username}.</h1>
            <Button className="w-full" onClick={() => navigate({ to: "/me", replace: true })}>
              Go to my profile
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
