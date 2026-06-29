'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, Printer, XCircle } from 'lucide-react';
import { getDocById, listDocs } from '@/lib/firebase/firestore';
import { updatePOStatus } from '@/lib/firebase/procurement';
import { useAuth } from '@/components/providers/auth-provider';
import type { GRN, PurchaseOrder } from '@/types';
import { PO_STATUS_META } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { printDocument } from '@/lib/utils/print';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { GRNReceiveDialog } from '../grn-receive-dialog';

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [grnOpen, setGrnOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase_orders', id],
    queryFn: () => getDocById<PurchaseOrder>('purchase_orders', id),
  });
  const { data: grns = [] } = useQuery({
    queryKey: ['grns', 'po', id],
    queryFn: () => listDocs<GRN>('grns', [where('purchaseOrderId', '==', id), orderBy('createdAt', 'desc')]),
    enabled: !!id,
  });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  const canUpdate = can('purchase_orders', 'update');
  const canApprove = can('purchase_orders', 'approve');
  const canReceiveGRN = can('grn', 'create');

  async function changeStatus(status: PurchaseOrder['status']) {
    if (!po) return;
    setWorking(true);
    try {
      await updatePOStatus(po.id, status, actor);
      toast.success('Status yeniləndi');
      qc.invalidateQueries({ queryKey: ['purchase_orders', id] });
    } catch {
      toast.error('Status dəyişmədi');
    } finally {
      setWorking(false);
    }
  }

  function tsMillis(ts: unknown) {
    return (ts as { toMillis?: () => number })?.toMillis?.();
  }

  function handlePrint() {
    if (!po) return;
    const rows = po.items
      .map(
        (it, i) => `<tr><td>${i + 1}</td><td>${it.materialName}</td><td>${it.materialCode ?? ''}</td>
        <td class="right">${it.quantity} ${it.unit}</td><td class="right">${formatCurrency(it.unitPrice, po.currency)}</td>
        <td class="right">${formatCurrency(it.lineTotal, po.currency)}</td></tr>`,
      )
      .join('');
    printDocument(
      po.poNumber,
      `<div class="header"><div><h1>SATINALMA SİFARİŞİ</h1><div class="muted">№ ${po.poNumber}</div>
       <div class="muted">Tarix: ${formatDate(tsMillis(po.orderDate))}</div></div>
       <div class="muted">Təchizatçı:<br/><b>${po.supplierName ?? ''}</b></div></div>
       <table><thead><tr><th>#</th><th>Material</th><th>Kod</th><th>Miqdar</th><th>Qiymət</th><th>Cəm</th></tr></thead>
       <tbody>${rows}</tbody></table>
       <div class="totals">
         <div><span>Ara cəm</span><span>${formatCurrency(po.subtotal, po.currency)}</span></div>
         <div><span>Gömrük</span><span>${formatCurrency(po.customsFee, po.currency)}</span></div>
         <div><span>Daşıma</span><span>${formatCurrency(po.shippingFee, po.currency)}</span></div>
         <div><span>Sığorta + digər</span><span>${formatCurrency(po.insuranceFee + po.otherFees, po.currency)}</span></div>
         <div class="bold"><span>Cəmi</span><span>${formatCurrency(po.totalAmount, po.currency)}</span></div>
         <div class="muted"><span>AZN ekvivalent</span><span>${formatCurrency(po.totalAZN, 'AZN')}</span></div>
       </div>
       <div class="sign"><span>Hazırladı: ____________</span><span>Təsdiq: ____________</span></div>`,
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!po) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push('/procurement')}>
          <ArrowLeft className="h-4 w-4" /> Geri
        </Button>
        <p className="mt-4 text-muted-foreground">Sifariş tapılmadı.</p>
      </div>
    );
  }

  const meta = PO_STATUS_META[po.status] ?? PO_STATUS_META.draft;
  const hasRemaining = po.items.some((it) => (it.receivedQuantity ?? 0) < it.quantity);
  const canShowReceive = canReceiveGRN && hasRemaining && !['draft', 'cancelled'].includes(po.status);

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/procurement')}>
        <ArrowLeft className="h-4 w-4" /> Sifarişlər
      </Button>

      <PageHeader
        title={po.poNumber}
        subtitle={po.supplierName}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Çap / PDF
            </Button>
            {po.status === 'draft' && canApprove && (
              <Button onClick={() => changeStatus('approved')} disabled={working}>
                {working ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Təsdiqlə
              </Button>
            )}
            {po.status === 'approved' && canUpdate && (
              <Button variant="outline" onClick={() => changeStatus('shipped')} disabled={working}>
                Yola düşdü
              </Button>
            )}
            {canShowReceive && (
              <Button onClick={() => setGrnOpen(true)}>
                <PackageCheck className="h-4 w-4" /> Qəbul et (GRN)
              </Button>
            )}
            {!['completed', 'cancelled'].includes(po.status) && canUpdate && (
              <Button variant="outline" className="text-danger" onClick={() => changeStatus('cancelled')} disabled={working}>
                <XCircle className="h-4 w-4" /> Ləğv et
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="text-sm text-muted-foreground">
          Gözlənilən çatdırılma: {formatDate(tsMillis(po.expectedDeliveryDate))}
        </span>
      </div>

      <Card className="rounded-card">
        <CardHeader>
          <CardTitle className="text-base">Materiallar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead className="text-right">Sifariş</TableHead>
                <TableHead className="text-right">Qəbul edilib</TableHead>
                <TableHead className="text-right">Qiymət</TableHead>
                <TableHead className="text-right">Cəm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.items.map((it) => (
                <TableRow key={it.materialId}>
                  <TableCell>
                    <p className="font-medium">{it.materialName}</p>
                    <p className="text-xs text-muted-foreground">{it.materialCode}</p>
                  </TableCell>
                  <TableCell className="text-right">{it.quantity} {it.unit}</TableCell>
                  <TableCell className="text-right">{it.receivedQuantity ?? 0} {it.unit}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.unitPrice, po.currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(it.lineTotal, po.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-card">
          <CardHeader>
            <CardTitle className="text-base">Maliyyə</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Ara cəm" value={formatCurrency(po.subtotal, po.currency)} />
            <Row label="Gömrük" value={formatCurrency(po.customsFee, po.currency)} />
            <Row label="Daşıma" value={formatCurrency(po.shippingFee, po.currency)} />
            <Row label="Sığorta" value={formatCurrency(po.insuranceFee, po.currency)} />
            <Row label="Digər" value={formatCurrency(po.otherFees, po.currency)} />
            <Row label="Cəmi" value={formatCurrency(po.totalAmount, po.currency)} bold />
            <Row label="AZN ekvivalent" value={formatCurrency(po.totalAZN, 'AZN')} />
          </CardContent>
        </Card>

        <Card className="rounded-card">
          <CardHeader>
            <CardTitle className="text-base">Qəbullar (GRN)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {grns.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Hələ qəbul yoxdur</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN №</TableHead>
                    <TableHead>Tarix</TableHead>
                    <TableHead>Keyfiyyət</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grns.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-mono text-xs">{g.grnNumber}</TableCell>
                      <TableCell>{formatDate(tsMillis(g.createdAt))}</TableCell>
                      <TableCell>
                        <Badge variant={g.qualityStatus === 'approved' ? 'success' : 'warning'}>
                          {g.qualityStatus === 'approved' ? 'Tam' : 'Qismən'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <GRNReceiveDialog
        po={po}
        open={grnOpen}
        onOpenChange={setGrnOpen}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ['purchase_orders', id] });
          qc.invalidateQueries({ queryKey: ['grns', 'po', id] });
          qc.invalidateQueries({ queryKey: ['raw_materials'] });
        }}
      />
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
