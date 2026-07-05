'use client';

import { useMemo, useState } from 'react';
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
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ProductionListPage() {
  const { can } = useAuth();
  const canCreate = can('production_orders', 'create');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['production_orders'],
    queryFn: () => listDocs<ProductionOrder>('production_orders', [orderBy('createdAt', 'desc')]),
  });

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== ALL && o.status !== status) return false;
      if (s && !(o.orderNumber?.toLowerCase().includes(s) || o.productName?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [orders, search, status]);

  return (
    <div>
      <PageHeader
        title="İstehsal Sifarişləri"
        subtitle="MES — material çıxımı, yuyulma, QC, hazır məhsul"
        action={canCreate ? <Button asChild><Link href="/production/new"><Plus /> Yeni sifariş</Link></Button> : undefined}
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Sifariş nömrəsi və ya məhsul..."
        filters={[
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(PRODUCTION_STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
        ]}
        right={
          <ExportButton filename="istehsal-sifarisleri" rows={filtered} columns={[
            { header: 'Nömrə', value: 'orderNumber' },
            { header: 'Məhsul', value: (o) => o.productName ?? '' },
            { header: 'Miqdar', value: 'totalQuantity' },
            { header: 'İstehsal', value: (o) => o.producedQuantity ?? '' },
            { header: 'Faktiki maya', value: 'totalActualCost' },
            { header: 'Status', value: 'status' },
          ]} />
        }
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sifariş tapılmadı" description={orders.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ istehsal sifarişi yoxdur'} action={canCreate && !orders.length ? <Button asChild><Link href="/production/new"><Plus /> Yeni sifariş</Link></Button> : undefined} />
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
              {filtered.map((o) => {
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
