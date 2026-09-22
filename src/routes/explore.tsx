import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/amphis/PageHeader";
import { EmptyState } from "@/components/amphis/States";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Traders — Amphis" },
      {
        name: "description",
        content:
          "Discover Solana traders with verified, on-chain performance histories on Amphis.",
      },
      { property: "og:title", content: "Explore Traders — Amphis" },
      {
        property: "og:description",
        content:
          "Discover Solana traders with verified, on-chain performance histories on Amphis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="Explore"
        description="Trader discovery built on verified Solana activity."
      />
      <div className="mt-10">
        <EmptyState
          title="Trader discovery is coming soon."
          description="Amphis only shows traders once their on-chain activity has been indexed and verified. Nothing here is simulated."
        />
      </div>
    </div>
  );
}
