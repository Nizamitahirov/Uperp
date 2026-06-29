'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Plus } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { SalesOrder } from '@/types';
import { SALES_ORDER_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SalesListPage() {
  const { can } = useAuth();
  const canCreate = can('sales_orders', 'create');
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['sales_orders'],
    queryFn: () => listDocs<SalesOrder>('sales_orders', [orderBy('createdAt', 'desc')]),
  });

  function tsMillis(ts: unknown) { return (ts as { toMillis?: () => number })?.toMillis?.(); }

  return (
    <div>
      <PageHeader title="Satış Sifarişləri" subtitle="B2B/B2C sifarişlər, rezerv, faktura" action={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/quotations">Təkliflər</Link></Button>
          <Button variant="outline" asChild><Link href="/deliveries">Çatdırılmalar</Link></Button>
          {canCreate && <Button asChild><Link href="/sales/new"><Plus /> Yeni sifariş</Link></Button>}
        </div>
      } />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState title="Sifariş tapılmadı" description="Hələ satış sifarişi yoxdur" action={canCreate ? <Button asChild><Link href="/sales/new"><Plus /> Yeni sifariş</Link></Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO №</TableHead>
                <TableHead>Müştəri</TableHead>
                <TableHead>Tarix</TableHead>
                <TableHead className="text-right">Yekun</TableHead>
                <TableHead>Ödəniş</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const meta = SALES_ORDER_STATUS_META[o.status] ?? SALES_ORDER_STATUS_META.new;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs"><Link href={`/sales/${o.id}`} className="hover:underline">{o.soNumber}</Link></TableCell>
                    <TableCell className="font-medium">{o.customerName}</TableCell>
                    <TableCell>{formatDate(tsMillis(o.date))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.totalAmount, 'AZN')}</TableCell>
                    <TableCell><Badge variant={o.paymentStatus === 'paid' ? 'success' : o.paymentStatus === 'partial' ? 'warning' : 'secondary'}>{o.paymentStatus}</Badge></TableCell>
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
