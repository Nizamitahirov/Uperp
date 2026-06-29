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
      <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <Link href="/dashboard" onClick={onNavigate} aria-label="UP ERP" className="transition-opacity hover:opacity-80">
          <Logo compact={collapsed} />
        </Link>
        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex"
            aria-label="Menyunu yığ"
            title="Menyunu yığ"
          >
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* Expand düyməsi (yalnız collapsed) */}
      {onToggleCollapse && collapsed && (
        <div className="flex justify-center py-3">
          <button
            onClick={onToggleCollapse}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Menyunu genişləndir"
            title="Menyunu genişləndir"
          >
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      {/* Nav — qruplaşdırılmış */}
      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2.5 py-2' : 'px-3 py-4')}>
        {groups.map((group, gi) => (
          <div key={gi} className={cn(collapsed ? (gi > 0 && 'mt-2 border-t border-sidebar-border pt-2') : (gi > 0 && 'mt-6'))}>
            {!collapsed && group.labelKey && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40">
                {tg(group.labelKey)}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? t(item.labelKey) : undefined}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
                        collapsed ? 'h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )}
                    >
                      {/* aktiv göstərici çubuq (expanded) */}
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground')} />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
