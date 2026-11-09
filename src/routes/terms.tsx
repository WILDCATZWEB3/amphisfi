import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/amphis/PageHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — Amphis" },
      { name: "description", content: "Amphis terms of use and risk disclosures." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="container-page py-12 sm:py-16 prose-invert max-w-3xl">
      <PageHeader title="Terms" description="Amphis · amphisfi · Your trading reputation." />
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          By using Amphis you agree that the product provides informational analytics only. Nothing
          on Amphis is investment, tax, or legal advice. You are solely responsible for your trading
          decisions.
        </p>
        <p>
          <strong className="text-foreground">Risk disclosure:</strong> Digital assets and tokenized
          instruments can lose value rapidly. Indexing may be partial; classifications may be wrong;
          prices may be missing. Do not treat Amphis metrics as brokerage statements or ownership
          guarantees.
        </p>
        <p>
          You must not abuse the service (scraping that harms availability, attempting to write
          forged analytics, impersonation). We may suspend accounts that violate these terms.
        </p>
        <p>
          Amphis is not affiliated with Robinhood. Chain names and trademarks belong to their
          respective owners.
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
