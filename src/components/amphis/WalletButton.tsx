import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "./Button";
import { useWallet } from "@/lib/solana/WalletContext";
import { SUPPORTED_WALLETS, shortenAddress } from "@/lib/solana/wallets";
import { cn } from "@/lib/utils";

export function WalletButton({ className }: { className?: string }) {
  const { address, connecting, error, installed, connect, disconnect, clearError } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        size="sm"
        variant={address ? "secondary" : "primary"}
        onClick={() => {
          clearError();
          setOpen((v) => !v);
        }}
        disabled={connecting}
      >
        <span className={address ? "font-mono" : undefined}>
          {connecting ? "Connecting" : address ? shortenAddress(address) : "Connect Wallet"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-popover p-2 shadow-xl">
          {address ? (
            <button
              type="button"
              onClick={() => {
                void disconnect();
                setOpen(false);
              }}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
            >
              Disconnect
            </button>
          ) : (
            <div className="space-y-1">
              {SUPPORTED_WALLETS.map((w) => {
                const isInstalled = installed.includes(w.id);
                return isInstalled ? (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      void connect(w.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <span>{w.name}</span>
                    <span className="text-xs text-muted-foreground">Detected</span>
                  </button>
                ) : (
                  <a
                    key={w.id}
                    href={w.installUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
                  >
                    <span>{w.name}</span>
                    <span className="text-xs">Not installed</span>
                  </a>
                );
              })}
              <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                Read-only. Amphis never requests transactions or approvals.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="absolute right-0 mt-2 w-64 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}
