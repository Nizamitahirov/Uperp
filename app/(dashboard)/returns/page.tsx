'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Undo2, Check, PackageCheck, Coins } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { setReturnStatus } from '@/lib/firebase/returns';
import { useAuth } from '@/components/providers/auth-provider';
import type { SalesReturn } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const REASON_LABELS: Record<string, string> = {
  defective: 'Qüsurlu', wrong_size: 'Yanlış ölçü', customer_request: 'Müştəri istəyi', other: 'Digər',
};
const TYPE_LABELS: Record<string, string> = {
  refund: 'Geri ödəniş', exchange: 'Dəyişmə', store_credit: 'Mağaza krediti',
};
const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  pending: { label: 'Gözləyir', variant: 'warning' },
  approved: { label: 'Təsdiqlənib', variant: 'secondary' },
  completed: { label: 'Tamamlanıb', variant: 'success' },
};

export default function ReturnsPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('sales_orders', 'update');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [reason, setReason] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [working, setWorking] = useState('');

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['sales_returns'],
    queryFn: () => listDocs<SalesReturn>('sales_returns', [orderBy('createdAt', 'desc')]),
  });

  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return returns.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (reason !== ALL && r.reason !== reason) return false;
      if (type !== ALL && r.returnType !== type) return false;
      if (s && !(r.returnNumber?.toLowerCase().includes(s) || r.customerName?.toLowerCase().includes(s) || r.soNumber?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [returns, search, status, reason, type]);

  const kpis = useMemo(() => {
    const total = returns.length;
    const pending = returns.filter((r) => r.status === 'pending').length;
    const refundTotal = returns.reduce((a, r) => a + (r.refundAmount ?? 0), 0);
    const restockable = returns.filter((r) => r.restockable).length;
    return { total, pending, refundTotal, restockable };
  }, [returns]);

  async function advance(r: SalesReturn) {
    const next = r.status === 'pending' ? 'approved' : 'completed';
    setWorking(r.id);
    try {
      await setReturnStatus(r, next, { uid: profile?.uid ?? '', username: profile?.username ?? '' });
      toast.success(next === 'approved' ? 'Təsdiqləndi' : 'Tamamlandı — geri-stok tətbiq olundu');
      qc.invalidateQueries({ queryKey: ['sales_returns'] });
      qc.invalidateQueries({ queryKey: ['finished_goods'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setWorking(''); }
  }

  return (
    <div>
      <PageHeader title="Qaytarmalar (RMA)" subtitle="Satış qaytarmaları — səbəb, tip, status və geri-stok izləməsi" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Undo2} tint="bg-primary/10 text-primary" value={String(kpis.total)} label="Ümumi qaytarma" />
        <Kpi icon={Undo2} tint="bg-amber-500/10 text-amber-600" value={String(kpis.pending)} label="Gözləyən" />
        <Kpi icon={Coins} tint="bg-rose-500/10 text-rose-600" value={formatCurrency(kpis.refundTotal, 'AZN')} label="Geri ödəniş məbləği" />
        <Kpi icon={PackageCheck} tint="bg-emerald-500/10 text-emerald-600" value={String(kpis.restockable)} label="Geri stoka" />
      </div>

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="RMA nömrəsi, müştəri və ya SO..."
        filters={[
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
          { key: 'reason', placeholder: 'Səbəb', value: reason, onChange: setReason, allLabel: 'Bütün səbəblər', options: Object.entries(REASON_LABELS).map(([v, l]) => ({ value: v, label: l })) },
          { key: 'type', placeholder: 'Tip', value: type, onChange: setType, allLabel: 'Bütün tiplər', options: Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })) },
        ]}
        right={
          <ExportButton filename="qaytarmalar-rma" rows={filtered} columns={[
            { header: 'RMA №', value: 'returnNumber' },
            { header: 'Sifariş', value: (r) => r.soNumber ?? '' },
            { header: 'Müştəri', value: (r) => r.customerName ?? '' },
            { header: 'Səbəb', value: (r) => REASON_LABELS[r.reason] ?? r.reason },
            { header: 'Tip', value: (r) => TYPE_LABELS[r.returnType] ?? r.returnType },
            { header: 'Məbləğ', value: (r) => r.refundAmount ?? 0 },
            { header: 'Geri stok', value: (r) => (r.restockable ? 'Bəli' : 'Xeyr') },
            { header: 'Status', value: 'status' },
          ]} />
        }
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Qaytarma yoxdur" description={returns.length ? 'Filtrə uyğun nəticə yoxdur' : 'Satış detalından qaytarma yaradıla bilər'} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RMA №</TableHead><TableHead>Sifariş</TableHead><TableHead>Müştəri</TableHead>
                  <TableHead>Tarix</TableHead><TableHead>Səbəb</TableHead><TableHead>Tip</TableHead>
                  <TableHead className="text-right">Məbləğ</TableHead><TableHead>Geri stok</TableHead><TableHead>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const st = STATUS_META[r.status] ?? STATUS_META.pending;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.returnNumber}</TableCell>
                      <TableCell>{r.originalSaleId ? <Link href={`/sales/${r.originalSaleId}`} className="text-primary hover:underline">{r.soNumber ?? '—'}</Link> : (r.soNumber ?? '—')}</TableCell>
                      <TableCell className="font-medium">{r.customerName ?? '—'}</TableCell>
                      <TableCell>{formatDate(ms(r.createdAt))}</TableCell>
                      <TableCell>{REASON_LABELS[r.reason] ?? r.reason}</TableCell>
                      <TableCell>{TYPE_LABELS[r.returnType] ?? r.returnType}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.refundAmount ?? 0, 'AZN')}</TableCell>
                      <TableCell>{r.restockable ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><PackageCheck className="h-3.5 w-3.5" /> Bəli</span> : <span className="text-xs text-muted-foreground">Xeyr</span>}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {r.status !== 'completed' && (
                            <Button size="sm" variant="outline" disabled={working === r.id} onClick={() => advance(r)}>
                              <Check className="h-3.5 w-3.5" /> {r.status === 'pending' ? 'Təsdiqlə' : 'Tamamla'}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, tint, value, label }: { icon: typeof Undo2; tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
