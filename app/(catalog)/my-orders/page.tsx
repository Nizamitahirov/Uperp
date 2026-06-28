'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { SalesOrder } from '@/types';
import { SALES_ORDER_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

export default function MyOrdersPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace('/login');
  }, [loading, firebaseUser, router]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', firebaseUser?.uid],
    queryFn: () => listDocs<SalesOrder>('sales_orders', [where('customerId', '==', firebaseUser!.uid)]),
    enabled: !!firebaseUser,
  });

  function tsMillis(ts: unknown) { return (ts as { toMillis?: () => number })?.toMillis?.(); }

  if (loading || !firebaseUser) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center gap-3 border-b px-4 lg:px-8">
        <Button variant="ghost" size="sm" asChild><Link href="/catalog"><ArrowLeft className="h-4 w-4" /> Kataloq</Link></Button>
        <h1 className="font-display text-lg font-bold">Sifarişlərim</h1>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 lg:px-8">
        {isLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        ) : orders.length === 0 ? (
          <Card className="rounded-card"><CardContent className="p-6"><EmptyState title="Sifariş yoxdur" description="Kataloqdan sifariş verin" /></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const meta = SALES_ORDER_STATUS_META[o.status] ?? SALES_ORDER_STATUS_META.new;
              return (
                <Card key={o.id} className="rounded-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-mono text-sm font-medium">{o.soNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tsMillis(o.date))} · {o.items?.length ?? 0} məhsul</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(o.totalAmount, 'AZN')}</p>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
