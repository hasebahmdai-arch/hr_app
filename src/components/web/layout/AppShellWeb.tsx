"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  ChevronDown,
  Search,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WEB_NAV, ADMIN_NAV } from "@/lib/navigation";
import { Avatar } from "@/components/shared/Avatar";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { NavAttentionDot } from "@/components/shared/requests/RequestTypeHub";
import { useProfile } from "@/hooks/use-profile";
import { useRequestAttentionCount } from "@/hooks/use-request-inbox";
import { useUnreadNotificationsByType } from "@/hooks/use-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useState } from "react";

const ICONS: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
};

export function AppShellWeb({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isHR = session?.user?.role === "hr";
  const { data: profile } = useProfile();
  const { data: attention } = useRequestAttentionCount(!!isHR);
  const { byType, requestUnreadTotal } = useUnreadNotificationsByType();
  const [search, setSearch] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(pathname.startsWith("/app/requests"));
  const router = useRouter();
  const emp = profile?.employee;
  const requestsAttention = isHR ? (attention?.count ?? 0) > 0 : requestUnreadTotal > 0;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) router.push(`/app/people?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r bg-white flex flex-col shrink-0">
        <div className="h-16 flex items-center px-5 border-b">
          <Link href="/app/dashboard" className="flex items-center" aria-label="Analytico HR">
            <BrandLogo height={28} className="rounded" />
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {WEB_NAV.map((item) => {
            if (item.href === "/app/people" && !isHR) return null;
            if ("children" in item && item.children && !isHR) {
              const active = pathname.startsWith("/app/requests");
              return (
                <div key={item.href}>
                  <button
                    type="button"
                    onClick={() => setRequestsOpen(!requestsOpen)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active ? "bg-primary text-white" : "text-foreground hover:bg-muted-bg"
                    )}
                  >
                    {ICONS[item.icon]}
                    {item.label}
                    <NavAttentionDot show={requestsAttention} className={active ? "bg-white" : undefined} />
                    <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", requestsOpen && "rotate-180")} />
                  </button>
                  {requestsOpen && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const typeSlug = child.href.split("/").pop() ?? "";
                        const hasDot = (byType[typeSlug as keyof typeof byType] ?? 0) > 0;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                              pathname === child.href ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted-bg"
                            )}
                          >
                            {child.label}
                            <NavAttentionDot show={hasDot} className={pathname === child.href ? "bg-white" : undefined} />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            if ("children" in item && item.children && isHR) {
              const active = pathname.startsWith("/app/requests");
              return (
                <Link
                  key={item.href}
                  href="/app/requests"
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    active ? "bg-primary text-white" : "text-foreground hover:bg-muted-bg"
                  )}
                >
                  {ICONS[item.icon]}
                  {item.label}
                  <NavAttentionDot show={requestsAttention} className={active ? "bg-white" : undefined} />
                </Link>
              );
            }
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active ? "bg-primary text-white" : "text-foreground hover:bg-muted-bg"
                )}
              >
                {ICONS[item.icon]}
                {item.label}
              </Link>
            );
          })}
          {isHR && (
            <>
              <div className="pt-4 pb-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Admin</div>
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith(item.href) ? "bg-primary text-white" : "text-foreground hover:bg-muted-bg"
                  )}
                >
                  <Building2 className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-white shadow-sm flex items-center justify-between px-6 gap-4">
          {isHR ? (
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search people..."
                  className="pl-9"
                />
              </div>
            </form>
          ) : (
            <div className="flex-1" />
          )}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2 p-1 rounded-md hover:bg-muted-bg">
                  <Avatar firstName={emp?.firstName} lastName={emp?.lastName} fileId={emp?.avatarFileId} size="sm" />
                  <span className="text-sm font-medium hidden md:inline">{emp?.firstName}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/app/profile"><Settings className="h-4 w-4 mr-2 inline" />Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut className="h-4 w-4 mr-2 inline" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
