import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { followProfile, getFollowState, unfollowProfile } from "@/lib/social/follow.functions";
import { useSession } from "@/lib/account";
import { Link } from "@tanstack/react-router";

/** Follow/unfollow a public profile. Counts come from the follows table only. */
export function FollowButton({ profileId }: { profileId: string }) {
  const { user, ready } = useSession();
  const qc = useQueryClient();
  const followFn = useServerFn(followProfile);
  const unfollowFn = useServerFn(unfollowProfile);
  const stateFn = useServerFn(getFollowState);

  const state = useQuery({
    queryKey: ["follow-state", profileId, user?.id],
    enabled: ready && Boolean(user) && Boolean(profileId),
    queryFn: () => stateFn({ data: { profileId } }),
  });

  const mutation = useMutation({
    mutationFn: async (next: "follow" | "unfollow") => {
      if (next === "follow") await followFn({ data: { profileId } });
      else await unfollowFn({ data: { profileId } });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["follow-state", profileId] }),
  });

  if (!ready) return null;
  if (!user) {
    return (
      <Link
        to="/auth"
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
      >
        Sign in to follow
      </Link>
    );
  }

  const following = state.data?.following ?? false;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={mutation.isPending || state.isLoading}
        onClick={() => mutation.mutate(following ? "unfollow" : "follow")}
        className="rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
      >
        {mutation.isPending ? "Saving…" : following ? "Unfollow" : "Follow"}
      </button>
      {state.data ? (
        <p className="text-xs text-muted-foreground">
          {state.data.followersCount} followers · {state.data.followingCount} following
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}
