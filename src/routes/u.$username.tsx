import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Avatar } from "@/components/amphis/Avatar";
import { Card, CardHeader } from "@/components/amphis/Card";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => {
    const title = `@${params.username} — Amphis`;
    const description = `Amphis trader profile of @${params.username}.`;
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
  component: UserProfile,
});

function UserProfile() {
  const { username } = Route.useParams();
  const q = useQuery({
    queryKey: ["profile-by-username", username.toLowerCase()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, bio, avatar_url, wallet_address, created_at")
        .ilike("username", username)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (q.isLoading) return <div className="container-page py-16"><LoadingState label="Loading profile" /></div>;
  if (q.isError)
    return (
      <div className="container-page py-16">
        <ErrorState title="Could not load profile" description="Please try again." onRetry={() => void q.refetch()} />
      </div>
    );
  if (!q.data)
    return (
      <div className="container-page py-16">
        <EmptyState title="Profile not found" description={`No Amphis user named @${username}.`} />
      </div>
    );

  const p = q.data;
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="flex items-center gap-4 border-b border-border pb-8">
        <Avatar path={p.avatar_url} size={80} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">@{p.username}</h1>
          {p.bio ? <p className="mt-1 text-sm text-muted-foreground">{p.bio}</p> : null}
        </div>
      </div>
      <Card className="mt-8">
        <CardHeader title="Verified wallet" />
        {p.wallet_address ? (
          <div className="space-y-2">
            <WalletAddress address={p.wallet_address} full className="max-w-full" />
            <Link to="/trader/$walletAddress" params={{ walletAddress: p.wallet_address }} className="text-xs text-accent">
              View trading profile
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No wallet verified yet.</p>
        )}
      </Card>
    </div>
  );
}
