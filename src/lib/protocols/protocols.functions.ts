import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { publicRateLimit } from "@/lib/rate-limit/public-middleware";

type ProtocolContract = {
  id: string;
  role: string;
  address: string;
  address_normalized: string;
  chain_id: number;
  source: string;
  source_url: string;
};

type ProtocolRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  website_url: string | null;
  docs_url: string | null;
  source: string;
  source_url: string;
  verification_status: string;
  chain_id: number;
  notes: string | null;
  protocol_contracts: ProtocolContract[];
};

export const listProtocols = createServerFn({ method: "GET" })
  .middleware([publicRateLimit])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: protocols, error } = await supabaseAdmin
      .from("protocols")
      .select(
        "id,slug,name,category,website_url,docs_url,source,source_url,verification_status,chain_id,notes",
      )
      .eq("chain_id", 4663)
      .eq("verification_status", "verified")
      .order("name", { ascending: true });
    if (error) throw error;
    const ids = (protocols ?? []).map((p) => p.id);
    let contracts: Array<ProtocolContract & { protocol_id: string }> = [];
    if (ids.length) {
      const { data: c, error: cErr } = await supabaseAdmin
        .from("protocol_contracts")
        .select("id,protocol_id,role,address,address_normalized,chain_id,source,source_url")
        .in("protocol_id", ids);
      if (cErr) throw cErr;
      contracts = (c ?? []) as Array<ProtocolContract & { protocol_id: string }>;
    }
    const by = new Map<string, ProtocolContract[]>();
    for (const c of contracts) {
      const list = by.get(c.protocol_id) ?? [];
      list.push(c);
      by.set(c.protocol_id, list);
    }
    const out: ProtocolRow[] = (protocols ?? []).map((p) => ({
      ...p,
      protocol_contracts: by.get(p.id) ?? [],
    }));
    return {
      chainId: 4663,
      methodology:
        "Only contracts verified from cited official sources are listed. Unknown protocols are omitted — never invented.",
      protocols: out,
    };
  });

export const getProtocol = createServerFn({ method: "GET" })
  .middleware([publicRateLimit])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("protocols")
      .select(
        "id,slug,name,category,website_url,docs_url,source,source_url,verification_status,chain_id,notes",
      )
      .eq("slug", data.slug)
      .eq("chain_id", 4663)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      return {
        found: false as const,
        reason: "Unknown protocol — not in the verified registry.",
      };
    }
    const { data: contracts, error: cErr } = await supabaseAdmin
      .from("protocol_contracts")
      .select("id,role,address,address_normalized,chain_id,source,source_url")
      .eq("protocol_id", row.id);
    if (cErr) throw cErr;
    const protocol: ProtocolRow = {
      ...row,
      protocol_contracts: (contracts ?? []) as ProtocolContract[],
    };
    return { found: true as const, protocol };
  });
