'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Printer, Truck, XCircle } from 'lucide-react';
import { getDocById } from '@/lib/firebase/firestore';
import { confirmSalesOrder, deliverSalesOrder, cancelSalesOrder } from '@/lib/firebase/sales';
import { createSalesReturn } from '@/lib/firebase/returns';
import { useAuth } from '@/components/providers/auth-provider';
import type { SalesOrder } from '@/types';
import { SALES_ORDER_STATUS_META, VAT_RATE } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { printDocument } from '@/lib/utils/print';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [working, setWorking] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales_orders', id],
    queryFn: () => getDocById<SalesOrder>('sales_orders', id),
  });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  const canUpdate = can('sales_orders', 'update');

  function refresh() {
    qc.invalidateQueries({ queryKey: ['sales_orders', id] });
    qc.invalidateQueries({ queryKey: ['finished_goods'] });
  }
  function tsMillis(ts: unknown) { return (ts as { toMillis?: () => number })?.toMillis?.(); }

  async function run(fn: () => Promise<void>, msg: string) {
    setWorking(true);
    try { await fn(); toast.success(msg); refresh(); }
    catch (e) { toast.error('Əməliyyat alınmadı', e instanceof Error ? e.message : undefined); }
    finally { setWorking(false); }
  }

  function handlePrint() {
    if (!order) return;
    const rows = order.items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.productName} (${it.variantSku})</td><td class="right">${it.quantity}</td><td class="right">${formatCurrency(it.unitPrice, 'AZN')}</td><td class="right">${it.discount}%</td><td class="right">${formatCurrency(it.lineTotal, 'AZN')}</td></tr>`).join('');
    printDocument(order.soNumber, `<div class="header"><div><h1>SATIŞ FAKTURASI</h1><div class="muted">№ ${order.soNumber}</div><div class="muted">Tarix: ${formatDate(tsMillis(order.date))}</div></div><div class="muted">Müştəri:<br/><b>${order.customerName}</b></div></div>
      <table><thead><tr><th>#</th><th>Məhsul</th><th>Say</th><th>Qiymət</th><th>End.</th><th>Cəm</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div><span>Ara cəm</span><span>${formatCurrency(order.subtotal, 'AZN')}</span></div><div><span>Endirim</span><span>−${formatCurrency(order.discountAmount, 'AZN')}</span></div><div><span>ƏDV (${VAT_RATE}%)</span><span>${formatCurrency(order.vatAmount, 'AZN')}</span></div><div class="bold"><span>YEKUN</span><span>${formatCurrency(order.totalAmount, 'AZN')}</span></div></div>`);
  }

  function handlePackingList() {
    if (!order) return;
    const rows = order.items.map((it, i) => `<tr><td>${i + 1}</td><td>${it.productName} (${it.variantSku})</td><td>${it.size}/${it.grade ?? ''}</td><td class="right">${it.quantity}</td><td></td></tr>`).join('');
    const totalQty = order.items.reduce((s, it) => s + it.quantity, 0);
    printDocument(`Packing-${order.soNumber}`, `<div class="header"><div><h1>QABLAŞDIRMA VƏRƏQİ</h1><div class="muted">Sifariş: ${order.soNumber}</div><div class="muted">Tarix: ${formatDate(tsMillis(order.date))}</div></div><div class="muted">Müştəri:<br/><b>${order.customerName}</b><br/>${order.deliveryAddress ?? ''}</div></div>
      <table><thead><tr><th>#</th><th>Məhsul</th><th>Ölçü/Sort</th><th>Say</th><th>✓ Yoxlanış</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div class="bold"><span>Ümumi ədəd</span><span>${totalQty}</span></div></div>
      <div class="sign"><span>Yığan: ____________</span><span>Yoxlayan: ____________</span></div>`);
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!order) {
    return <div><Button variant="ghost" onClick={() => router.push('/sales')}><ArrowLeft className="h-4 w-4" /> Geri</Button><p className="mt-4 text-muted-foreground">Sifariş tapılmadı.</p></div>;
  }

  const meta = SALES_ORDER_STATUS_META[order.status] ?? SALES_ORDER_STATUS_META.new;

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/sales')}><ArrowLeft className="h-4 w-4" /> Satış</Button>
      <PageHeader
        title={order.soNumber}
        subtitle={order.customerName}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4" /> Faktura</Button>
            <Button variant="outline" onClick={handlePackingList}><Printer className="h-4 w-4" /> Packing list</Button>
            {canUpdate && order.status === 'new' && <Button onClick={() => run(() => confirmSalesOrder(order, actor), 'Təsdiqləndi və rezerv edildi')} disabled={working}>{working ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Təsdiqlə (rezerv)</Button>}
            {canUpdate && ['confirmed', 'preparing', 'shipped'].includes(order.status) && <Button onClick={() => run(() => deliverSalesOrder(order, actor), 'Çatdırıldı, faktura yaradıldı')} disabled={working}><Truck className="h-4 w-4" /> Çatdır</Button>}
            {canUpdate && !['delivered', 'cancelled', 'returned'].includes(order.status) && <Button variant="outline" className="text-danger" onClick={() => run(() => cancelSalesOrder(order, actor), 'Ləğv edildi')} disabled={working}><XCircle className="h-4 w-4" /> Ləğv et</Button>}
            {canUpdate && order.status === 'delivered' && <Button variant="outline" onClick={() => run(() => createSalesReturn(order, { reason: 'customer_request', returnType: 'refund', restockable: true }, actor).then(() => undefined), 'Qaytarma (RMA) yaradıldı — Qaytarmalar səhifəsində tamamlayın')} disabled={working}><XCircle className="h-4 w-4" /> Qaytarma</Button>}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {order.reserved && <span className="text-xs text-muted-foreground">Stok rezerv edilib</span>}
      </div>

      <Card className="rounded-card">
        <CardHeader><CardTitle className="text-base">Məhsullar</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Say</TableHead>
                <TableHead className="text-right">Qiymət</TableHead>
                <TableHead className="text-right">Endirim</TableHead>
                <TableHead className="text-right">Cəm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((it) => (
                <TableRow key={it.variantSku}>
                  <TableCell><p className="font-medium">{it.productName}</p><p className="text-xs text-muted-foreground">{it.variantSku}</p></TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.unitPrice, 'AZN')}</TableCell>
                  <TableCell className="text-right">{it.discount}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.lineTotal, 'AZN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-card">
        <CardContent className="ml-auto max-w-xs space-y-1 p-4 text-sm">
          <Row label="Ara cəm" value={formatCurrency(order.subtotal, 'AZN')} />
          <Row label="Endirim" value={`−${formatCurrency(order.discountAmount, 'AZN')}`} />
          <Row label={`ƏDV (${VAT_RATE}%)`} value={formatCurrency(order.vatAmount, 'AZN')} />
          <Row label="YEKUN" value={formatCurrency(order.totalAmount, 'AZN')} bold />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'border-t pt-1 font-bold' : 'text-muted-foreground'}`}><span>{label}</span><span>{value}</span></div>;
}
