import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "./Button";
import { INSTALL_LINKS, useWallet } from "@/lib/evm/WalletContext";
import { shortenAddress } from "@/lib/evm/address";
import { cn } from "@/lib/utils";

export function WalletButton({ className }: { className?: string }) {
  const { address, wrongNetwork, connecting, switching, error, wallets, walletName, connect, disconnect, switchToRobinhood, clearError } =
    useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const item = "w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        size="sm"
        variant={address && !wrongNetwork ? "secondary" : "primary"}
        onClick={() => {
          clearError();
          setOpen((v) => !v);
        }}
        disabled={connecting || switching}
      >
        <span className={address && !wrongNetwork ? "font-mono" : undefined}>
          {connecting ? "Connecting" : switching ? "Switching" : address ? (
            wrongNetwork ? (<>Switch<span className="hidden min-[380px]:inline"> network</span></>) : shortenAddress(address)
          ) : (
            <>Connect<span className="hidden min-[380px]:inline"> wallet</span></>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2 shadow-xl">
          {address ? (
            <div className="space-y-1">
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground">{walletName ?? "Wallet"}</p>
                <p className="mt-0.5 font-mono text-sm">{shortenAddress(address)}</p>
                <p className={cn("mt-1 text-xs", wrongNetwork ? "text-destructive" : "text-muted-foreground")}>
                  {wrongNetwork ? "Wrong network" : "Robinhood Chain"}
                </p>
              </div>
              {wrongNetwork ? (
                <button type="button" className={item} onClick={() => { void switchToRobinhood(); setOpen(false); }}>
                  Switch to Robinhood Chain
                </button>
              ) : null}
              <button
                type="button"
                className={item}
                onClick={() => {
                  void navigator.clipboard.writeText(address).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? "Copied" : "Copy address"}
              </button>
              <button type="button" className={item} onClick={() => { void disconnect(); setOpen(false); }}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {wallets.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => { void connect(w.id); setOpen(false); }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {w.icon ? <img src={w.icon} alt="" className="h-4 w-4 shrink-0 rounded-sm" /> : null}
                    <span className="truncate">{w.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">Detected</span>
                </button>
              ))}
              {wallets.length === 0 ? (
                <>
                  <p className="px-3 pt-1 pb-1 text-xs text-muted-foreground">No EVM wallet found in this browser.</p>
                  {INSTALL_LINKS.map((l) => (
                    <a key={l.name} href={l.url} target="_blank" rel="noreferrer noopener"
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary">
                      <span>{l.name}</span>
                      <span className="text-xs">Install</span>
                    </a>
                  ))}
                </>
              ) : null}
              <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                Read-only. Amphis never requests transactions or approvals.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
