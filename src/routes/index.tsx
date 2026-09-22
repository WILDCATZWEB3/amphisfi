import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/amphis/Button";
import { Card } from "@/components/amphis/Card";
import { WalletButton } from "@/components/amphis/WalletButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Amphis — Your trading reputation." },
      {
        name: "description",
        content:
          "Turn your real Solana trading activity into a reputation you can prove.",
      },
      { property: "og:title", content: "Amphis — Your trading reputation." },
      {
        property: "og:description",
        content:
          "Turn your real Solana trading activity into a reputation you can prove.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const CONCEPTS = [
  { title: "Track", body: "Your verified trading performance." },
  { title: "Compete", body: "Compare your performance with other traders." },
  { title: "Build", body: "Create a public trader reputation." },
];

function Landing() {
  return (
    <div className="container-page">
      <section className="border-b border-border py-20 sm:py-28">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
          Solana-native trader reputation
        </p>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Your trading reputation.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          Turn your real Solana trading activity into a reputation you can prove.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <WalletButton className="w-full sm:w-auto" />
          <Button variant="secondary" size="sm" asChild>
            <Link to="/explore">Explore Traders</Link>
          </Button>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Read-only wallet connection. Amphis never requests transactions, approvals or
          signatures.
        </p>
      </section>

      <section className="grid gap-4 py-16 sm:grid-cols-3 sm:py-20">
        {CONCEPTS.map((c) => (
          <Card key={c.title}>
            <h2 className="text-sm font-semibold tracking-wide uppercase">{c.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{c.body}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
