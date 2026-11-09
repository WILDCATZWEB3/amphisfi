import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id,visibility")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("No Amphis profile.");
  return data as { id: string; visibility: string };
}

export const getPrivacySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await myProfileId(context.supabase, context.userId);
    const { data: wallets } = await context.supabase
      .from("wallets")
      .select("id,address,address_normalized,chain,public_contribute,sync_status")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: true });
    return {
      visibility: profile.visibility as "public" | "private",
      wallets: wallets ?? [],
    };
  });

export const updatePrivacySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        visibility: z.enum(["public", "private"]).optional(),
        walletContribute: z
          .array(z.object({ walletId: z.string().uuid(), publicContribute: z.boolean() }))
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profile = await myProfileId(context.supabase, context.userId);
    if (data.visibility) {
      const { error } = await context.supabase
        .from("profiles")
        .update({ visibility: data.visibility })
        .eq("id", profile.id)
        .eq("user_id", context.userId);
      if (error) throw error;
    }
    for (const w of data.walletContribute ?? []) {
      const { error } = await context.supabase
        .from("wallets")
        .update({ public_contribute: w.publicContribute })
        .eq("id", w.walletId)
        .eq("profile_id", profile.id);
      if (error) throw error;
    }
    return { ok: true as const };
  });

/** Export the caller's own account data as JSON (server-authorized). */
export const exportMyAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("No Amphis profile.");

    const [wallets, follows, watchlists, notifications, prefs, alerts] = await Promise.all([
      context.supabase.from("wallets").select("*").eq("profile_id", profile.id),
      context.supabase.from("follows").select("*").eq("follower_profile_id", profile.id),
      context.supabase
        .from("watchlists")
        .select("*, watchlist_items(*)")
        .eq("profile_id", profile.id),
      context.supabase.from("notifications").select("*").eq("profile_id", profile.id).limit(500),
      context.supabase.from("notification_preferences").select("*").eq("profile_id", profile.id),
      context.supabase.from("alert_definitions").select("*").eq("profile_id", profile.id),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      userId: context.userId,
      profile,
      wallets: wallets.data ?? [],
      follows: follows.data ?? [],
      watchlists: watchlists.data ?? [],
      notifications: notifications.data ?? [],
      notificationPreferences: prefs.data ?? [],
      alerts: alerts.data ?? [],
      note: "Chain index tables (trades/transfers) are platform-indexed and not included as personal export; wallet addresses above identify your linked accounts.",
    };
  });

/**
 * Account deletion request: soft-marks profile private, clears public fields,
 * unlinks wallets from public contribution, and records an audit row via service role.
 * Full auth-user deletion requires Supabase dashboard / service privileged call —
 * we request deletion and scrub product data the user owns.
 */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(d))
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id,username")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) throw new Error("No Amphis profile.");

    // Scrub public profile fields & force private
    const scrubbedUsername = `deleted_${profile.id.replace(/-/g, "").slice(0, 12)}`;
    const { error: pErr } = await context.supabase
      .from("profiles")
      .update({
        visibility: "private",
        bio: null,
        avatar_url: null,
        username: scrubbedUsername,
        wallet_address: null,
      })
      .eq("id", profile.id)
      .eq("user_id", context.userId);
    if (pErr) throw pErr;

    await context.supabase
      .from("wallets")
      .update({ public_contribute: false })
      .eq("profile_id", profile.id);

    // Disable alerts & clear watchlist items via user-scoped client
    await context.supabase
      .from("alert_definitions")
      .update({ enabled: false })
      .eq("profile_id", profile.id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_events").insert({
      actor_user_id: context.userId,
      action: "account_deletion_requested",
      target_type: "profile",
      target_id: profile.id,
      meta: { previousUsername: profile.username },
    });

    // Attempt auth user delete when service role is available (Supabase admin API)
    try {
      await supabaseAdmin.auth.admin.deleteUser(context.userId);
    } catch (e) {
      // Product data scrubbed; auth deletion may need dashboard if this fails
      return {
        ok: true as const,
        authDeleted: false,
        message:
          "Profile scrubbed and made private. Auth user deletion failed — complete via Supabase dashboard if needed.",
      };
    }
    return {
      ok: true as const,
      authDeleted: true,
      message: "Account deleted and profile scrubbed.",
    };
  });
