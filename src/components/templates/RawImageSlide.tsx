import Image from "next/image";
import { cn } from "@/lib/utils";

/** "Eigen foto's" mode: renders one photo as-is, no template overlay. Same aspect-square footprint as a compiled template. */
export function RawImageSlide({ imageUrl, className }: { imageUrl?: string; className?: string }) {
  return (
    <div className={cn("relative aspect-square w-full bg-neutral-100", className)}>
      {imageUrl && <Image src={imageUrl} alt="" fill sizes="400px" className="object-cover" />}
    </div>
  );
}
