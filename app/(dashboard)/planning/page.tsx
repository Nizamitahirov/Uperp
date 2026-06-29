'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Loader2, Sparkles } from 'lucide-react';
import { listDocs, getDocById } from '@/lib/firebase/firestore';
import { computeRequirements } from '@/lib/firebase/production';
import { aiPrompt } from '@/lib/ai/client';
import type { BOM, FinishedGoodStock, ProductionOrder, RawMaterial } from '@/types';
import { formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

export default function PlanningPage() {
  const [insight, setInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['planning-data'],
    queryFn: async () => {
      const [materials, finished, planned] = await Promise.all([
        listDocs<RawMaterial>('raw_materials', [where('isActive', '==', true)]),
        listDocs<FinishedGoodStock>('finished_goods', []),
        listDocs<ProductionOrder>('production_orders', [where('status', 'in', ['planned', 'material_check'])]),
      ]);
      // Planlaşdırılmış istehsal sifarişlərinin BOM-larını gətir
      const bomIds = Array.from(new Set(planned.map((p) => p.bomId).filter(Boolean)));
      const boms = await Promise.all(bomIds.map((id) => getDocById<BOM>('boms', id)));
      const bomMap = new Map(boms.filter(Boolean).map((b) => [b!.id, b!]));
      // Material üzrə planlaşdırılmış tələb
      const planned_need = new Map<string, number>();
      for (const po of planned) {
        const bom = bomMap.get(po.bomId);
        if (!bom) continue;
        for (const [matId, r] of computeRequirements(bom, po.sizeDistribution)) {
          planned_need.set(matId, (planned_need.get(matId) ?? 0) + r.needed);
        }
      }
      return { materials, finished, planned_need: Object.fromEntries(planned_need) };
    },
  });

  const mrp = useMemo(() => {
    if (!data) return [];
    return data.materials
      .map((m) => {
        const plannedNeed = data.planned_need[m.id] ?? 0;
        const forecast = (m.currentStock ?? 0) - plannedNeed;
        const reorder = m.reorderPoint ?? m.minStock ?? 0;
        const shortage = forecast < reorder;
        const suggested = shortage ? Math.max((m.maxStock || reorder * 2) - forecast, m.moq ?? 0) : 0;
        return { m, plannedNeed, forecast, reorder, suggested };
      })
      .sort((a, b) => Number(b.suggested > 0) - Number(a.suggested > 0) || a.forecast - b.forecast);
  }, [data]);

  const demand = useMemo(() => {
    if (!data) return [];
    return data.finished
      .map((f) => {
        const avail = f.availableStock ?? 0;
        const reorder = f.reorderPoint ?? 0;
        const low = reorder > 0 && avail <= reorder;
        const recommend = low ? Math.max((f.maxStock || reorder * 3) - (f.currentStock ?? 0), 0) : 0;
        return { f, avail, reorder, recommend };
      })
      .sort((a, b) => b.recommend - a.recommend);
  }, [data]);

  async function genInsight() {
    setAiLoading(true);
    try {
      const short = mrp.filter((r) => r.suggested > 0).map((r) => `${r.m.name}: ${formatNumber(r.suggested)} ${r.m.unit}`).slice(0, 8);
      const prod = demand.filter((r) => r.recommend > 0).map((r) => `${r.f.variantSku}: ${r.recommend} ədəd`).slice(0, 8);
      const text = await aiPrompt(`Cins şalvar istehsalı üçün təchizat və istehsal planı şərhi yaz (Azərbaycan, qısa). Sifariş tövsiyəsi olan materiallar: ${short.join('; ') || 'yoxdur'}. İstehsal tövsiyəsi olan variantlar: ${prod.join('; ') || 'yoxdur'}.`);
      setInsight(text);
    } catch (e) {
      toast.error('AI şərh alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setAiLoading(false);
    }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div>
      <PageHeader title="Planlaşdırma (MRP)" subtitle="Material tələb proqnozu və hazır məhsul planı" action={
        <Button variant="outline" onClick={genInsight} disabled={aiLoading}>{aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} AI şərh</Button>
      } />

      {insight && <Card className="mb-4 rounded-card"><CardContent className="p-4 text-sm">{insight}</CardContent></Card>}

      <Tabs defaultValue="mrp">
        <TabsList>
          <TabsTrigger value="mrp">Material tələbi (MRP)</TabsTrigger>
          <TabsTrigger value="demand">Hazır məhsul planı</TabsTrigger>
        </TabsList>

        <TabsContent value="mrp">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Xam material — cari + planlaşdırılmış tələb</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Material</TableHead><TableHead className="text-right">Cari stok</TableHead><TableHead className="text-right">Plan tələb</TableHead>
                  <TableHead className="text-right">Proqnoz qalıq</TableHead><TableHead className="text-right">Reorder</TableHead><TableHead className="text-right">Tövsiyə (sifariş)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {mrp.map(({ m, plannedNeed, forecast, reorder, suggested }) => (
                    <TableRow key={m.id}>
                      <TableCell><Link href={`/materials/${m.id}`} className="font-medium hover:underline">{m.name}</Link><span className="ml-1 text-xs text-muted-foreground">{m.unit}</span></TableCell>
                      <TableCell className="text-right">{formatNumber(m.currentStock)}</TableCell>
                      <TableCell className="text-right">{plannedNeed ? formatNumber(plannedNeed) : '—'}</TableCell>
                      <TableCell className={`text-right ${forecast < reorder ? 'text-danger font-medium' : ''}`}>{formatNumber(forecast)}</TableCell>
                      <TableCell className="text-right">{formatNumber(reorder)}</TableCell>
                      <TableCell className="text-right">{suggested > 0 ? <Badge variant="warning">{formatNumber(suggested)} {m.unit}</Badge> : <span className="text-success text-xs">OK</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-3 text-right">
                <Button size="sm" asChild><Link href="/procurement/pr/new">Tövsiyələrlə PR yarat →</Link></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demand">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Hazır məhsul — istehsal tövsiyəsi</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Variant</TableHead><TableHead className="text-right">Mövcud</TableHead><TableHead className="text-right">Reorder</TableHead>
                  <TableHead className="text-right">Maksimum</TableHead><TableHead className="text-right">Tövsiyə (istehsal)</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {demand.map(({ f, avail, reorder, recommend }) => (
                    <TableRow key={f.id}>
                      <TableCell><p className="font-medium">{f.variantSku}</p><p className="text-xs text-muted-foreground">{f.productName}</p></TableCell>
                      <TableCell className="text-right">{formatNumber(avail, 0)}</TableCell>
                      <TableCell className="text-right">{formatNumber(reorder, 0)}</TableCell>
                      <TableCell className="text-right">{formatNumber(f.maxStock, 0)}</TableCell>
                      <TableCell className="text-right">{recommend > 0 ? <Badge variant="warning">{formatNumber(recommend, 0)} ədəd</Badge> : <span className="text-success text-xs">OK</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-3 text-right">
                <Button size="sm" asChild><Link href="/production/new">İstehsal sifarişi yarat →</Link></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
