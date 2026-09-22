import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  detectInstalled,
  getProvider,
  SUPPORTED_WALLETS,
  type WalletId,
} from "./wallets";

const STORAGE_KEY = "amphis.wallet";

type WalletState = {
  address: string | null;
  walletId: WalletId | null;
  connecting: boolean;
  error: string | null;
  installed: WalletId[];
  connect: (id: WalletId) => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<WalletId | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<WalletId[]>([]);

  // Detect wallets only in the browser, after hydration.
  useEffect(() => {
    const scan = () => setInstalled(detectInstalled());
    scan();
    const timer = window.setTimeout(scan, 800);
    return () => window.clearTimeout(timer);
  }, []);

  // Silent reconnect to a previously approved wallet (no prompt, read-only).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as WalletId | null;
    if (!stored) return;
    const provider = getProvider(stored);
    if (!provider) return;
    let cancelled = false;
    provider
      .connect({ onlyIfTrusted: true })
      .then((res) => {
        if (cancelled) return;
        const key = res?.publicKey?.toString() ?? provider.publicKey?.toString();
        if (key) {
          setAddress(key);
          setWalletId(stored);
        }
      })
      .catch(() => {
        /* not trusted yet — stay disconnected */
      });
    return () => {
      cancelled = true;
    };
  }, [installed.length]);

  // React to wallet-side account changes / disconnects.
  useEffect(() => {
    if (!walletId) return;
    const provider = getProvider(walletId);
    if (!provider?.on) return;

    const onDisconnect = () => {
      setAddress(null);
      setWalletId(null);
      window.localStorage.removeItem(STORAGE_KEY);
    };
    const onAccountChanged = (...args: unknown[]) => {
      const pk = args[0] as { toString(): string } | null | undefined;
      if (pk) setAddress(pk.toString());
      else onDisconnect();
    };

    provider.on("disconnect", onDisconnect);
    provider.on("accountChanged", onAccountChanged);
    return () => {
      const remove = provider.off ?? provider.removeListener;
      remove?.call(provider, "disconnect", onDisconnect);
      remove?.call(provider, "accountChanged", onAccountChanged);
    };
  }, [walletId]);

  const connect = useCallback(async (id: WalletId) => {
    setError(null);
    const provider = getProvider(id);
    const meta = SUPPORTED_WALLETS.find((w) => w.id === id);
    if (!provider) {
      setError(`${meta?.name ?? "This wallet"} is not installed in this browser.`);
      return;
    }
    setConnecting(true);
    try {
      const res = await provider.connect();
      const key = res?.publicKey?.toString() ?? provider.publicKey?.toString();
      if (!key) throw new Error("Wallet did not return a public key.");
      setAddress(key);
      setWalletId(id);
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wallet connection failed.";
      setError(/user rejected|4001/i.test(message) ? "Connection request rejected." : message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = walletId ? getProvider(walletId) : null;
    try {
      await provider?.disconnect();
    } catch {
      /* ignore — we clear local state regardless */
    }
    setAddress(null);
    setWalletId(null);
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, [walletId]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      walletId,
      connecting,
      error,
      installed,
      connect,
      disconnect,
      clearError: () => setError(null),
    }),
    [address, walletId, connecting, error, installed, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
