"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationBell() {
  const router = useRouter();
  const { data: notifications } = useNotifications(1, true);
  const markRead = useMarkNotificationsRead();
  const unreadCount = notifications?.total ?? 0;

  async function handleClick(id: string, href?: string) {
    await markRead.mutateAsync({ ids: [id] });
    if (href) router.push(href);
  }

  async function handleMarkAll() {
    await markRead.mutateAsync({ markAllRead: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="relative p-2 rounded-md hover:bg-muted-bg" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {notifications?.items.length ? (
          <>
            {notifications.items.slice(0, 8).map((n) => (
              <DropdownMenuItem
                key={n._id}
                className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                onClick={() => handleClick(n._id, n.href)}
              >
                <span className="font-medium">{n.title}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={handleMarkAll} disabled={markRead.isPending}>
                Mark all read
              </Button>
            </div>
          </>
        ) : (
          <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
