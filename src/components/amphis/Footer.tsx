import { Link } from "@tanstack/react-router";

import { BrandMark } from "./BrandMark";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border py-10">
      <div className="container-page flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <BrandMark className="h-8 w-11" alt="" />
          <div>
            <p className="text-sm font-medium">Amphis</p>
            <p className="mt-1 text-xs text-muted-foreground">Your trading reputation.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <Link to="/about" className="hover:text-foreground">
            About
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <a
            href="https://x.com/amphisfi"
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            @amphisfi
          </a>
        </div>
      </div>
      <p className="container-page mt-4 text-[11px] text-muted-foreground">
        Analytics only. Not financial advice. Not affiliated with Robinhood.
      </p>
    </footer>
  );
}
