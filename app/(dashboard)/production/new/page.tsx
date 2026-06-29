'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { getActiveBOM } from '@/lib/firebase/bom';
import { checkAvailability, createProductionOrder } from '@/lib/firebase/production';
import { useAuth } from '@/components/providers/auth-provider';
import type { Product, RawMaterial } from '@/types';
import { formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export default function NewProductionOrderPage() {
  const router = useRouter();
  const { profile, can } = useAuth();
  const [productId, setProductId] = useState('');
  const [dist, setDist] = useState<Record<string, number>>({});
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => listDocs<Product>('products', [where('status', '==', 'active')]),
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['raw_materials', 'active'],
    queryFn: () => listDocs<RawMaterial>('raw_materials', [where('isActive', '==', true)]),
  });
  const { data: bom, isLoading: bomLoading } = useQuery({
    queryKey: ['active-bom', productId],
    queryFn: () => getActiveBOM(productId),
    enabled: !!productId,
  });

  const sizes = bom ? Object.keys(bom.sizeBasedItems ?? {}) : [];
  const totalQty = Object.values(dist).reduce((a, b) => a + (Number(b) || 0), 0);

  const requirements = useMemo(() => {
    if (!bom || totalQty === 0) return [];
    return checkAvailability(bom, dist, materials);
  }, [bom, dist, materials, totalQty]);

  const hasShortage = requirements.some((r) => r.shortage > 0);

  if (!can('production_orders', 'create')) {
    return <p className="text-muted-foreground">Bu səhifəyə girişiniz yoxdur.</p>;
  }

  async function save() {
    const product = products.find((p) => p.id === productId);
    if (!product || !bom) {
      toast.error('Məhsul və aktiv BOM seçin');
      return;
    }
    if (totalQty <= 0) {
      toast.error('Ölçü paylanması daxil edin');
      return;
    }
    setSaving(true);
    try {
      const cleanDist = Object.fromEntries(Object.entries(dist).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
      const id = await createProductionOrder(
        { product, bom, sizeDistribution: cleanDist, priority },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      toast.success('İstehsal sifarişi yaradıldı');
      router.push(`/production/${id}`);
    } catch (e) {
      console.error(e);
      toast.error('Sifariş yaradılmadı');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/production')}><ArrowLeft className="h-4 w-4" /> İstehsal</Button>
      <PageHeader
        title="Yeni İstehsal Sifarişi"
        subtitle="Məhsul, ölçü paylanması və material yoxlaması"
        action={<Button onClick={save} disabled={saving || !bom}>{saving && <Loader2 className="animate-spin" />} Sifariş yarat</Button>}
      />

      <Card className="mb-4 rounded-card">
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Məhsul *</Label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setDist({}); }}>
              <SelectTrigger><SelectValue placeholder="Aktiv məhsul seçin..." /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name?.az}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Prioritet</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Aşağı</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Yüksək</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {productId && bomLoading && <p className="text-sm text-muted-foreground">BOM yüklənir...</p>}
      {productId && !bomLoading && !bom && (
        <Card className="rounded-card"><CardContent className="p-6 text-center text-sm text-warning">Bu məhsul üçün aktiv BOM yoxdur. Əvvəlcə BOM yaradın.</CardContent></Card>
      )}

      {bom && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Ölçü paylanması</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {sizes.map((s) => (
                <div key={s} className="flex items-center justify-between gap-2">
                  <Label className="text-sm">{s}</Label>
                  <Input type="number" min={0} className="w-32" value={dist[s] ?? ''} onChange={(e) => setDist({ ...dist, [s]: +e.target.value })} />
                </div>
              ))}
              <div className="border-t pt-2 text-sm font-bold flex justify-between"><span>Cəmi</span><span>{totalQty} ədəd</span></div>
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Material yoxlaması
                {totalQty > 0 && (hasShortage ? <AlertTriangle className="h-4 w-4 text-danger" /> : <CheckCircle2 className="h-4 w-4 text-success" />)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {requirements.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Ölçü paylanması daxil edin</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Lazım</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                      <TableHead className="text-right">Çatışmazlıq</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((r) => (
                      <TableRow key={r.materialId}>
                        <TableCell className="text-sm">{r.materialName}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.needed)}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.available)}</TableCell>
                        <TableCell className={`text-right ${r.shortage > 0 ? 'font-bold text-danger' : 'text-success'}`}>
                          {r.shortage > 0 ? `−${formatNumber(r.shortage)}` : 'OK'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {hasShortage && <p className="p-3 text-xs text-danger">⚠️ Material çatışmazlığı var. İstehsala başlamaq mümkün olmaya bilər — əvvəlcə PO yaradın.</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
