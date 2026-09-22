import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Card, CardHeader } from "@/components/amphis/Card";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { isLikelySolanaAddress, shortenAddress } from "@/lib/solana/wallets";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/trader/$walletAddress")({
  head: ({ params }) => {
    const title = `Trader ${shortenAddress(params.walletAddress, 4)} — Amphis`;
    const description = `Verified Solana trading reputation for ${params.walletAddress}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TraderProfile,
});

const SECTIONS = [
  { title: "Performance", empty: "No verified trading data yet." },
  { title: "Trading activity", empty: "No verified trading data yet." },
  { title: "Risk", empty: "No verified trading data yet." },
  { title: "Reputation", empty: "No verified trading data yet." },
  { title: "Leaderboard position", empty: "No verified trading data yet." },
];

function TraderProfile() {
  const { walletAddress } = Route.useParams();
  const valid = isLikelySolanaAddress(walletAddress);

  const profileQuery = useQuery({
    queryKey: ["profile", walletAddress],
    enabled: valid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, bio, created_at")
        .eq("wallet_address", walletAddress)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!valid) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Invalid wallet address"
          description="This does not look like a Solana wallet address."
        />
      </div>
    );
  }

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="border-b border-border pb-8">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Wallet</p>
        <div className="mt-3">
          <WalletAddress address={walletAddress} full className="max-w-full" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Trader identity" />
          {profileQuery.isLoading ? (
            <LoadingState label="Loading profile" />
          ) : profileQuery.isError ? (
            <ErrorState
              title="Could not load profile"
              description="The profile service is unavailable right now."
              onRetry={() => void profileQuery.refetch()}
            />
          ) : profileQuery.data ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="text-sm">{profileQuery.data.username ?? "Not set"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bio</p>
                <p className="text-sm">{profileQuery.data.bio ?? "Not set"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This wallet has not created an Amphis profile.
            </p>
          )}
        </Card>

        <div className="grid gap-4 lg:col-span-2">
          {SECTIONS.map((s) => (
            <Card key={s.title}>
              <CardHeader title={s.title} />
              <EmptyState className="border-0 py-8" title={s.empty} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
