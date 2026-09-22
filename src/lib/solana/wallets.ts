/**
 * Minimal, read-only Solana wallet detection.
 *
 * We deliberately avoid the heavy wallet-adapter dependency tree for Phase 1.
 * This layer only connects/disconnects and reads the public key. It never
 * signs, sends transactions, or touches private keys.
 */

export type WalletId = "phantom" | "solflare" | "backpack";

export type SolanaProvider = {
  isConnected?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey?: { toString(): string };
  } | void>;
  disconnect: () => Promise<void>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type WalletMeta = {
  id: WalletId;
  name: string;
  installUrl: string;
};

export const SUPPORTED_WALLETS: WalletMeta[] = [
  { id: "phantom", name: "Phantom", installUrl: "https://phantom.app/download" },
  { id: "solflare", name: "Solflare", installUrl: "https://solflare.com/download" },
  { id: "backpack", name: "Backpack", installUrl: "https://backpack.app/download" },
];

type MaybeWindow = Window & {
  phantom?: { solana?: SolanaProvider };
  solana?: SolanaProvider & { isPhantom?: boolean };
  solflare?: SolanaProvider & { isSolflare?: boolean };
  backpack?: SolanaProvider;
};

export function getProvider(id: WalletId): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as MaybeWindow;
  switch (id) {
    case "phantom":
      return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null) ?? null;
    case "solflare":
      return w.solflare?.isSolflare ? w.solflare : (w.solflare ?? null);
    case "backpack":
      return w.backpack ?? null;
    default:
      return null;
  }
}

export function detectInstalled(): WalletId[] {
  return SUPPORTED_WALLETS.filter((w) => getProvider(w.id) !== null).map((w) => w.id);
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Base58 (Solana) address sanity check — no network call, no fabricated data. */
export function isLikelySolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
