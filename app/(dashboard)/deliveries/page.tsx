'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import type { Delivery } from '@/types';
import { formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  preparing: { label: 'Hazırlanır', variant: 'warning' },
  in_transit: { label: 'Yolda', variant: 'default' },
  delivered: { label: 'Çatdırılıb', variant: 'success' },
  returned: { label: 'Qaytarılıb', variant: 'destructive' },
};

export default function DeliveriesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['deliveries'],
    queryFn: () => listDocs<Delivery>('deliveries', [orderBy('createdAt', 'desc')]),
  });
  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((d) => {
      if (status !== ALL && d.status !== status) return false;
      if (s && !(d.deliveryNumber?.toLowerCase().includes(s) || d.soNumber?.toLowerCase().includes(s) || d.customerName?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [rows, search, status]);

  return (
    <div>
      <Button variant="ghost" className="mb-2" asChild><Link href="/sales"><ArrowLeft className="h-4 w-4" /> Satış</Link></Button>
      <PageHeader title="Çatdırılmalar" subtitle="Sifariş çatdırılma sənədləri" />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Çatdırılma/sifariş nömrəsi və ya müştəri..."
        filters={[
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(STATUS).map(([v, m]) => ({ value: v, label: m.label })) },
        ]}
        right={
          <ExportButton filename="catdirilmalar" rows={filtered} columns={[
            { header: 'Çatdırılma №', value: 'deliveryNumber' },
            { header: 'Sifariş №', value: (d) => d.soNumber ?? '' },
            { header: 'Müştəri', value: (d) => d.customerName ?? '' },
            { header: 'Kuryer', value: (d) => d.courier ?? '' },
            { header: 'Yük sayı', value: (d) => d.packagesCount ?? '' },
            { header: 'Status', value: 'status' },
          ]} />
        }
      />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Çatdırılma yoxdur" description={rows.length ? 'Filtrə uyğun nəticə yoxdur' : 'Sifariş çatdırılanda burada görünəcək'} />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>Sifariş</TableHead><TableHead>Müştəri</TableHead><TableHead>Tarix</TableHead><TableHead className="text-right">Yeşik/ədəd</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const m = STATUS[d.status] ?? STATUS.preparing;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.deliveryNumber}</TableCell>
                    <TableCell><Link href={`/sales/${d.salesOrderId}`} className="hover:underline">{d.soNumber}</Link></TableCell>
                    <TableCell>{d.customerName}</TableCell>
                    <TableCell>{formatDate(ms(d.date))}</TableCell>
                    <TableCell className="text-right">{d.packagesCount ?? '—'}</TableCell>
                    <TableCell><Badge variant={m.variant}>{m.label}</Badge></TableCell>
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
