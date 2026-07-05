'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { FileInput, Plus } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { PurchaseOrder } from '@/types';
import { PO_STATUS_META } from '@/lib/constants';
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

export default function ProcurementPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const canCreate = can('purchase_orders', 'create');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase_orders'],
    queryFn: () => listDocs<PurchaseOrder>('purchase_orders', [orderBy('createdAt', 'desc')]),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== ALL && o.status !== status) return false;
      if (s && !(o.poNumber?.toLowerCase().includes(s) || o.supplierName?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [orders, search, status]);

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  return (
    <div>
      <PageHeader
        title="Satınalma Sifarişləri"
        subtitle="PO → GRN → 3-way matching"
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/procurement/pr">
                <FileInput className="h-4 w-4" /> PR-lər
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/procurement/grn">
                <FileInput className="h-4 w-4" /> GRN-lər
              </Link>
            </Button>
            {canCreate && (
              <Button asChild>
                <Link href="/procurement/new">
                  <Plus /> Yeni PO
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="PO nömrəsi və ya təchizatçı..."
        filters={[
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(PO_STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
        ]}
        right={
          <ExportButton filename="satinalma-po" rows={filtered} columns={[
            { header: 'Nömrə', value: 'poNumber' },
            { header: 'Təchizatçı', value: (o) => o.supplierName ?? '' },
            { header: 'Valyuta', value: 'currency' },
            { header: 'Məbləğ', value: 'totalAmount' },
            { header: 'Məbləğ (AZN)', value: 'totalAZN' },
            { header: 'Status', value: 'status' },
          ]} />
        }
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Sifariş tapılmadı"
            description={orders.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ satınalma sifarişi yoxdur'}
            action={canCreate && !orders.length ? <Button asChild><Link href="/procurement/new"><Plus /> Yeni PO</Link></Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO №</TableHead>
                <TableHead>Təchizatçı</TableHead>
                <TableHead>Tarix</TableHead>
                <TableHead className="text-right">Cəmi (AZN)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const meta = PO_STATUS_META[o.status] ?? PO_STATUS_META.draft;
                return (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      <Link href={`/procurement/${o.id}`} className="hover:underline">
                        {o.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{o.supplierName || '—'}</TableCell>
                    <TableCell>{formatDate(tsMillis(o.orderDate))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(o.totalAZN, 'AZN')}</TableCell>
                    <TableCell>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TableCell>
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
