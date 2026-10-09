"use client";

import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Avatar({
  firstName = "",
  lastName = "",
  fileId,
  className,
  size = "md",
}: {
  firstName?: string;
  lastName?: string;
  fileId?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-lg" };
  const src = fileId ? `/api/files/${fileId}` : undefined;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn("rounded-full object-cover bg-primary-tint", sizes[size], className)}
      />
    );
  }

  return (
    <div className={cn("rounded-full bg-primary text-white flex items-center justify-center font-medium", sizes[size], className)}>
      {getInitials(firstName, lastName)}
    </div>
  );
}
