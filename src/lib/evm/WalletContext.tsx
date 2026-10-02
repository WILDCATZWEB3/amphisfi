/**
 * Non-custodial EVM wallet connection (EIP-1193 + EIP-6963 discovery).
 * Works with MetaMask, Coinbase Wallet, Robinhood Wallet and any injected EVM wallet.
 * Connecting never requests a transaction. A message signature is only requested
 * by the explicit wallet-verification flow.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ADD_CHAIN_PARAMS, ROBINHOOD_CHAIN_HEX, ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood/config";
import { toChecksum } from "./address";

const STORAGE_KEY = "amphis.evm-wallet";

export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, h: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, h: (...a: unknown[]) => void) => void;
};
export type DetectedWallet = { id: string; name: string; icon?: string; provider: Eip1193 };

export const INSTALL_LINKS = [
  { name: "MetaMask", url: "https://metamask.io/download" },
  { name: "Coinbase Wallet", url: "https://www.coinbase.com/wallet/downloads" },
  { name: "Robinhood Wallet", url: "https://robinhood.com/web3-wallet" },
];

type WalletState = {
  address: string | null;
  chainId: number | null;
  wrongNetwork: boolean;
  walletName: string | null;
  connecting: boolean;
  switching: boolean;
  error: string | null;
  wallets: DetectedWallet[];
  connect: (id: string) => Promise<void>;
  disconnect: () => Promise<void>;
  switchToRobinhood: () => Promise<void>;
  signMessage: (message: string) => Promise<`0x${string}`>;
  clearError: () => void;
};

const Ctx = createContext<WalletState | null>(null);

function friendly(err: unknown, fallback: string): string {
  const e = err as { code?: number; message?: string } | undefined;
  if (e?.code === 4001 || /user rejected|denied/i.test(e?.message ?? "")) return "Request rejected in your wallet.";
  if (e?.code === -32002) return "Your wallet already has a pending request. Open it to continue.";
  return e?.message ? e.message.slice(0, 200) : fallback;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EIP-6963 discovery, with window.ethereum as a fallback for older wallets / in-app browsers.
  useEffect(() => {
    const found = new Map<string, DetectedWallet>();
    const push = () => setWallets([...found.values()]);
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent).detail as { info: { rdns?: string; uuid: string; name: string; icon?: string }; provider: Eip1193 };
      const id = d.info.rdns || d.info.uuid;
      found.set(id, { id, name: d.info.name, provider: d.provider, ...(d.info.icon ? { icon: d.info.icon } : {}) });
      push();
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const t = window.setTimeout(() => {
      const eth = (window as unknown as { ethereum?: Eip1193 & { isMetaMask?: boolean; isCoinbaseWallet?: boolean } }).ethereum;
      if (found.size === 0 && eth) {
        const name = eth.isCoinbaseWallet ? "Coinbase Wallet" : eth.isMetaMask ? "MetaMask" : "Browser wallet";
        found.set("injected", { id: "injected", name, provider: eth });
        push();
      }
    }, 500);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      window.clearTimeout(t);
    };
  }, []);

  const active = wallets.find((w) => w.id === activeId) ?? null;

  // Silent restore after refresh: eth_accounts never prompts.
  useEffect(() => {
    if (activeId) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const w = stored ? wallets.find((x) => x.id === stored) : null;
    if (!w) return;
    let cancelled = false;
    void (async () => {
      try {
        const accts = (await w.provider.request({ method: "eth_accounts" })) as string[];
        if (cancelled || !accts?.[0]) return;
        const cid = (await w.provider.request({ method: "eth_chainId" })) as string;
        setActiveId(w.id);
        setAddress(toChecksum(accts[0]));
        setChainId(parseInt(cid, 16));
      } catch {
        /* stay disconnected */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallets, activeId]);

  // Account / chain changes from the wallet.
  useEffect(() => {
    const p = active?.provider;
    if (!p?.on) return;
    const onAccounts = (...a: unknown[]) => {
      const list = a[0] as string[] | undefined;
      if (list?.[0]) setAddress(toChecksum(list[0]));
      else {
        setAddress(null);
        setChainId(null);
        setActiveId(null);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };
    const onChain = (...a: unknown[]) => setChainId(parseInt(String(a[0]), 16));
    p.on("accountsChanged", onAccounts);
    p.on("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, [active]);

  const connect = useCallback(
    async (id: string) => {
      setError(null);
      const w = wallets.find((x) => x.id === id);
      if (!w) return setError("That wallet is not available in this browser.");
      setConnecting(true);
      try {
        const accts = (await w.provider.request({ method: "eth_requestAccounts" })) as string[];
        if (!accts?.[0]) throw new Error("The wallet did not share an account.");
        const cid = (await w.provider.request({ method: "eth_chainId" })) as string;
        setActiveId(w.id);
        setAddress(toChecksum(accts[0]));
        setChainId(parseInt(cid, 16));
        window.localStorage.setItem(STORAGE_KEY, w.id);
      } catch (err) {
        setError(friendly(err, "Wallet connection failed."));
      } finally {
        setConnecting(false);
      }
    },
    [wallets],
  );

  const disconnect = useCallback(async () => {
    try {
      await active?.provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {
      /* not all wallets support revoking; local state is cleared regardless */
    }
    setAddress(null);
    setChainId(null);
    setActiveId(null);
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, [active]);

  const switchToRobinhood = useCallback(async () => {
    if (!active) return;
    setError(null);
    setSwitching(true);
    try {
      await active.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ROBINHOOD_CHAIN_HEX }] });
    } catch (err) {
      const code = (err as { code?: number; data?: { originalError?: { code?: number } } })?.code;
      const inner = (err as { data?: { originalError?: { code?: number } } })?.data?.originalError?.code;
      if (code === 4902 || inner === 4902) {
        try {
          await active.provider.request({ method: "wallet_addEthereumChain", params: [ADD_CHAIN_PARAMS] });
        } catch (e2) {
          setError(friendly(e2, "Add Robinhood Chain manually: chain ID 4663, RPC https://rpc.mainnet.chain.robinhood.com"));
        }
      } else {
        setError(friendly(err, "Your wallet could not switch networks. Add Robinhood Chain (chain ID 4663) manually."));
      }
    } finally {
      try {
        const cid = (await active.provider.request({ method: "eth_chainId" })) as string;
        setChainId(parseInt(cid, 16));
      } catch {
        /* ignore */
      }
      setSwitching(false);
    }
  }, [active]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!active || !address) throw new Error("Connect a wallet first.");
      try {
        return (await active.provider.request({ method: "personal_sign", params: [message, address] })) as `0x${string}`;
      } catch (err) {
        throw new Error(friendly(err, "Signing failed."));
      }
    },
    [active, address],
  );

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      wrongNetwork: Boolean(address) && chainId !== ROBINHOOD_CHAIN_ID,
      walletName: active?.name ?? null,
      connecting,
      switching,
      error,
      wallets,
      connect,
      disconnect,
      switchToRobinhood,
      signMessage,
      clearError: () => setError(null),
    }),
    [address, chainId, active, connecting, switching, error, wallets, connect, disconnect, switchToRobinhood, signMessage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWallet must be used within WalletProvider");
  return c;
}
