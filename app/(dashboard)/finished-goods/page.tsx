'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { listDocs } from '@/lib/firebase/firestore';
import type { FinishedGoodStock } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function fgStatusKey(fg: FinishedGoodStock): 'out' | 'low' | 'overstock' | 'normal' {
  const avail = fg.availableStock ?? 0;
  if (avail <= 0) return 'out';
  if (fg.reorderPoint > 0 && avail <= fg.reorderPoint) return 'low';
  if (fg.maxStock > 0 && fg.currentStock > fg.maxStock) return 'overstock';
  return 'normal';
}
const FG_STATUS_META: Record<string, { label: string; cls: string }> = {
  out: { label: '⚫ Bitib', cls: 'bg-gray-200 text-gray-700' },
  low: { label: '🔴 Aşağı', cls: 'bg-red-100 text-red-700' },
  overstock: { label: '🟠 Overstock', cls: 'bg-orange-100 text-orange-700' },
  normal: { label: '🟢 Normal', cls: 'bg-green-100 text-green-700' },
};

export default function FinishedGoodsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const { data: goods = [], isLoading } = useQuery({
    queryKey: ['finished_goods'],
    queryFn: () => listDocs<FinishedGoodStock>('finished_goods', [orderBy('updatedAt', 'desc')]),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return goods.filter((g) => {
      if (status !== ALL && fgStatusKey(g) !== status) return false;
      if (s && !(g.variantSku?.toLowerCase().includes(s) || g.productName?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [goods, search, status]);

  const stats = useMemo(() => {
    const totalUnits = goods.reduce((s, g) => s + (g.currentStock ?? 0), 0);
    const totalValue = goods.reduce((s, g) => s + (g.currentStock ?? 0) * (g.unitCost ?? 0), 0);
    const outCount = goods.filter((g) => (g.availableStock ?? 0) <= 0).length;
    return { totalUnits, totalValue, outCount, variants: goods.length };
  }, [goods]);

  return (
    <div>
      <PageHeader title="Hazır Məhsul Anbarı" subtitle="Variant (ölçü+sort) səviyyəsində stok" action={
        <ExportButton filename="hazir-mehsul" rows={filtered} columns={[
          { header: 'SKU', value: 'variantSku' },
          { header: 'Məhsul', value: (g) => g.productName ?? '' },
          { header: 'Ölçü', value: 'size' },
          { header: 'Sort', value: 'grade' },
          { header: 'Cari stok', value: 'currentStock' },
          { header: 'Rezerv', value: 'reservedStock' },
          { header: 'Mövcud', value: 'availableStock' },
          { header: 'Maya', value: 'unitCost' },
          { header: 'Pərakəndə', value: 'retailPrice' },
        ]} />
      } />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Variant" value={String(stats.variants)} />
        <Kpi label="Ümumi ədəd" value={formatNumber(stats.totalUnits, 0)} />
        <Kpi label="Stok dəyəri" value={formatCurrency(stats.totalValue, 'AZN')} />
        <Kpi label="Bitmiş variant" value={String(stats.outCount)} />
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="SKU və ya məhsul..."
        filters={[
          { key: 'status', placeholder: 'Stok statusu', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(FG_STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
        ]}
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Hazır məhsul yoxdur" description="İstehsal tamamlandıqda burada görünəcək" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant SKU</TableHead>
                <TableHead>Məhsul</TableHead>
                <TableHead>Ölçü / Sort</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Rezerv</TableHead>
                <TableHead className="text-right">Mövcud</TableHead>
                <TableHead className="text-right">Maya</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g) => {
                const st = FG_STATUS_META[fgStatusKey(g)];
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs">{g.variantSku}</TableCell>
                    <TableCell className="font-medium">{g.productName}</TableCell>
                    <TableCell>{g.size} / {g.grade}</TableCell>
                    <TableCell className="text-right">{formatNumber(g.currentStock, 0)}</TableCell>
                    <TableCell className="text-right">{formatNumber(g.reservedStock, 0)}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(g.availableStock, 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(g.unitCost, 'AZN')}</TableCell>
                    <TableCell><span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span></TableCell>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-card">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
