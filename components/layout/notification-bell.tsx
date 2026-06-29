'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { az } from 'date-fns/locale';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuth } from '@/components/providers/auth-provider';
import { markNotificationRead } from '@/lib/firebase/notifications';
import type { AppNotification, NotificationSeverity } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
  success: '🟢',
  action: '🟠',
};

function timeAgo(n: AppNotification): string {
  const ms = (n.createdAt as { toMillis?: () => number })?.toMillis?.();
  if (!ms) return '';
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: az });
  } catch {
    return '';
  }
}

export function NotificationBell() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { notifications, unreadCount } = useNotifications(15);

  async function handleClick(n: AppNotification) {
    if (firebaseUser && !(n.readBy ?? []).includes(firebaseUser.uid)) {
      await markNotificationRead(n.id, firebaseUser.uid);
    }
    if (n.actionUrl) router.push(n.actionUrl);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Bildirişlər" className="relative">
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Bildirişlər</span>
          {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} yeni</span>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Bildiriş yoxdur</p>
          ) : (
            notifications.map((n) => {
              const isUnread = !(n.readBy ?? []).includes(firebaseUser?.uid ?? '');
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                    isUnread ? 'bg-accent/40' : ''
                  }`}
                >
                  <span className="mt-0.5 text-sm">{SEVERITY_DOT[n.severity]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title?.az}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message?.az}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(n)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <Link
          href="/notifications"
          className="block border-t px-3 py-2 text-center text-sm text-primary hover:underline"
        >
          Hamısına bax
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
