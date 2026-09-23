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
        address: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
        issuedAt: z.string().datetime(),
        signature: z.string().min(40).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ default: nacl }, { default: bs58 }] = await Promise.all([
      import("tweetnacl"),
      import("bs58"),
    ]);

    const age = Date.now() - new Date(data.issuedAt).getTime();
    if (age < -60_000 || age > MAX_AGE_MS) throw new Error("Signature expired. Please try again.");

    let pubkey: Uint8Array;
    let sig: Uint8Array;
    try {
      pubkey = bs58.decode(data.address);
      sig = bs58.decode(data.signature);
    } catch {
      throw new Error("Invalid wallet address or signature.");
    }
    if (pubkey.length !== 32 || sig.length !== 64) throw new Error("Invalid wallet address or signature.");

    const message = new TextEncoder().encode(
      buildLinkMessage(context.userId, data.address, data.issuedAt),
    );
    if (!nacl.sign.detached.verify(message, sig, pubkey)) {
      throw new Error("Signature does not match this wallet.");
    }

    // Ownership proven — privileged write so clients can never write wallet rows directly.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (pErr) throw new Error("Could not load your profile.");
    if (!profile) throw new Error("Create your Amphis profile first.");

    const { data: existing } = await supabaseAdmin
      .from("wallets")
      .select("profile_id")
      .eq("address", data.address)
      .maybeSingle();
    if (existing && existing.profile_id !== profile.id) {
      throw new Error("This wallet is already linked to another Amphis account.");
    }

    if (!existing) {
      const { error } = await supabaseAdmin
        .from("wallets")
        .insert({ profile_id: profile.id, address: data.address });
      if (error) throw new Error("Could not link wallet.");
    }

    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ wallet_address: data.address })
      .eq("id", profile.id);
    if (uErr) throw new Error("Could not update profile wallet.");

    return { ok: true, address: data.address };
  });
