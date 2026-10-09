"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

export { useMediaQuery };

export function ResponsiveView({ web, mobile }: { web: React.ReactNode; mobile: React.ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{isDesktop ? web : mobile}</>;
}
