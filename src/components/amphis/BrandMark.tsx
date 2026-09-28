import logoAsset from "@/assets/amphis-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  alt = "Amphis",
}: {
  className?: string;
  alt?: string;
}) {
  return <img src={logoAsset.url} alt={alt} className={cn("object-contain", className)} />;
}