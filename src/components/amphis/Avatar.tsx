import { useAvatarUrl } from "@/lib/account";
import { cn } from "@/lib/utils";

/** Default Amphis avatar when no PFP is set — the brand mark, never a random avatar. */
export function Avatar({
  path,
  src,
  size = 64,
  className,
}: {
  path?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const signed = useAvatarUrl(src ? null : path);
  const url = src ?? signed;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        <img src={url} alt="Profile picture" className="h-full w-full object-cover" />
      ) : (
        <span
          className="rounded-sm border border-accent bg-accent/20"
          style={{ width: size * 0.3, height: size * 0.3 }}
          aria-hidden
        />
      )}
    </div>
  );
}
