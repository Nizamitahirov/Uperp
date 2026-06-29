'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import { getRoleName } from '@/lib/rbac/permissions';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LocaleSwitcher } from './locale-switcher';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const t = useTranslations('common');
  const router = useRouter();
  const { profile, firebaseUser } = useAuth();

  const name = profile?.fullName || firebaseUser?.displayName || firebaseUser?.email || 'İstifadəçi';
  const initials = name.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout(firebaseUser);
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Menyu">
          <Menu />
        </Button>
        <span className="text-sm font-semibold text-muted-foreground lg:hidden">UP ERP</span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">{name}</p>
                <p className="text-xs text-muted-foreground">{getRoleName(profile?.role)}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="h-4 w-4" /> {t('profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-danger">
              <LogOut className="h-4 w-4" /> {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
