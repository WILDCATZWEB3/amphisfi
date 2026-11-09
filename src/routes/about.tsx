import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/amphis/PageHeader";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Amphis" },
      {
        name: "description",
        content: "What Amphis is: Robinhood Chain trading analytics and reputation.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container-page py-12 sm:py-16 prose-invert max-w-3xl">
      <PageHeader title="About" description="Amphis · amphisfi · Your trading reputation." />
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Amphis is a Robinhood Chain–native trading analytics and trader reputation product. It
          indexes real on-chain activity, detects swaps where evidence supports it, prices trades
          when a verified source covers the asset, and computes FIFO cost basis and performance
          metrics from that evidence.
        </p>
        <p>
          Amphis is <strong class="text-foreground">not</strong> a broker, custodian, or execution
          venue. It does not sign or broadcast transactions for you. It is{" "}
          <strong class="text-foreground">
            not affiliated with, endorsed by, or partnered with Robinhood Markets, Inc.
          </strong>{" "}
          or its affiliates unless a separate written agreement exists.
        </p>
        <p>
          <strong class="text-foreground">Data sources:</strong> Robinhood Chain RPC via Alchemy
          (when configured), DefiLlama historical/current prices where coverage exists, and
          user-provided profile data (username, bio, avatar). Missing prices are shown as
          unavailable — never invented as zero.
        </p>
        <p>
          <strong class="text-foreground">Methodology:</strong> Trade detection links to transaction
          hashes and logs. Cost basis uses first-in, first-out (FIFO). Leaderboards exclude wallets
          with incomplete indexing or insufficient price coverage. Reputation v1 is explainable,
          versioned, and requires minimum history.
        </p>
        <p>
          <strong class="text-foreground">Risk:</strong> Blockchain analytics can be incomplete.
          Past performance is not a guarantee of future results. Tokens, including tokenized assets,
          involve substantial risk of loss.
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
