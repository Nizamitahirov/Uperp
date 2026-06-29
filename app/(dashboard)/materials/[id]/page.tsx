'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, ArrowDownUp, Layers } from 'lucide-react';
import { getDocById, listDocs } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { CostLayer, RawMaterial, StockMovement } from '@/types';
import { MATERIAL_CATEGORY_LABELS, MOVEMENT_TYPE_LABELS } from '@/lib/constants';
import { getStockStatus, STOCK_STATUS_META } from '@/lib/utils/stock';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StockActionDialog } from '../stock-action-dialog';

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [actionOpen, setActionOpen] = useState(false);

  const { data: material, isLoading } = useQuery({
    queryKey: ['raw_materials', id],
    queryFn: () => getDocById<RawMaterial>('raw_materials', id),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ['stock_movements', id],
    queryFn: () => listDocs<StockMovement>('stock_movements', [where('materialId', '==', id), orderBy('createdAt', 'desc')]),
    enabled: !!id,
  });
  const { data: layers = [] } = useQuery({
    queryKey: ['cost_layers', id],
    queryFn: () => listDocs<CostLayer>(`raw_materials/${id}/cost_layers`, [orderBy('createdAt', 'asc')]),
    enabled: !!id,
  });

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!material) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push('/materials')}>
          <ArrowLeft className="h-4 w-4" /> Geri
        </Button>
        <p className="mt-4 text-muted-foreground">Material tapılmadı.</p>
      </div>
    );
  }

  const status = getStockStatus(material);
  const meta = STOCK_STATUS_META[status];
  const activeLayers = layers.filter((l) => !l.isExhausted && l.remainingQty > 0);
  const canMove = can('raw_materials', 'update');

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/materials')}>
        <ArrowLeft className="h-4 w-4" /> Materiallar
      </Button>

      <PageHeader
        title={material.name}
        subtitle={`${material.code} · ${MATERIAL_CATEGORY_LABELS[material.category] ?? material.category}`}
        action={
          canMove && (
            <Button onClick={() => setActionOpen(true)}>
              <ArrowDownUp className="h-4 w-4" /> Stok hərəkəti
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Cari stok" value={`${formatNumber(material.currentStock)} ${material.unit}`} />
        <Kpi label="Status" value={`${meta.dot} ${meta.label}`} />
        <Kpi label="Orta maya" value={formatCurrency(material.avgCost, material.currency)} />
        <Kpi label="Stok dəyəri" value={formatCurrency(material.stockValue, material.currency)} />
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">
            <ArrowDownUp className="mr-1 h-4 w-4" /> Stok tarixçəsi
          </TabsTrigger>
          <TabsTrigger value="layers">
            <Layers className="mr-1 h-4 w-4" /> Cost Layers (FIFO)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card className="rounded-card">
            <CardContent className="p-0">
              {movements.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Hərəkət yoxdur</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarix</TableHead>
                      <TableHead>Növ</TableHead>
                      <TableHead className="text-right">Miqdar</TableHead>
                      <TableHead className="text-right">Vahid maya</TableHead>
                      <TableHead className="text-right">Qalıq</TableHead>
                      <TableHead>İstifadəçi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((mv) => (
                      <TableRow key={mv.id}>
                        <TableCell className="text-sm">{formatDateTime(tsMillis(mv.createdAt))}</TableCell>
                        <TableCell>{MOVEMENT_TYPE_LABELS[mv.type] ?? mv.type}</TableCell>
                        <TableCell className={`text-right font-medium ${mv.quantity >= 0 ? 'text-success' : 'text-danger'}`}>
                          {mv.quantity >= 0 ? '+' : ''}
                          {formatNumber(mv.quantity)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(mv.unitCost, material.currency)}</TableCell>
                        <TableCell className="text-right">{formatNumber(mv.balanceAfter)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{mv.username || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers">
          <Card className="rounded-card">
            <CardHeader>
              <CardTitle className="text-base">FIFO Cost Layers</CardTitle>
              <p className="text-xs text-muted-foreground">
                Aktiv: {activeLayers.length} · Hər GRN yeni təbəqə yaradır, çıxışda köhnədən tükənir.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {layers.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Cost layer yoxdur</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Qəbul tarixi</TableHead>
                      <TableHead className="text-right">İlkin miqdar</TableHead>
                      <TableHead className="text-right">Qalıq</TableHead>
                      <TableHead className="text-right">Vahid maya</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {layers.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{formatDateTime(tsMillis(l.receivedDate) ?? tsMillis(l.createdAt))}</TableCell>
                        <TableCell className="text-right">{formatNumber(l.originalQty)}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(l.remainingQty)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.unitCost, material.currency)}</TableCell>
                        <TableCell>
                          {l.isExhausted || l.remainingQty <= 0 ? (
                            <span className="text-xs text-muted-foreground">Tükənib</span>
                          ) : (
                            <span className="text-xs text-success">Aktiv</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StockActionDialog
        material={material}
        open={actionOpen}
        onOpenChange={setActionOpen}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['raw_materials', id] });
          qc.invalidateQueries({ queryKey: ['stock_movements', id] });
          qc.invalidateQueries({ queryKey: ['cost_layers', id] });
        }}
      />
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
