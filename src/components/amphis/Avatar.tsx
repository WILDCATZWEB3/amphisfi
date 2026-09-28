import { useAvatarUrl } from "@/lib/account";
import { cn } from "@/lib/utils";
import { BrandMark } from "./BrandMark";

/** Default Amphis avatar when no PFP is set — the brand mark, never a random avatar. */
export function Avatar({
  path,
  src,
  size = 64,
  className,
}: {
  path?: string | null | undefined;
  src?: string | null | undefined;
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
        <BrandMark className="h-[58%] w-[76%]" alt="" />
      )}
    </div>
  );
}
