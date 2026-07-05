'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { ClipboardCheck, Loader2, Save, History, PackageCheck } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { applyStocktake } from '@/lib/firebase/stocktake';
import { useAuth } from '@/components/providers/auth-provider';
import type { RawMaterial, Stocktake, StocktakeLine } from '@/types';
import { MATERIAL_CATEGORY_LABELS } from '@/lib/constants';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

export default function StocktakePage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canPost = can('raw_materials', 'create');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['raw_materials'],
    queryFn: () => listDocs<RawMaterial>('raw_materials'),
  });
  const { data: history = [] } = useQuery({
    queryKey: ['stocktakes'],
    queryFn: () => listDocs<Stocktake>('stocktakes', [orderBy('createdAt', 'desc')]),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (category !== ALL && m.category !== category) return false;
      if (s && !(m.code?.toLowerCase().includes(s) || m.name?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [materials, search, category]);

  const summary = useMemo(() => {
    let countedLines = 0, varianceValue = 0, varianceQty = 0;
    for (const m of materials) {
      const raw = counts[m.id];
      if (raw === undefined || raw === '') continue;
      const counted = Number(raw);
      if (Number.isNaN(counted)) continue;
      countedLines += 1;
      const delta = counted - (m.currentStock ?? 0);
      varianceQty += delta;
      varianceValue += delta * (m.avgCost ?? 0);
    }
    return { countedLines, varianceValue, varianceQty };
  }, [counts, materials]);

  async function post() {
    const lines: StocktakeLine[] = [];
    for (const m of materials) {
      const raw = counts[m.id];
      if (raw === undefined || raw === '') continue;
      const counted = Number(raw);
      if (Number.isNaN(counted)) continue;
      lines.push({
        materialId: m.id, materialName: m.name, code: m.code, unit: m.unit,
        expectedQty: m.currentStock ?? 0, countedQty: counted, unitCost: m.avgCost ?? 0,
      });
    }
    if (lines.length === 0) { toast.error('Ən azı bir material sayın'); return; }
    setSubmitting(true);
    try {
      const res = await applyStocktake(lines, { note: note.trim() || undefined }, { uid: profile?.uid ?? '', username: profile?.username ?? '' });
      toast.success(`İnventarizasiya tətbiq edildi (${res.number})`, `${res.adjusted} material düzəlişi`);
      setCounts({}); setNote('');
      qc.invalidateQueries({ queryKey: ['raw_materials'] });
      qc.invalidateQueries({ queryKey: ['stocktakes'] });
    } catch (e) {
      toast.error('Tətbiq alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="İnventarizasiya" subtitle="Fiziki sayım — sistem qalığı ilə tutuşdurma və düzəliş" />

      <Tabs defaultValue="count">
        <TabsList>
          <TabsTrigger value="count"><ClipboardCheck className="mr-1.5 h-4 w-4" /> Yeni sayım</TabsTrigger>
          <TabsTrigger value="history"><History className="mr-1.5 h-4 w-4" /> Tarixçə</TabsTrigger>
        </TabsList>

        <TabsContent value="count">
          {/* Xülasə zolağı */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SumCard label="Sayılmış sətir" value={String(summary.countedLines)} tint="bg-primary/10 text-primary" icon={PackageCheck} />
            <SumCard label="Fərq (ədəd)" value={formatNumber(summary.varianceQty, 1)} tint={summary.varianceQty < 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'} icon={ClipboardCheck} />
            <SumCard label="Fərq dəyəri" value={formatCurrency(summary.varianceValue, 'AZN')} tint={summary.varianceValue < 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'} icon={ClipboardCheck} />
            <div className="flex items-center">
              {canPost && <Button className="w-full" onClick={post} disabled={submitting || summary.countedLines === 0}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Tətbiq et</Button>}
            </div>
          </div>

          <FilterBar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Kod və ya ad üzrə axtar..."
            filters={[
              { key: 'category', placeholder: 'Kateqoriya', value: category, onChange: setCategory, allLabel: 'Bütün kateqoriyalar', options: Object.entries(MATERIAL_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l })) },
            ]}
            right={<Input className="h-9 w-full sm:w-64" placeholder="Qeyd (opsional)..." value={note} onChange={(e) => setNote(e.target.value)} />}
          />

          <Card className="rounded-card">
            {isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState title="Material tapılmadı" description="Filtrə uyğun material yoxdur" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kod</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Sistem qalığı</TableHead>
                      <TableHead className="text-right w-36">Faktiki sayım</TableHead>
                      <TableHead className="text-right">Fərq</TableHead>
                      <TableHead className="text-right">Fərq dəyəri</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((m) => {
                      const raw = counts[m.id];
                      const counted = raw === undefined || raw === '' ? null : Number(raw);
                      const delta = counted === null || Number.isNaN(counted) ? null : counted - (m.currentStock ?? 0);
                      return (
                        <TableRow key={m.id} className={cn(delta !== null && Math.abs(delta) > 1e-9 && 'bg-amber-500/[0.04]')}>
                          <TableCell className="font-mono text-xs">{m.code}</TableCell>
                          <TableCell className="font-medium">{m.name}<span className="ml-1 text-xs text-muted-foreground">{m.unit}</span></TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(m.currentStock ?? 0)}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              className="h-8 w-28 text-right tabular-nums ml-auto"
                              placeholder="—"
                              value={raw ?? ''}
                              onChange={(e) => setCounts((c) => ({ ...c, [m.id]: e.target.value }))}
                            />
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums font-medium', delta === null ? 'text-muted-foreground' : delta < 0 ? 'text-rose-600' : delta > 0 ? 'text-emerald-600' : '')}>
                            {delta === null ? '—' : `${delta > 0 ? '+' : ''}${formatNumber(delta, 1)}`}
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums', delta && delta < 0 ? 'text-rose-600' : delta && delta > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
                            {delta === null ? '—' : formatCurrency(delta * (m.avgCost ?? 0), 'AZN')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">Yalnız dəyəri daxil edilmiş materiallar üzrə düzəliş edilir. Fərq stok hərəkəti (ADJ_INVENTORY) kimi yazılır və maya dəyərinə təsir edir.</p>
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Keçmiş inventarizasiyalar</CardTitle></CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <EmptyState title="Hələ inventarizasiya yoxdur" description="Sayım tətbiq edildikdə burada görünəcək" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead><TableHead>Tarix</TableHead><TableHead>İcraçı</TableHead>
                      <TableHead className="text-right">Sətir</TableHead><TableHead className="text-right">Fərq (ədəd)</TableHead><TableHead className="text-right">Fərq dəyəri</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.number}</TableCell>
                        <TableCell>{formatDate((s.createdAt as { toMillis?: () => number })?.toMillis?.())}</TableCell>
                        <TableCell>{s.createdByName ?? '—'}</TableCell>
                        <TableCell className="text-right">{s.countedLines}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.varianceQtyAbs, 1)}</TableCell>
                        <TableCell className={cn('text-right tabular-nums font-medium', s.varianceValue < 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(s.varianceValue, 'AZN')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SumCard({ label, value, tint, icon: Icon }: { label: string; value: string; tint: string; icon: typeof ClipboardCheck }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
