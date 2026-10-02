import { getAddress, isAddress } from "viem";

/** Strict EVM address check (accepts any casing; rejects bad checksums in mixed case). */
export function isEvmAddress(value: string): boolean {
  return isAddress(value, { strict: false }) && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** EIP-55 checksum form for display/storage. */
export function toChecksum(value: string): `0x${string}` {
  return getAddress(value.toLowerCase());
}

/** Canonical form for comparisons and uniqueness. */
export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function shortenAddress(address: string, chars = 4): string {
  const head = address.startsWith("0x") ? chars + 2 : chars;
  if (address.length <= head + chars + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-chars)}`;
}
