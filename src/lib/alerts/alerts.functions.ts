import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isEvmAddress, normalizeAddress } from "@/lib/evm/address";

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

export const listMyAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { data: alerts, error } = await context.supabase
      .from("alert_definitions")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const now = new Date().toISOString();
    const enriched = [];

    for (const a of alerts ?? []) {
      if (a.kind === "token_price") {
        enriched.push({
          ...a,
          evaluationStatus: "blocked" as const,
          evaluationNote:
            "Token price alert evaluation needs durable worker coverage and verified RH prices. Not evaluated on request timers.",
          triggered: false,
        });
        continue;
      }

      // wallet_activity: real on-read check against indexed trades after last_triggered/created
      if (!a.wallet_id) {
        enriched.push({
          ...a,
          evaluationStatus: "error" as const,
          evaluationNote: "Missing wallet.",
          triggered: false,
        });
        continue;
      }

      const since = a.last_triggered_at ?? a.created_at;
      const { data: trade } = await context.supabase
        .from("evm_trades")
        .select("id,block_time,transaction_hash")
        .eq("wallet_id", a.wallet_id)
        .gt("block_time", since)
        .order("block_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      const triggered = Boolean(trade);
      if (triggered) {
        await context.supabase
          .from("alert_definitions")
          .update({ last_triggered_at: trade!.block_time ?? now, last_evaluated_at: now })
          .eq("id", a.id)
          .eq("profile_id", profileId);
      } else {
        await context.supabase
          .from("alert_definitions")
          .update({ last_evaluated_at: now })
          .eq("id", a.id)
          .eq("profile_id", profileId);
      }

      enriched.push({
        ...a,
        last_evaluated_at: now,
        last_triggered_at: triggered
          ? (trade!.block_time ?? a.last_triggered_at)
          : a.last_triggered_at,
        evaluationStatus: "evaluated" as const,
        evaluationNote: triggered
          ? `New indexed trade since ${since}: ${trade!.transaction_hash}`
          : "No newer indexed trades since last trigger/create.",
        triggered,
      });
    }

    return { alerts: enriched };
  });

export const createAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .discriminatedUnion("kind", [
        z.object({
          kind: z.literal("wallet_activity"),
          walletId: z.string().uuid(),
          label: z.string().max(80).optional(),
        }),
        z.object({
          kind: z.literal("token_price"),
          contractAddress: z.string().min(1),
          targetPriceUsd: z.number().positive(),
          direction: z.enum(["above", "below"]),
          label: z.string().max(80).optional(),
        }),
      ])
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);

    if (data.kind === "wallet_activity") {
      const { data: wallet } = await context.supabase
        .from("wallets")
        .select("id")
        .eq("id", data.walletId)
        .eq("profile_id", profileId)
        .maybeSingle();
      if (!wallet) throw new Error("Wallet must belong to your account.");
      const { error } = await context.supabase.from("alert_definitions").insert({
        profile_id: profileId,
        kind: "wallet_activity",
        wallet_id: wallet.id,
        label: data.label ?? "Wallet activity",
      });
      if (error) throw error;
      return { ok: true as const };
    }

    if (!isEvmAddress(data.contractAddress)) throw new Error("Invalid token address.");
    const addr = normalizeAddress(data.contractAddress);
    const { data: tok } = await context.supabase
      .from("evm_tokens")
      .select("address")
      .eq("chain", "robinhood")
      .eq("address", addr)
      .maybeSingle();
    if (!tok) throw new Error("Token must be in the indexed registry.");

    const { error } = await context.supabase.from("alert_definitions").insert({
      profile_id: profileId,
      kind: "token_price",
      chain: "robinhood",
      token_address: tok.address,
      target_price_usd: data.targetPriceUsd,
      direction: data.direction,
      label: data.label ?? "Token price",
    });
    if (error) throw error;
    return {
      ok: true as const,
      note: "Price alert saved, but continuous evaluation is blocked until a worker + RH price coverage exist.",
    };
  });

export const deleteAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ alertId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("alert_definitions")
      .delete()
      .eq("id", data.alertId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true as const };
  });
