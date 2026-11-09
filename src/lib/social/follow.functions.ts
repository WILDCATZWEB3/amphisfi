import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myProfileId(
  supabase: {
    from: (t: "profiles") => {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  },
  userId: string,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No Amphis profile.");
  return data.id;
}

export const followProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const followerId = await myProfileId(context.supabase as never, context.userId);
    if (followerId === data.profileId) throw new Error("Cannot follow yourself.");

    const { data: target } = await context.supabase
      .from("profiles")
      .select("id,visibility")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!target) throw new Error("Profile not found.");
    if (target.visibility === "private") throw new Error("This profile is private.");

    const { error } = await context.supabase.from("follows").insert({
      follower_profile_id: followerId,
      following_profile_id: data.profileId,
    });
    if (error && !error.message.toLowerCase().includes("duplicate") && error.code !== "23505") {
      throw error;
    }

    try {
      const { notifyIfEnabled } = await import("@/lib/notifications/notify.server");
      await notifyIfEnabled({
        profileId: data.profileId,
        type: "new_follower",
        title: "New follower",
        body: "Someone followed your public Amphis profile.",
        dedupeKey: `follow:${followerId}:${data.profileId}`,
        payload: { followerProfileId: followerId },
      });
    } catch {
      // Notifications optional if migration not applied yet.
    }

    return { ok: true as const };
  });

export const unfollowProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const followerId = await myProfileId(context.supabase as never, context.userId);
    const { error } = await context.supabase
      .from("follows")
      .delete()
      .eq("follower_profile_id", followerId)
      .eq("following_profile_id", data.profileId);
    if (error) throw error;
    return { ok: true as const };
  });

export const getFollowState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ profileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const followerId = await myProfileId(context.supabase as never, context.userId);
    const { data: row } = await context.supabase
      .from("follows")
      .select("id")
      .eq("follower_profile_id", followerId)
      .eq("following_profile_id", data.profileId)
      .maybeSingle();
    const { count: followers } = await context.supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_profile_id", data.profileId);
    const { count: following } = await context.supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_profile_id", data.profileId);
    return {
      following: Boolean(row),
      followersCount: followers ?? 0,
      followingCount: following ?? 0,
    };
  });
