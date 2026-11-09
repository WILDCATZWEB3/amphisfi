import type { Json } from "@/integrations/supabase/types";
/** Server-side admin gate: admin_roles table OR AMPHIS_ADMIN_USER_IDS env allowlist. */

export function adminAllowlist(): Set<string> {
  const raw = process.env["AMPHIS_ADMIN_USER_IDS"] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function assertAdmin(userId: string) {
  if (adminAllowlist().has(userId)) return true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_roles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return true;
}

export async function writeAudit(input: {
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Json;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_events").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    meta: input.meta ?? {},
  });
}
