/**
 * Robinhood Chain mainnet configuration (client-safe; no secrets).
 * The browser only ever sees the public RPC; server indexing reads ROBINHOOD_RPC_URL.
 */
import { defineChain } from "viem";

export const CHAIN_KEY = "robinhood" as const;
export const ROBINHOOD_CHAIN_ID = Number(import.meta.env['VITE_ROBINHOOD_CHAIN_ID'] ?? 4663) || 4663;
export const ROBINHOOD_CHAIN_HEX = `0x${ROBINHOOD_CHAIN_ID.toString(16)}`;
export const ROBINHOOD_PUBLIC_RPC =
  (import.meta.env['VITE_ROBINHOOD_RPC_URL'] as string | undefined) || "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_EXPLORER = "https://robinhoodchain.blockscout.com";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [ROBINHOOD_PUBLIC_RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: ROBINHOOD_EXPLORER } },
});

/** Params for wallet_addEthereumChain when the wallet does not know the network yet. */
export const ADD_CHAIN_PARAMS = {
  chainId: ROBINHOOD_CHAIN_HEX,
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: [ROBINHOOD_EXPLORER],
};
