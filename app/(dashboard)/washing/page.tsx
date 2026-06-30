'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { listDocs } from '@/lib/firebase/firestore';
import type { WashingOrder } from '@/types';
import { WASH_TYPES, WASHING_STATUS_META } from '@/lib/constants';
import { formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function WashingListPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['washing_orders'],
    queryFn: () => listDocs<WashingOrder>('washing_orders', [orderBy('createdAt', 'desc')]),
  });

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  return (
    <div>
      <PageHeader title="Yuyulma Sifarişləri" subtitle="Yuyulma izləməsi və itki faizi" action={
        <ExportButton filename="yuyulma" rows={orders} columns={[
          { header: 'Yuyulma №', value: 'washNumber' },
          { header: 'İstehsal №', value: (w) => w.productionOrderNumber ?? '' },
          { header: 'Tip', value: 'washType' },
          { header: 'Emalçı', value: (w) => w.laundryName ?? (w.isOutsourced ? 'Kənar' : 'Daxili') },
          { header: 'Göndərilən', value: 'sentQuantity' },
          { header: 'Qayıdan', value: (w) => w.returnedQuantity ?? '' },
          { header: 'İtki %', value: (w) => w.lossPercentage ?? '' },
          { header: 'Status', value: 'status' },
        ]} />
      } />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : orders.length === 0 ? (
          <EmptyState title="Yuyulma sifarişi yoxdur" description="İstehsal sifarişindən yuyulmaya göndərin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WSH №</TableHead>
                <TableHead>İstehsal</TableHead>
                <TableHead>Növ</TableHead>
                <TableHead className="text-right">Göndərilən</TableHead>
                <TableHead className="text-right">Qayıdan</TableHead>
                <TableHead className="text-right">İtki %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((w) => {
                const meta = WASHING_STATUS_META[w.status] ?? WASHING_STATUS_META.sent;
                const maxLoss = WASH_TYPES[w.washType]?.maxLoss ?? 100;
                const high = (w.lossPercentage ?? 0) > maxLoss;
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.washNumber}</TableCell>
                    <TableCell>
                      <Link href={`/production/${w.productionOrderId}`} className="hover:underline">{w.productionOrderNumber}</Link>
                    </TableCell>
                    <TableCell className="text-sm">{WASH_TYPES[w.washType]?.label ?? w.washType}</TableCell>
                    <TableCell className="text-right">{w.sentQuantity}</TableCell>
                    <TableCell className="text-right">{w.returnedQuantity ?? '—'}</TableCell>
                    <TableCell className={`text-right ${high ? 'font-bold text-danger' : ''}`}>
                      {w.lossPercentage != null ? `${w.lossPercentage.toFixed(1)}%` : '—'}
                    </TableCell>
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
