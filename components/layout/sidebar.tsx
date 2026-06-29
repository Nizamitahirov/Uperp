'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/nav';
import { useAuth } from '@/components/providers/auth-provider';
import { Logo } from './logo';
import { cn } from '@/lib/utils/cn';

interface Props {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tg = useTranslations('navGroup');
  const { canAccess } = useAuth();

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => canAccess(i.module)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header — logo + collapse toggle */}
      <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        <Link href="/dashboard" onClick={onNavigate} aria-label="UP ERP">
          <Logo compact={collapsed} />
        </Link>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden rounded-button p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            aria-label="Yığ"
            title="Menyunu yığ"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand düyməsi (yalnız collapsed) */}
      {onToggleCollapse && collapsed && (
        <div className="flex justify-center border-b border-sidebar-border py-2">
          <button
            onClick={onToggleCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-button text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Genişləndir"
            title="Menyunu genişləndir"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Nav — qruplaşdırılmış */}
      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden py-3', collapsed ? 'px-2' : 'px-3')}>
        {groups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && (collapsed ? 'mt-2 border-t border-sidebar-border pt-2' : 'mt-4'))}>
            {!collapsed && group.labelKey && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">{tg(group.labelKey)}</p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? t(item.labelKey) : undefined}
                    className={cn(
                      'flex items-center rounded-button text-sm font-medium transition-colors',
                      collapsed ? 'h-10 w-10 justify-center' : 'gap-3 px-3 py-2',
                      active
                        ? 'bg-primary text-primary-foreground shadow-glow'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
