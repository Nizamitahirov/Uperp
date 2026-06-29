'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { az } from 'date-fns/locale';
import { CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuth } from '@/components/providers/auth-provider';
import { markNotificationRead } from '@/lib/firebase/notifications';
import type { AppNotification, NotificationSeverity } from '@/types';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
  success: '🟢',
  action: '🟠',
};

export default function NotificationsPage() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const { notifications } = useNotifications(100);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const uid = firebaseUser?.uid ?? '';
  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !(n.readBy ?? []).includes(uid)) : notifications),
    [notifications, filter, uid],
  );

  async function markAllRead() {
    await Promise.all(
      notifications.filter((n) => !(n.readBy ?? []).includes(uid)).map((n) => markNotificationRead(n.id, uid)),
    );
  }

  async function open(n: AppNotification) {
    if (!(n.readBy ?? []).includes(uid)) await markNotificationRead(n.id, uid);
    if (n.actionUrl) router.push(n.actionUrl);
  }

  function timeAgo(n: AppNotification) {
    const ms = (n.createdAt as { toMillis?: () => number })?.toMillis?.();
    if (!ms) return '';
    try {
      return formatDistanceToNow(new Date(ms), { addSuffix: true, locale: az });
    } catch {
      return '';
    }
  }

  return (
    <div>
      <PageHeader
        title="Bildirişlər"
        subtitle="Stok xəbərdarlıqları və sistem bildirişləri"
        action={
          <Button variant="outline" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Hamısını oxunmuş et
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          Hamısı
        </Button>
        <Button variant={filter === 'unread' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unread')}>
          Oxunmamış
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-card">
          <EmptyState title="Bildiriş yoxdur" description="Hələ heç bir bildiriş yoxdur" />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const isUnread = !(n.readBy ?? []).includes(uid);
            return (
              <Card
                key={n.id}
                onClick={() => open(n)}
                className={`flex cursor-pointer items-start gap-3 rounded-card p-4 transition-colors hover:bg-accent ${
                  isUnread ? 'border-l-4 border-l-primary' : ''
                }`}
              >
                <span className="mt-0.5">{SEVERITY_DOT[n.severity]}</span>
                <div className="flex-1">
                  <p className="font-medium">{n.title?.az}</p>
                  <p className="text-sm text-muted-foreground">{n.message?.az}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
