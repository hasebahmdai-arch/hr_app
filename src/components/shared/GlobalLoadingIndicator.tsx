"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const SHOW_DELAY_MS = 180;
const NAV_TIMEOUT_MS = 8_000;

function GlobalLoadingIndicatorInner() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  const [navigating, setNavigating] = useState(false);
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRoute = useRef(routeKey);

  useEffect(() => {
    if (prevRoute.current !== routeKey) {
      prevRoute.current = routeKey;
      setNavigating(false);
      if (navTimer.current) {
        clearTimeout(navTimer.current);
        navTimer.current = null;
      }
    }
  }, [routeKey]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const nextKey = `${url.pathname}?${url.searchParams.toString()}`;
        if (nextKey === routeKey) return;
      } catch {
        return;
      }
      setNavigating(true);
      if (navTimer.current) clearTimeout(navTimer.current);
      navTimer.current = setTimeout(() => setNavigating(false), NAV_TIMEOUT_MS);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, [routeKey]);

  const busy = fetching > 0 || mutating > 0 || navigating;

  useEffect(() => {
    if (busy) {
      if (!showTimer.current) {
        showTimer.current = setTimeout(() => {
          setVisible(true);
          showTimer.current = null;
        }, SHOW_DELAY_MS);
      }
    } else {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
      setVisible(false);
    }
    return () => {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
    };
  }, [busy]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-busy="true" role="status">
      <span className="sr-only">Loading</span>
      <div className="absolute left-0 right-0 top-0 h-0.5 overflow-hidden bg-primary/20">
        <div className="h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-primary" />
      </div>
      <div className="absolute bottom-24 right-4 lg:bottom-6 lg:right-6 flex h-11 w-11 items-center justify-center rounded-full bg-background/95 shadow-elevated border border-border/60">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    </div>
  );
}

export function GlobalLoadingIndicator() {
  return (
    <Suspense fallback={null}>
      <GlobalLoadingIndicatorInner />
    </Suspense>
  );
}
