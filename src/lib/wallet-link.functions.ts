import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_AGE_MS = 10 * 60 * 1000;

/** The exact text the wallet signs. Contains no secrets; nothing is stored. */
export function buildLinkMessage(userId: string, address: string, issuedAt: string) {
  return [
    "Amphis wallet link",
    "",
    "Sign this message to prove you own this wallet.",
    "This is free, sends no transaction and grants no approvals.",
    "",
    "Network: Robinhood Chain (4663)",
    `Account: ${userId}`,
    `Wallet: ${address}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

export const linkWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        issuedAt: z.string().datetime(),
        signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createPublicClient, http, getAddress } = await import("viem");
    const { robinhoodChain } = await import("@/lib/chains/robinhood/config");

    const age = Date.now() - new Date(data.issuedAt).getTime();
    if (age < -60_000 || age > MAX_AGE_MS) throw new Error("Signature expired. Please try again.");

    const address = getAddress(data.address.toLowerCase());
    const normalized = address.toLowerCase();
    const client = createPublicClient({
      chain: robinhoodChain,
      transport: http(process.env["ROBINHOOD_RPC_URL"] || "https://rpc.mainnet.chain.robinhood.com"),
    });
    // Supports regular wallets and smart-contract wallets (ERC-1271).
    const ok = await client
      .verifyMessage({
        address,
        message: buildLinkMessage(context.userId, data.address, data.issuedAt),
        signature: data.signature as `0x${string}`,
      })
      .catch(() => false);
    if (!ok) throw new Error("Signature does not match this wallet.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) throw new Error("Create your Amphis profile first.");

    const { data: existing } = await supabaseAdmin
      .from("wallets").select("id,profile_id").eq("chain", "robinhood").eq("address_normalized", normalized).maybeSingle();
    if (existing && existing.profile_id !== profile.id) {
      throw new Error("This wallet is already linked to another Amphis account.");
    }

    await supabaseAdmin.from("wallets").update({ is_primary: false }).eq("profile_id", profile.id).eq("chain", "robinhood");
    if (existing) {
      await supabaseAdmin.from("wallets").update({ is_primary: true, ownership_verified: true }).eq("id", existing.id);
    } else {
      const { error } = await supabaseAdmin.from("wallets").insert({
        profile_id: profile.id, chain: "robinhood", address, address_normalized: normalized,
        is_primary: true, ownership_verified: true,
      });
      if (error) throw new Error("Could not link wallet.");
    }

    const { error: uErr } = await supabaseAdmin.from("profiles").update({ wallet_address: address }).eq("id", profile.id);
    if (uErr) throw new Error("Could not update profile wallet.");
    return { ok: true, address };
  });
