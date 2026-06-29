'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createPurchaseRequest } from '@/lib/firebase/procurement';
import { useAuth } from '@/components/providers/auth-provider';
import type { PRItem, RawMaterial, Supplier } from '@/types';
import { PR_REASONS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export default function NewPRPage() {
  const router = useRouter();
  const { profile, can } = useAuth();
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [reason, setReason] = useState<'low_stock' | 'production_plan' | 'new_product' | 'manual'>('manual');
  const [supplierId, setSupplierId] = useState('');
  const [rows, setRows] = useState<PRItem[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: materials = [] } = useQuery({ queryKey: ['raw_materials', 'active'], queryFn: () => listDocs<RawMaterial>('raw_materials', [where('isActive', '==', true)]) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers', 'active'], queryFn: () => listDocs<Supplier>('suppliers', [where('isActive', '==', true)]) });

  const total = rows.reduce((s, r) => s + r.quantity * r.estimatedPrice, 0);
  if (!can('purchase_orders', 'create')) return <p className="text-muted-foreground">Girişiniz yoxdur.</p>;

  function addMaterial(id: string) {
    const m = materials.find((x) => x.id === id);
    if (!m || rows.some((r) => r.materialId === id)) return;
    setRows([...rows, { materialId: m.id, materialName: m.name, materialCode: m.code, unit: m.unit, quantity: m.reorderPoint || 1, estimatedPrice: m.lastPurchasePrice ?? m.avgCost ?? 0 }]);
  }
  function update(idx: number, patch: Partial<PRItem>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function save(submit: boolean) {
    if (rows.length === 0) { toast.error('Material əlavə edin'); return; }
    setSaving(true);
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const id = await createPurchaseRequest(
        { priority, reason, items: rows, suggestedSupplierId: supplierId || undefined, suggestedSupplierName: supplier?.name, submit },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      toast.success(submit ? 'PR təsdiqə göndərildi' : 'PR qaralama saxlandı');
      router.push('/procurement/pr');
      void id;
    } catch { toast.error('PR yaradılmadı'); } finally { setSaving(false); }
  }

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/procurement/pr')}><ArrowLeft className="h-4 w-4" /> PR-lər</Button>
      <PageHeader title="Yeni Alış Tələbi (PR)" subtitle="Material tələbi → təsdiq → PO" action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>Qaralama</Button>
          <Button onClick={() => save(true)} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Təsdiqə göndər</Button>
        </div>
      } />

      <Card className="mb-4 rounded-card">
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-1.5"><Label>Prioritet</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Yüksək</SelectItem><SelectItem value="urgent">Təcili</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Səbəb</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as typeof reason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PR_REASONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Təklif olunan təchizatçı</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Materiallar</CardTitle>
          <div className="w-64">
            <Select value="" onValueChange={addMaterial}>
              <SelectTrigger><span className="flex items-center gap-1 text-sm"><Plus className="h-4 w-4" /> Material əlavə et</span></SelectTrigger>
              <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Material əlavə edilməyib</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="w-28">Miqdar</TableHead><TableHead className="w-32">Təxmini qiymət</TableHead><TableHead className="text-right">Cəm</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={r.materialId}>
                    <TableCell><p className="font-medium">{r.materialName}</p><p className="text-xs text-muted-foreground">{r.materialCode} · {r.unit}</p></TableCell>
                    <TableCell><Input type="number" step="any" value={r.quantity} onChange={(e) => update(idx, { quantity: +e.target.value })} /></TableCell>
                    <TableCell><Input type="number" step="any" value={r.estimatedPrice} onChange={(e) => update(idx, { estimatedPrice: +e.target.value })} /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.quantity * r.estimatedPrice, 'AZN')}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="text-danger" onClick={() => setRows(rows.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > 0 && <div className="flex justify-end border-t p-4 text-sm font-bold">Təxmini cəm: {formatCurrency(total, 'AZN')}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
