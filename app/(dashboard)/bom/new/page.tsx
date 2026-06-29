'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createBOM, computeBomCost, type BomRow } from '@/lib/firebase/bom';
import { useAuth } from '@/components/providers/auth-provider';
import type { Product, RawMaterial } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export default function NewBOMPage() {
  const router = useRouter();
  const { profile, can } = useAuth();

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => listDocs<Product>('products', [where('status', '==', 'active')]),
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['raw_materials', 'active'],
    queryFn: () => listDocs<RawMaterial>('raw_materials', [where('isActive', '==', true)]),
  });

  const [productId, setProductId] = useState('');
  const [rows, setRows] = useState<BomRow[]>([]);
  const [labor, setLabor] = useState({ cost: 0, minutes: 0 });
  const [overhead, setOverhead] = useState(10);
  const [packaging, setPackaging] = useState(0);
  const [saving, setSaving] = useState(false);

  const product = products.find((p) => p.id === productId);
  const sizes = useMemo(() => (product?.sizes?.length ? product.sizes : ['Standart']), [product]);

  const cost = useMemo(
    () => computeBomCost({ rows, sizes, laborCost: labor.cost, overheadPercentage: overhead, packagingCost: packaging }),
    [rows, sizes, labor.cost, overhead, packaging],
  );

  if (!can('bom', 'create')) {
    return <p className="text-muted-foreground">Bu səhifəyə girişiniz yoxdur.</p>;
  }

  function addMaterial(materialId: string) {
    const m = materials.find((x) => x.id === materialId);
    if (!m || rows.some((r) => r.materialId === materialId)) return;
    setRows([
      ...rows,
      {
        materialId: m.id,
        materialCode: m.code,
        materialName: m.name,
        unit: m.unit,
        unitCost: m.avgCost ?? 0,
        wastagePercentage: 2,
        qtyBySize: Object.fromEntries(sizes.map((s) => [s, 0])),
      },
    ]);
  }

  function updateRow(idx: number, patch: Partial<BomRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function updateQty(idx: number, size: string, val: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qtyBySize: { ...r.qtyBySize, [size]: val } } : r)));
  }

  async function save(status: 'draft' | 'active') {
    if (!product) {
      toast.error('Məhsul seçin');
      return;
    }
    if (rows.length === 0) {
      toast.error('Ən azı bir material əlavə edin');
      return;
    }
    setSaving(true);
    try {
      const id = await createBOM(
        {
          productId: product.id,
          productName: product.name?.az ?? '',
          sizes,
          rows,
          laborCost: labor.cost,
          laborMinutes: labor.minutes,
          overheadPercentage: overhead,
          packagingCost: packaging,
          status,
        },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      toast.success('BOM yaradıldı');
      router.push(`/bom/${id}`);
    } catch (e) {
      console.error(e);
      toast.error('BOM yadda saxlanmadı');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/bom')}>
        <ArrowLeft className="h-4 w-4" /> BOM siyahısı
      </Button>
      <PageHeader
        title="Yeni BOM"
        subtitle="Ölçüyə görə material reçeti və maya dəyəri"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => save('draft')} disabled={saving}>Qaralama</Button>
            <Button onClick={() => save('active')} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Aktiv et</Button>
          </div>
        }
      />

      <Card className="mb-4 rounded-card">
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Məhsul *</Label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setRows([]); }}>
              <SelectTrigger><SelectValue placeholder="Aktiv məhsul seçin..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name?.az}</SelectItem>)}
              </SelectContent>
            </Select>
            {products.length === 0 && <p className="text-xs text-muted-foreground">Əvvəlcə aktiv məhsul yaradın.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Ölçü aralıqları</Label>
            <div className="flex flex-wrap gap-2 pt-2">
              {sizes.map((s) => <span key={s} className="rounded-button bg-muted px-2 py-1 text-xs">{s}</span>)}
            </div>
          </div>
        </CardContent>
      </Card>

      {product && (
        <>
          <Card className="mb-4 rounded-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Materiallar (ölçü × miqdar)</CardTitle>
              <div className="w-64">
                <Select value="" onValueChange={addMaterial}>
                  <SelectTrigger><span className="flex items-center gap-1 text-sm"><Plus className="h-4 w-4" /> Material əlavə et</span></SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Material əlavə edilməyib</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="w-20">Fire %</TableHead>
                      {sizes.map((s) => <TableHead key={s} className="w-24 text-center">{s}</TableHead>)}
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow key={r.materialId}>
                        <TableCell>
                          <p className="font-medium">{r.materialName}</p>
                          <p className="text-xs text-muted-foreground">{r.materialCode} · {r.unit} · {formatCurrency(r.unitCost, 'AZN')}</p>
                        </TableCell>
                        <TableCell>
                          <Input type="number" step="any" value={r.wastagePercentage} onChange={(e) => updateRow(idx, { wastagePercentage: +e.target.value })} />
                        </TableCell>
                        {sizes.map((s) => (
                          <TableCell key={s}>
                            <Input type="number" step="any" value={r.qtyBySize[s] ?? 0} onChange={(e) => updateQty(idx, s, +e.target.value)} />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button variant="ghost" size="icon" className="text-danger" onClick={() => setRows(rows.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Əmək və overhead</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Əmək (AZN/ədəd)</Label><Input type="number" step="any" value={labor.cost} onChange={(e) => setLabor({ ...labor, cost: +e.target.value })} /></div>
                <div className="space-y-1.5"><Label>SMV (dəqiqə)</Label><Input type="number" step="any" value={labor.minutes} onChange={(e) => setLabor({ ...labor, minutes: +e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Overhead %</Label><Input type="number" step="any" value={overhead} onChange={(e) => setOverhead(+e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Qablaşdırma (AZN)</Label><Input type="number" step="any" value={packaging} onChange={(e) => setPackaging(+e.target.value)} /></div>
              </CardContent>
            </Card>

            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Maya dəyəri (per ədəd)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Material (orta)" value={formatCurrency(cost.materialCost, 'AZN')} />
                <Row label="Əmək" value={formatCurrency(labor.cost, 'AZN')} />
                <Row label={`Overhead (${overhead}%)`} value={formatCurrency(cost.overhead, 'AZN')} />
                <Row label="Qablaşdırma" value={formatCurrency(packaging, 'AZN')} />
                <Row label="STANDARD COST" value={formatCurrency(cost.totalCost, 'AZN')} bold />
                <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                  Təklif (×2.1 topdan): {formatCurrency(cost.totalCost * 2.1, 'AZN')} · (×2.9 pərakəndə): {formatCurrency(cost.totalCost * 2.9, 'AZN')}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t pt-1 font-bold' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
