'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

export default function CatalogPage() {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace('/login');
  }, [loading, firebaseUser, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b px-4 lg:px-8">
        <h1 className="font-display text-xl font-bold text-primary">👖 Jeans · Kataloq</h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {profile?.fullName || firebaseUser.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout(firebaseUser);
              router.replace('/login');
            }}
          >
            <LogOut className="h-4 w-4" /> Çıxış
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight">Yeni Kolleksiya</h2>
          <p className="mt-2 text-muted-foreground">Premium denim — moda jurnalı dizaynı</p>
        </div>

        <Card className="rounded-card">
          <CardContent className="p-8">
            <EmptyState
              title="Kataloq tezliklə"
              description="Məhsul kataloqu Faza 6-da (AI + moda jurnalı dizaynı) tam işə düşəcək. Hesabınız uğurla yaradıldı."
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
