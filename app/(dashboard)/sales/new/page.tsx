'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createSalesOrder, computeSalesTotals } from '@/lib/firebase/sales';
import { useAuth } from '@/components/providers/auth-provider';
import type { Customer, FinishedGoodStock, SalesOrderItem } from '@/types';
import { tieredDiscount, VAT_RATE } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

interface Row extends SalesOrderItem {}

export default function NewSalesOrderPage() {
  const router = useRouter();
  const { profile, can } = useAuth();
  const [customerId, setCustomerId] = useState('');
  const [channel, setChannel] = useState<'wholesale' | 'retail' | 'online'>('wholesale');
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({ queryKey: ['customers', 'active'], queryFn: () => listDocs<Customer>('customers', [where('status', '==', 'active')]) });
  const { data: goods = [] } = useQuery({ queryKey: ['finished_goods'], queryFn: () => listDocs<FinishedGoodStock>('finished_goods', []) });

  const customer = customers.find((c) => c.id === customerId);
  const totals = useMemo(() => computeSalesTotals(rows), [rows]);

  if (!can('sales_orders', 'create')) return <p className="text-muted-foreground">Bu səhifəyə girişiniz yoxdur.</p>;

  function addVariant(fgId: string) {
    const fg = goods.find((g) => g.id === fgId);
    if (!fg || rows.some((r) => r.finishedGoodId === fgId)) return;
    const price = fg.wholesalePrice || fg.retailPrice || fg.unitCost || 0;
    const disc = Math.min(100, tieredDiscount(1) + (customer?.discountRate ?? 0));
    setRows([...rows, {
      finishedGoodId: fg.id, variantSku: fg.variantSku, productName: fg.productName ?? '', size: fg.size, grade: fg.grade,
      quantity: 1, unitPrice: price, discount: disc, lineTotal: price * (1 - disc / 100),
    }]);
  }

  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, ...patch };
      const autoDisc = Math.min(100, tieredDiscount(next.quantity) + (customer?.discountRate ?? 0));
      const discount = patch.discount != null ? patch.discount : autoDisc;
      return { ...next, discount, lineTotal: next.quantity * next.unitPrice * (1 - discount / 100) };
    }));
  }

  async function save() {
    if (!customer) { toast.error('Müştəri seçin'); return; }
    if (rows.length === 0) { toast.error('Məhsul əlavə edin'); return; }
    setSaving(true);
    try {
      const id = await createSalesOrder(
        { customerId: customer.id, customerName: customer.name, channel, items: rows, paymentMethod: 'credit', deliveryAddress: customer.address },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      toast.success('Satış sifarişi yaradıldı');
      router.push(`/sales/${id}`);
    } catch (e) {
      console.error(e); toast.error('Sifariş yaradılmadı');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/sales')}><ArrowLeft className="h-4 w-4" /> Satış</Button>
      <PageHeader title="Yeni Satış Sifarişi" subtitle="Müştəri, variantlar, endirim və ƏDV" action={<Button onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />} Sifariş yarat</Button>} />

      <Card className="mb-4 rounded-card">
        <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Müştəri *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.discountRate ? ` (−${c.discountRate}%)` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kanal</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wholesale">Topdan</SelectItem>
                <SelectItem value="retail">Pərakəndə</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 rounded-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Məhsullar (variant)</CardTitle>
          <div className="w-72">
            <Select value="" onValueChange={addVariant}>
              <SelectTrigger><span className="flex items-center gap-1 text-sm"><Plus className="h-4 w-4" /> Variant əlavə et</span></SelectTrigger>
              <SelectContent>
                {goods.filter((g) => (g.availableStock ?? 0) > 0).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.variantSku} (mövcud: {g.availableStock})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Variant əlavə edilməyib</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Variant</TableHead>
                  <TableHead className="w-24">Miqdar</TableHead>
                  <TableHead className="w-32">Qiymət</TableHead>
                  <TableHead className="w-24">Endirim %</TableHead>
                  <TableHead className="text-right">Cəm</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, idx) => (
                  <TableRow key={r.finishedGoodId}>
                    <TableCell>
                      <p className="font-medium">{r.variantSku}</p>
                      <p className="text-xs text-muted-foreground">{r.productName} · {r.size}/{r.grade}</p>
                    </TableCell>
                    <TableCell><Input type="number" step="any" value={r.quantity} onChange={(e) => updateRow(idx, { quantity: +e.target.value })} /></TableCell>
                    <TableCell><Input type="number" step="any" value={r.unitPrice} onChange={(e) => updateRow(idx, { unitPrice: +e.target.value })} /></TableCell>
                    <TableCell><Input type="number" step="any" value={r.discount} onChange={(e) => updateRow(idx, { discount: +e.target.value })} /></TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.lineTotal, 'AZN')}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="text-danger" onClick={() => setRows(rows.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-card">
        <CardContent className="ml-auto max-w-xs space-y-1 p-4 text-sm">
          <Row label="Ara cəm" value={formatCurrency(totals.subtotal, 'AZN')} />
          <Row label="Endirim" value={`−${formatCurrency(totals.discountAmount, 'AZN')}`} />
          <Row label={`ƏDV (${VAT_RATE}%)`} value={formatCurrency(totals.vatAmount, 'AZN')} />
          <Row label="YEKUN" value={formatCurrency(totals.totalAmount, 'AZN')} bold />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t pt-1 font-bold' : 'text-muted-foreground'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
