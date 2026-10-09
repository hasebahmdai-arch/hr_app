"use client";

import { ResponsiveView } from "@/components/shared/ResponsiveView";
import { AppShellWeb } from "@/components/web/layout/AppShellWeb";
import { AppShellMobile } from "@/components/mobile/layout/AppShellMobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResponsiveView
      web={<AppShellWeb>{children}</AppShellWeb>}
      mobile={<AppShellMobile>{children}</AppShellMobile>}
    />
  );
}
