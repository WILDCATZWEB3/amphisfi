import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/amphis/Button";
import { Card, CardHeader } from "@/components/amphis/Card";
import { PageHeader } from "@/components/amphis/PageHeader";
import { WalletAddress } from "@/components/amphis/WalletAddress";
import { WalletButton } from "@/components/amphis/WalletButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/amphis/States";
import { useWallet } from "@/lib/solana/WalletContext";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/me")({
  head: () => ({
    meta: [
      { title: "My Profile — Amphis" },
      {
        name: "description",
        content: "Manage your Amphis trader profile and connected Solana wallet.",
      },
      { property: "og:title", content: "My Profile — Amphis" },
      {
        property: "og:description",
        content: "Manage your Amphis trader profile and connected Solana wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyProfile,
});

function MyProfile() {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [saved, setSaved] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, bio, created_at")
        .eq("wallet_address", address!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setUsername(profileQuery.data?.username ?? "");
    setBio(profileQuery.data?.bio ?? "");
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("No wallet connected");
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            wallet_address: address,
            username: username.trim() || null,
            bio: bio.trim() || null,
          },
          { onConflict: "wallet_address" },
        )
        .select("id")
        .single();
      if (error) throw error;

      const { error: walletError } = await supabase
        .from("wallets")
        .upsert({ profile_id: data.id, address }, { onConflict: "address" });
      if (walletError) throw walletError;
      return data;
    },
    onSuccess: () => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      void queryClient.invalidateQueries({ queryKey: ["profile", address] });
    },
  });

  if (!address) {
    return (
      <div className="container-page py-12 sm:py-16">
        <PageHeader title="My Profile" />
        <div className="mt-10">
          <EmptyState
            title="Connect your wallet to create your Amphis profile."
            description="Amphis reads your wallet address only. No transactions, approvals or signatures are requested."
            action={<WalletButton />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-12 sm:py-16">
      <PageHeader
        title="My Profile"
        description="Your Amphis identity. Trading performance appears only after Amphis indexes verified on-chain data."
      />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Connected wallet" />
          <WalletAddress address={address} full />
          <div className="mt-6">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/trader/$walletAddress" params={{ walletAddress: address }}>
                View public profile
              </Link>
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Profile" description="Public identity shown on your trader page." />
          {profileQuery.isLoading ? (
            <LoadingState label="Loading profile" />
          ) : profileQuery.isError ? (
            <ErrorState
              title="Could not load your profile"
              onRetry={() => void profileQuery.refetch()}
            />
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div>
                <label htmlFor="username" className="text-xs text-muted-foreground">
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={32}
                  placeholder="Not set"
                  className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="bio" className="text-xs text-muted-foreground">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={4}
                  placeholder="Not set"
                  className="mt-1 w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={save.isPending}>
                  {save.isPending ? "Saving" : "Save profile"}
                </Button>
                {saved ? <span className="text-xs text-accent">Saved</span> : null}
                {save.isError ? (
                  <span className="text-xs text-destructive">
                    {(save.error as Error).message}
                  </span>
                ) : null}
              </div>
            </form>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader title="Trading data" />
          <EmptyState
            className="border-0 py-8"
            title="No verified trading data yet."
            description="Amphis has not indexed on-chain activity for this wallet. Nothing shown here is estimated."
          />
        </Card>
      </div>
    </div>
  );
}
