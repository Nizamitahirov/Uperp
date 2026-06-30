'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ChatWidget } from '@/components/ai/chat-widget';
import { PageGuide } from '@/components/shared/page-guide';
import { cn } from '@/lib/utils/cn';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace('/login');
    }
  }, [loading, firebaseUser, router]);

  // Sidebar yığılma vəziyyətini yadda saxla
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === '1') setCollapsed(true);
  }, []);
  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  }

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className={cn('hidden shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out lg:block', collapsed ? 'w-[76px]' : 'w-64')}>
        <div className="sticky top-0 h-screen">
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar shadow-xl animate-in slide-in-from-left">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
      <ChatWidget />
      <PageGuide />
    </div>
  );
}
