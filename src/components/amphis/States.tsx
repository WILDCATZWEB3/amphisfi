import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center",
        className,
      )}
    >
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-border px-6 py-16">
      <span className="h-3 w-3 animate-pulse rounded-full bg-accent" aria-hidden />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex h-9 items-center rounded-md border border-border-strong px-4 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
