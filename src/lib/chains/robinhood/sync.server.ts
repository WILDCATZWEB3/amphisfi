/**
 * Robinhood Chain wallet indexer (server-only). Resumable and idempotent.
 *
 * Discovery: ERC-20/721 Transfer logs where the wallet is sender or recipient,
 * scanned in bounded block windows. Forward cursor = last_indexed_block (new
 * activity), backfill cursor = oldest_indexed_block (walks back to genesis).
 * Every discovered transaction is stored with its receipt, logs and token transfers.
 * Plain ETH transfers without logs need an indexed provider and are not discovered here.
 */
import { createPublicClient, erc20Abi, http, pad, type Hex } from "viem";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { robinhoodChain } from "./config";

const CHAIN = "robinhood";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TIME_BUDGET_MS = 20_000;
const MAX_TX_PER_BATCH = 40;
const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(`[rh-sync] ${msg}`, JSON.stringify(extra));

export function rpcEndpoint() {
  return process.env["ROBINHOOD_RPC_URL"] || "https://rpc.mainnet.chain.robinhood.com";
}

function client() {
  return createPublicClient({
    chain: robinhoodChain,
    transport: http(rpcEndpoint(), { batch: { batchSize: 20 }, retryCount: 4, retryDelay: 400, timeout: 15_000 }),
  });
}

type RawLog = { address: string; topics: string[]; data: string; transactionHash: string; logIndex: string; blockNumber: string };

export type SyncResult = {
  status: "completed" | "partial" | "failed";
  processed: number;
  stored: number;
  blocksScanned: number;
  error?: string;
};

export async function syncRobinhoodWallet(walletId: string): Promise<SyncResult> {
  const db = supabaseAdmin;
  const { data: w } = await db.from("wallets")
    .select("id,address,address_normalized,chain,last_indexed_block,oldest_indexed_block,backfill_complete,txs_discovered,txs_stored,blocks_processed")
    .eq("id", walletId).single();
  if (!w || w.chain !== CHAIN) throw new Error("Robinhood Chain wallet not found");
  const addr = (w.address_normalized ?? w.address.toLowerCase()) as Hex;
  const padded = pad(addr, { size: 32 });
  const c = client();
  const started = Date.now();
  await db.from("wallets").update({ sync_status: "syncing", sync_error: null, sync_started_at: new Date().toISOString() }).eq("id", walletId);

  try {
    const head = Number(await c.getBlockNumber());
    let forward = w.last_indexed_block ?? head; // highest block fully scanned
    let backward = w.oldest_indexed_block ?? head + 1; // lowest block fully scanned
    let window = Number(process.env["ROBINHOOD_LOG_BLOCK_RANGE"] ?? 30_000) || 30_000;
    let scanned = 0;
    const hashes = new Map<string, number>();

    const scan = async (from: number, to: number) => {
      const q = (topics: (string | null)[]) =>
        c.request({ method: "eth_getLogs", params: [{ fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics } as never] }) as Promise<RawLog[]>;
      const [a, b] = await Promise.all([q([TRANSFER, padded]), q([TRANSFER, null, padded])]);
      for (const l of [...a, ...b]) hashes.set(l.transactionHash, parseInt(l.blockNumber, 16));
      scanned += to - from + 1;
    };
    const withRange = async (fn: () => Promise<void>) => {
      try { await fn(); return true; } catch (e) {
        const m = e instanceof Error ? e.message : "";
        if (/range|spans|too many|limit/i.test(m) && window > 500) { window = Math.floor(window / 2); return false; }
        throw e;
      }
    };

    // Forward (new blocks), then backfill (older history), within the time budget.
    while (forward < head && Date.now() - started < TIME_BUDGET_MS && hashes.size < MAX_TX_PER_BATCH) {
      const from = forward + 1, to = Math.min(head, forward + window);
      if (await withRange(() => scan(from, to))) forward = to;
    }
    while (!w.backfill_complete && backward > 0 && Date.now() - started < TIME_BUDGET_MS && hashes.size < MAX_TX_PER_BATCH) {
      const to = backward - 1, from = Math.max(0, backward - window);
      if (await withRange(() => scan(from, to))) backward = from;
    }

    let stored = 0;
    for (const hash of hashes.keys()) if (await storeTransaction(c, walletId, addr, hash as Hex)) stored++;

    const backfillDone = w.backfill_complete || backward <= 0;
    const done = backfillDone && forward >= head;
    await db.from("wallets").update({
      last_indexed_block: forward, oldest_indexed_block: Math.max(0, backward), backfill_complete: backfillDone,
      last_indexed_transaction: [...hashes.keys()].pop() ?? undefined,
      txs_discovered: (w.txs_discovered ?? 0) + hashes.size, txs_stored: (w.txs_stored ?? 0) + stored,
      blocks_processed: Number(w.blocks_processed ?? 0) + scanned,
      last_synced_at: new Date().toISOString(), sync_status: done ? "completed" : "partial", sync_error: null,
    }).eq("id", walletId);
    log(done ? "completed" : "progress", { walletId, scanned, found: hashes.size, stored, forward, backward, head });
    return { status: done ? "completed" : "partial", processed: hashes.size, stored, blocksScanned: scanned };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Sync failed";
    const message = /429|rate/i.test(raw) ? "The Robinhood Chain network is rate-limiting requests. Try again shortly." : raw.split("\n")[0]!.slice(0, 300);
    await db.from("wallets").update({ sync_status: "failed", sync_error: message }).eq("id", walletId);
    log("failed", { walletId, raw: raw.slice(0, 500) });
    return { status: "failed", processed: 0, stored: 0, blocksScanned: 0, error: message };
  }
}

const blockTimes = new Map<bigint, string>();

/** Stores one transaction + receipt + logs + token transfers. Returns true if newly linked to the wallet. */
async function storeTransaction(c: ReturnType<typeof client>, walletId: string, wallet: string, hash: Hex): Promise<boolean> {
  const db = supabaseAdmin;
  const [tx, rc] = await Promise.all([c.getTransaction({ hash }), c.getTransactionReceipt({ hash })]);
  let time = blockTimes.get(rc.blockNumber);
  if (!time) {
    const b = await c.getBlock({ blockNumber: rc.blockNumber });
    time = new Date(Number(b.timestamp) * 1000).toISOString();
    blockTimes.set(rc.blockNumber, time);
  }
  const lower = (s?: string | null) => (s ? s.toLowerCase() : null);
  const { data: row, error } = await db.from("evm_transactions").upsert({
    chain: CHAIN, hash: hash.toLowerCase(), block_number: Number(rc.blockNumber), block_hash: rc.blockHash, block_time: time,
    tx_index: rc.transactionIndex, from_address: tx.from.toLowerCase(), to_address: lower(tx.to),
    contract_address: lower(rc.contractAddress), value_wei: tx.value.toString(), nonce: tx.nonce,
    gas_limit: tx.gas.toString(), gas_used: rc.gasUsed.toString(), gas_price_wei: tx.gasPrice?.toString() ?? null,
    effective_gas_price_wei: rc.effectiveGasPrice?.toString() ?? null, status: rc.status,
    method_selector: tx.input.length >= 10 ? tx.input.slice(0, 10) : null, input: tx.input.slice(0, 20_000),
    tx_type: tx.type, log_count: rc.logs.length,
  } as never, { onConflict: "chain,hash" }).select("id").single();
  if (error || !row) throw new Error(`Store failed: ${error?.message}`);

  if (rc.logs.length) {
    const { error: lErr } = await db.from("evm_logs").upsert(rc.logs.map((l) => ({
      chain: CHAIN, transaction_id: row.id, transaction_hash: hash.toLowerCase(), log_index: l.logIndex,
      block_number: Number(rc.blockNumber), address: l.address.toLowerCase(), topic0: l.topics[0] ?? null,
      topics: l.topics as string[], data: l.data,
    })), { onConflict: "chain,transaction_hash,log_index", ignoreDuplicates: true });
    if (lErr) throw new Error(`Log store failed: ${lErr.message}`);
  }

  const transfers = rc.logs.filter((l) => l.topics[0] === TRANSFER && (l.topics.length === 3 || l.topics.length === 4));
  const topicAddr = (t?: string) => (t ? `0x${t.slice(26)}`.toLowerCase() : "");
  if (transfers.length) {
    const tokens = [...new Set(transfers.map((l) => l.address.toLowerCase()))];
    await ensureTokens(c, tokens);
    const { error: tErr } = await db.from("token_transfers").upsert(transfers.map((l) => ({
      chain: CHAIN, transaction_id: row.id, transaction_hash: hash.toLowerCase(), log_index: l.logIndex,
      block_number: Number(rc.blockNumber), block_time: time, token_address: l.address.toLowerCase(),
      standard: l.topics.length === 4 ? "erc721" : "erc20",
      from_address: topicAddr(l.topics[1]), to_address: topicAddr(l.topics[2]),
      amount_raw: l.topics.length === 4 ? "1" : BigInt(l.data === "0x" ? 0 : l.data).toString(),
    })), { onConflict: "chain,transaction_hash,log_index", ignoreDuplicates: true });
    if (tErr) throw new Error(`Transfer store failed: ${tErr.message}`);
  }

  const role = tx.from.toLowerCase() === wallet ? "sender" : lower(tx.to) === wallet ? "recipient" : "token_participant";
  const { data: link } = await db.from("wallet_transactions").upsert(
    { wallet_id: walletId, transaction_id: row.id, block_number: Number(rc.blockNumber), role },
    { onConflict: "wallet_id,transaction_id", ignoreDuplicates: true },
  ).select("id");
  return Boolean(link?.length);
}

/** Reads ERC-20 metadata for unseen tokens. Unreadable fields stay null — never guessed. */
async function ensureTokens(c: ReturnType<typeof client>, tokens: string[]) {
  const { data: known } = await supabaseAdmin.from("evm_tokens").select("address").eq("chain", CHAIN).in("address", tokens);
  const have = new Set((known ?? []).map((k) => k.address));
  const rows = [];
  for (const t of tokens.filter((x) => !have.has(x))) {
    const read = <T,>(fn: "symbol" | "name" | "decimals") =>
      c.readContract({ address: t as Hex, abi: erc20Abi, functionName: fn }).then((v) => v as T).catch(() => null);
    const [symbol, name, decimals] = await Promise.all([read<string>("symbol"), read<string>("name"), read<number>("decimals")]);
    rows.push({ chain: CHAIN, address: t, symbol: symbol?.slice(0, 32) ?? null, name: name?.slice(0, 100) ?? null, decimals: decimals === null ? null : Number(decimals) });
  }
  if (rows.length) await supabaseAdmin.from("evm_tokens").upsert(rows, { onConflict: "chain,address", ignoreDuplicates: true });
}
