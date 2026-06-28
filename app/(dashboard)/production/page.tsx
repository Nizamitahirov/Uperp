'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { ProductionOrder } from '@/types';
import { PRODUCTION_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ProductionListPage() {
  const { can } = useAuth();
  const canCreate = can('production_orders', 'create');
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['production_orders'],
    queryFn: () => listDocs<ProductionOrder>('production_orders', [orderBy('createdAt', 'desc')]),
  });

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  return (
    <div>
      <PageHeader
        title="İstehsal Sifarişləri"
        subtitle="MES — material çıxımı, yuyulma, QC, hazır məhsul"
        action={canCreate && <Button asChild><Link href="/production/new"><Plus /> Yeni sifariş</Link></Button>}
      />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState title="Sifariş tapılmadı" description="Hələ istehsal sifarişi yoxdur" action={canCreate ? <Button asChild><Link href="/production/new"><Plus /> Yeni sifariş</Link></Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sifariş №</TableHead>
                <TableHead>Məhsul</TableHead>
                <TableHead className="text-right">Miqdar</TableHead>
                <TableHead>Tarix</TableHead>
                <TableHead className="text-right">Faktiki maya</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const meta = PRODUCTION_STATUS_META[o.status] ?? PRODUCTION_STATUS_META.planned;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/production/${o.id}`} className="hover:underline">{o.orderNumber}</Link>
                    </TableCell>
                    <TableCell className="font-medium">{o.productName}</TableCell>
                    <TableCell className="text-right">{o.totalQuantity}</TableCell>
                    <TableCell>{formatDate(tsMillis(o.createdAt))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.totalActualCost, 'AZN')}</TableCell>
                    <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
