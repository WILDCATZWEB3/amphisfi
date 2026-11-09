import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myProfileId(supabase: { from: Function }, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No Amphis profile.");
  return data.id as string;
}

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const limit = data?.limit ?? 30;
    const { data: rows, error } = await context.supabase
      .from("notifications")
      .select("id,type,title,body,payload,read_at,created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const unread = (rows ?? []).filter((n) => !n.read_at).length;
    return { notifications: rows ?? [], unreadCount: unread };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).max(50).optional(),
        all: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const now = new Date().toISOString();
    if (data.all) {
      const { error } = await context.supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("profile_id", profileId)
        .is("read_at", null);
      if (error) throw error;
      return { ok: true as const };
    }
    if (!data.ids?.length) return { ok: true as const };
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("profile_id", profileId)
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true as const };
  });

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("notification_preferences")
      .select("follows,wallet_sync,email,updated_at")
      .eq("profile_id", profileId)
      .maybeSingle();
    return {
      follows: data?.follows ?? true,
      walletSync: data?.wallet_sync ?? true,
      email: data?.email ?? false,
      updatedAt: data?.updated_at ?? null,
    };
  });

export const updateNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        follows: z.boolean().optional(),
        walletSync: z.boolean().optional(),
        email: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { error } = await context.supabase.from("notification_preferences").upsert({
      profile_id: profileId,
      follows: data.follows ?? true,
      wallet_sync: data.walletSync ?? true,
      email: data.email ?? false,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return { ok: true as const };
  });
