/** Create in-app notifications from real events only. Deduped by payload.dedupeKey. */

export type NotifyInput = {
  profileId: string;
  type: "new_follower" | "wallet_sync_complete" | "wallet_sync_failure";
  title: string;
  body: string;
  dedupeKey: string;
  payload?: Record<string, unknown>;
};

export async function notifyIfEnabled(input: NotifyInput): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: prefs } = await supabaseAdmin
    .from("notification_preferences")
    .select("follows,wallet_sync")
    .eq("profile_id", input.profileId)
    .maybeSingle();

  const enabled =
    !prefs ||
    (input.type === "new_follower" ? prefs.follows !== false : prefs.wallet_sync !== false);
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
  return true;
}
