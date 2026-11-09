import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/amphis/PageHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — Amphis" },
      { name: "description", content: "Amphis privacy policy and wallet data practices." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container-page py-12 sm:py-16 prose-invert max-w-3xl">
      <PageHeader title="Privacy" description="Amphis · amphisfi · Your trading reputation." />
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Amphis stores account identity (OAuth subject, username, bio, avatar path), linked wallet
          addresses, indexing progress, detected trades, and derived analytics. Public profiles
          default to public visibility; private profiles are hidden from others via server-side
          rules.
        </p>
        <p>
          <strong class="text-foreground">Wallet privacy:</strong> On-chain activity is public by
          nature. Linking a wallet associates that address with your Amphis profile for analytics.
          Ownership verification uses a signature challenge and is distinct from merely connecting a
          wallet. Unverified wallets are never labeled ownership-verified.
        </p>
        <p>
          We do not sell personal data. Server credentials (Alchemy, Supabase service role) stay on
          the server. You may request account deletion and data export through product settings as
          those flows are completed.
        </p>
        <p>
          Contact for privacy requests: use your Amphis account support channel or the operators
          listed on the public Amphis presence (@amphisfi on X).
        </p>

        <p className="text-xs">
          Also see{" "}
          <Link to="/about" className="text-accent underline">
            About
          </Link>
          ,{" "}
          <Link to="/privacy" className="text-accent underline">
            Privacy
          </Link>
          , and{" "}
          <Link to="/terms" className="text-accent underline">
            Terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
