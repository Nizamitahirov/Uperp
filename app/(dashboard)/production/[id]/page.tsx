'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, Droplets, Loader2, PackageCheck, Play, RotateCcw } from 'lucide-react';
import { getDocById, listDocs } from '@/lib/firebase/firestore';
import { startProduction } from '@/lib/firebase/production';
import { useAuth } from '@/components/providers/auth-provider';
import type { BOM, ProductionOrder, RawMaterial, WashingOrder } from '@/types';
import { PRODUCTION_STATUS_META, WASH_TYPES, WASHING_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { checkAvailability } from '@/lib/firebase/production';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { initOperations, completeAllOperations, fetchOperations } from '@/lib/firebase/operations';
import { CompleteDialog } from '../complete-dialog';
import { WashingSendDialog, WashingReturnDialog } from '../washing-dialogs';
import { OperationsPanel } from './operations-panel';

export default function ProductionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [working, setWorking] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [washOpen, setWashOpen] = useState(false);
  const [returnWash, setReturnWash] = useState<WashingOrder | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['production_orders', id],
    queryFn: () => getDocById<ProductionOrder>('production_orders', id),
  });
  const { data: bom } = useQuery({
    queryKey: ['boms', order?.bomId],
    queryFn: () => getDocById<BOM>('boms', order!.bomId),
    enabled: !!order?.bomId,
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['raw_materials', 'active'],
    queryFn: () => listDocs<RawMaterial>('raw_materials', [where('isActive', '==', true)]),
  });
  const { data: washingOrders = [] } = useQuery({
    queryKey: ['washing_orders', id],
    queryFn: () => listDocs<WashingOrder>('washing_orders', [where('productionOrderId', '==', id), orderBy('createdAt', 'desc')]),
    enabled: !!id,
  });

  const requirements = useMemo(() => {
    if (!bom || !order) return [];
    return checkAvailability(bom, order.sizeDistribution, materials);
  }, [bom, order, materials]);

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  const canRun = can('production_orders', 'update');

  function refresh() {
    qc.invalidateQueries({ queryKey: ['production_orders', id] });
    qc.invalidateQueries({ queryKey: ['washing_orders', id] });
    qc.invalidateQueries({ queryKey: ['raw_materials'] });
    qc.invalidateQueries({ queryKey: ['production_operations', id] });
  }

  async function handleStart() {
    if (!order || !bom) return;
    const shortage = requirements.some((r) => r.shortage > 0);
    if (shortage && !confirm('Material çatışmazlığı var. Yenə də başlamaq istəyirsiniz?')) return;
    setWorking(true);
    try {
      await startProduction(order, bom, actor);
      // Shop-floor mərhələləri yoxdursa avtomatik yarat
      const existing = await fetchOperations(order.id);
      if (!existing) await initOperations(order, actor);
      toast.success('İstehsal başladı — materiallar stokdan çıxdı');
      refresh();
    } catch (e) {
      toast.error('Başlatma alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setWorking(false);
    }
  }

  async function handleCompleted() {
    if (order) await completeAllOperations(order.id, actor).catch(() => {});
    refresh();
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!order) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push('/production')}><ArrowLeft className="h-4 w-4" /> Geri</Button>
        <p className="mt-4 text-muted-foreground">Sifariş tapılmadı.</p>
      </div>
    );
  }

  const meta = PRODUCTION_STATUS_META[order.status] ?? PRODUCTION_STATUS_META.planned;
  const canStart = ['planned', 'material_check'].includes(order.status);
  const canWash = order.status === 'in_progress';
  const canComplete = ['in_progress', 'in_washing', 'in_qc'].includes(order.status);

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/production')}><ArrowLeft className="h-4 w-4" /> İstehsal</Button>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${order.productName} · ${order.totalQuantity} ədəd`}
        action={
          canRun && (
            <div className="flex flex-wrap gap-2">
              {canStart && <Button onClick={handleStart} disabled={working}>{working ? <Loader2 className="animate-spin" /> : <Play className="h-4 w-4" />} İstehsala başla</Button>}
              {canWash && <Button variant="outline" onClick={() => setWashOpen(true)}><Droplets className="h-4 w-4" /> Yuyulmaya göndər</Button>}
              {canComplete && <Button onClick={() => setCompleteOpen(true)}><PackageCheck className="h-4 w-4" /> QC + Tamamla</Button>}
            </div>
          )
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="text-sm text-muted-foreground">Prioritet: {order.priority}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Standard cost" value={formatCurrency(order.standardCost, 'AZN')} />
        <Kpi label="Faktiki material" value={formatCurrency(order.actualMaterialCost, 'AZN')} />
        <Kpi label="Yuyulma xərci" value={formatCurrency(order.washingCost, 'AZN')} />
        <Kpi label="Faktiki cəm" value={formatCurrency(order.totalActualCost, 'AZN')} />
      </div>

      <div className="mb-4">
        <OperationsPanel order={order} canRun={canRun} actor={actor} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">Material tələbi</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Lazım</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((r) => (
                  <TableRow key={r.materialId}>
                    <TableCell className="text-sm">{r.materialName}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.needed)} {r.unit}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.available)}</TableCell>
                    <TableCell className={`text-right ${r.shortage > 0 ? 'font-bold text-danger' : 'text-success'}`}>
                      {r.shortage > 0 ? `−${formatNumber(r.shortage)}` : 'OK'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">Yuyulma sifarişləri</CardTitle></CardHeader>
          <CardContent className="p-0">
            {washingOrders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Yuyulma yoxdur</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>Növ</TableHead>
                    <TableHead className="text-right">İtki</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {washingOrders.map((w) => {
                    const wmeta = WASHING_STATUS_META[w.status] ?? WASHING_STATUS_META.sent;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-mono text-xs">{w.washNumber}</TableCell>
                        <TableCell className="text-sm">{WASH_TYPES[w.washType]?.label ?? w.washType}</TableCell>
                        <TableCell className="text-right text-sm">{w.lossPercentage != null ? `${w.lossPercentage.toFixed(1)}%` : '—'}</TableCell>
                        <TableCell><Badge variant={wmeta.variant}>{wmeta.label}</Badge></TableCell>
                        <TableCell>
                          {w.status === 'sent' && canRun && (
                            <Button variant="ghost" size="sm" onClick={() => setReturnWash(w)}><RotateCcw className="h-4 w-4" /> Qayıdış</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <CompleteDialog order={order} open={completeOpen} onOpenChange={setCompleteOpen} onDone={handleCompleted} />
      <WashingSendDialog order={order} open={washOpen} onOpenChange={setWashOpen} onDone={refresh} />
      <WashingReturnDialog wash={returnWash} order={order} open={!!returnWash} onOpenChange={(o) => !o && setReturnWash(null)} onDone={refresh} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-card">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
