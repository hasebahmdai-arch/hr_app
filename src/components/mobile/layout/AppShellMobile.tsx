"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { LayoutDashboard, ClipboardList, Users, User, Plus, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_NAV } from "@/lib/navigation";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { NavAttentionDot } from "@/components/shared/requests/RequestTypeHub";
import { useRequestAttentionCount } from "@/hooks/use-request-inbox";
import { useUnreadNotificationsByType } from "@/hooks/use-notifications";
import { BrandLogo } from "@/components/shared/BrandLogo";

const ICONS: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  ClipboardList: <ClipboardList className="h-5 w-5" />,
  CalendarDays: <CalendarDays className="h-5 w-5" />,
  Plus: <Plus className="h-6 w-6" />,
  Users: <Users className="h-5 w-5" />,
  User: <User className="h-5 w-5" />,
};

export function AppShellMobile({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role === "hr" ? "hr" : "employee") as "hr" | "employee";
  const isHR = role === "hr";
  const { data: attention } = useRequestAttentionCount(!!isHR);
  const { requestUnreadTotal } = useUnreadNotificationsByType();
  const requestsAttention = isHR ? (attention?.count ?? 0) > 0 : requestUnreadTotal > 0;

  const navItems = MOBILE_NAV.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });
  const fab = navItems.find((item) => item.isFab);
  const sideItems = navItems.filter((item) => !item.isFab);
  const mid = Math.ceil(sideItems.length / 2);
  const leftItems = sideItems.slice(0, mid);
  const rightItems = sideItems.slice(mid);

  function navActive(href: string) {
    if (href === "/app/dashboard") return pathname === href || pathname.startsWith("/app/dashboard");
    if (href === "/app/requests/leave") return pathname.startsWith("/app/requests/leave");
    if (href === "/app/requests") return pathname.startsWith("/app/requests");
    return pathname.startsWith(href);
  }

  function NavLink({
    href,
    label,
    icon,
  }: {
    href: string;
    label: string;
    icon: string;
  }) {
    const active = navActive(href);
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        {ICONS[icon]}
        <span className="text-xs truncate max-w-full">{label}</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 h-14 border-b bg-white flex items-center justify-between px-4">
        <Link href="/app/dashboard" className="flex items-center" aria-label="Analytico HR">
          <BrandLogo height={24} className="rounded" />
        </Link>
        <NotificationBell />
      </header>
      <main className="flex-1 p-4 overflow-y-auto">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white safe-area-pb">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end h-16 px-1">
          <div className="flex items-center justify-evenly h-16 min-w-0">
            {leftItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </div>

          {fab && (
            <Link
              href="/app/requests"
              className="relative flex flex-col items-center -mt-6 w-[4.5rem] shrink-0"
              aria-label="Requests"
            >
              <div className="h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                {ICONS[fab.icon]}
              </div>
              <NavAttentionDot show={requestsAttention} className="absolute top-0 right-1" />
              <span className="text-xs mt-1 text-muted-foreground">{fab.label}</span>
            </Link>
          )}

          <div className="flex items-center justify-evenly h-16 min-w-0">
            {rightItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
