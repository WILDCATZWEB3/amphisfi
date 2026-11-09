/** Create in-app notifications from real events only. Deduped by payload.dedupeKey. */

export type NotifyInput = {
  profileId: string;
  type: "new_follower" | "wallet_sync_complete" | "wallet_sync_failure" | "price_alert";
  title: string;
  body: string;
  dedupeKey: string;
  payload?: Record<string, unknown>;
};

export async function notifyIfEnabled(input: NotifyInput): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("follows,wallet_sync,email")
    .eq("profile_id", input.profileId)
    .maybeSingle();

  const enabled =
    !prefs ||
    (input.type === "new_follower" ? prefs.follows !== false : prefs.wallet_sync !== false); // price_alert + sync share wallet_sync preference until a dedicated column exists
  if (!enabled) return false;

  const { error } = await supabaseAdmin.from("notifications").insert({
    profile_id: input.profileId,
    type: input.type,
    title: input.title,
    body: input.body,
    payload: { ...(input.payload ?? {}), dedupeKey: input.dedupeKey },
  });

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) return false;
    console.log("[notify] insert failed", error.message);
    return false;
  }

  // Optional email channel — off unless prefs.email && provider configured.
  try {
    if (prefs?.email === true) {
      const { emailProviderStatus, sendEmail } = await import("@/lib/email/provider");
      const status = emailProviderStatus();
      if (status.enabled) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("id", input.profileId)
          .maybeSingle();
        if (profile?.user_id) {
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
          const to = userData?.user?.email;
          if (to) {
            await sendEmail({ to, subject: input.title, text: input.body });
          }
        }
      }
    }
  } catch (e) {
    console.log("[notify] email skipped", e instanceof Error ? e.message : e);
  }

  return true;
}
