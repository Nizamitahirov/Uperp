'use client';

import { useMemo, useState } from 'react';
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
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function SalesListPage() {
  const { can } = useAuth();
  const canCreate = can('sales_orders', 'create');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [channel, setChannel] = useState(ALL);
  const [payment, setPayment] = useState(ALL);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['sales_orders'],
    queryFn: () => listDocs<SalesOrder>('sales_orders', [orderBy('createdAt', 'desc')]),
  });

  function tsMillis(ts: unknown) { return (ts as { toMillis?: () => number })?.toMillis?.(); }

  const channelOptions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.channel).filter(Boolean))).map((c) => ({ value: c, label: c })),
    [orders],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== ALL && o.status !== status) return false;
      if (channel !== ALL && o.channel !== channel) return false;
      if (payment !== ALL && o.paymentStatus !== payment) return false;
      if (s && !(o.soNumber?.toLowerCase().includes(s) || o.customerName?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [orders, search, status, channel, payment]);

  return (
    <div>
      <PageHeader title="Satış Sifarişləri" subtitle="B2B/B2C sifarişlər, rezerv, faktura" action={
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/quotations">Təkliflər</Link></Button>
          <Button variant="outline" asChild><Link href="/deliveries">Çatdırılmalar</Link></Button>
          {canCreate && <Button asChild><Link href="/sales/new"><Plus /> Yeni sifariş</Link></Button>}
        </div>
      } />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="SO nömrəsi və ya müştəri..."
        filters={[
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(SALES_ORDER_STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
          { key: 'channel', placeholder: 'Kanal', value: channel, onChange: setChannel, allLabel: 'Bütün kanallar', options: channelOptions },
          { key: 'payment', placeholder: 'Ödəniş', value: payment, onChange: setPayment, allLabel: 'Bütün ödənişlər', options: [{ value: 'paid', label: 'Ödənilib' }, { value: 'partial', label: 'Qismən' }, { value: 'unpaid', label: 'Ödənilməyib' }] },
        ]}
        right={
          <ExportButton
            filename="satis-sifarisleri"
            rows={filtered}
            columns={[
              { header: 'Nömrə', value: 'soNumber' },
              { header: 'Müştəri', value: (o) => o.customerName ?? '' },
              { header: 'Kanal', value: 'channel' },
              { header: 'Ara cəm', value: 'subtotal' },
              { header: 'Endirim', value: 'discountAmount' },
              { header: 'ƏDV', value: 'vatAmount' },
              { header: 'Yekun', value: 'totalAmount' },
              { header: 'Ödəniş', value: 'paymentStatus' },
              { header: 'Status', value: 'status' },
            ]}
          />
        }
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Sifariş tapılmadı" description={orders.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ satış sifarişi yoxdur'} action={canCreate && !orders.length ? <Button asChild><Link href="/sales/new"><Plus /> Yeni sifariş</Link></Button> : undefined} />
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
              {filtered.map((o) => {
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
