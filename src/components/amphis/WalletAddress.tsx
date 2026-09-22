import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { shortenAddress } from "@/lib/solana/wallets";

export function WalletAddress({
  address,
  chars = 4,
  full = false,
  className,
}: {
  address: string;
  chars?: number;
  full?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        className={cn(
          "font-mono text-sm text-foreground",
          full ? "break-all" : "truncate",
        )}
        title={address}
      >
        {full ? address : shortenAddress(address, chars)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy full wallet address"
        className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
