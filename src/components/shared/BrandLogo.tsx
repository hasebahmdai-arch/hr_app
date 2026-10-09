import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  /** Image height in pixels; width scales with the logo aspect ratio. */
  height?: number;
  priority?: boolean;
};

export function BrandLogo({ className, height = 32, priority }: BrandLogoProps) {
  const width = Math.round(height * (350 / 83));

  return (
    <Image
      src="/analytico-logo.webp"
      alt="Analytico"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ height, width: "auto" }}
    />
  );
}
