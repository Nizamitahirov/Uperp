'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createAndPostGRN } from '@/lib/firebase/procurement';
import { useAuth } from '@/components/providers/auth-provider';
import type { PurchaseOrder } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

interface RowState {
  received: number;
  accepted: number;
  rejected: number;
  batchNumber: string;
  warehouseLocation: string;
}

export function GRNReceiveDialog({
  po,
  open,
  onOpenChange,
  onDone,
}: {
  po: PurchaseOrder;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [meta, setMeta] = useState({ trackingNumber: '', carrier: '', containerNumber: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Record<string, RowState> = {};
      for (const it of po.items) {
        const remaining = it.quantity - (it.receivedQuantity ?? 0);
        init[it.materialId] = {
          received: remaining > 0 ? remaining : 0,
          accepted: remaining > 0 ? remaining : 0,
          rejected: 0,
          batchNumber: '',
          warehouseLocation: '',
        };
      }
      setRows(init);
      setMeta({ trackingNumber: '', carrier: '', containerNumber: '', notes: '' });
    }
  }, [open, po]);

  function update(materialId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [materialId]: { ...prev[materialId], ...patch } }));
  }

  async function handleSubmit() {
    const receivedItems = po.items
      .map((it) => {
        const r = rows[it.materialId];
        return {
          materialId: it.materialId,
          receivedQuantity: Number(r?.received) || 0,
          acceptedQuantity: Number(r?.accepted) || 0,
          rejectedQuantity: Number(r?.rejected) || 0,
          batchNumber: r?.batchNumber || undefined,
          warehouseLocation: r?.warehouseLocation || undefined,
        };
      })
      .filter((r) => r.acceptedQuantity > 0 || r.rejectedQuantity > 0);

    if (receivedItems.length === 0) {
      toast.error('Ən azı bir material üçün miqdar daxil edin');
      return;
    }

    setSubmitting(true);
    try {
      await createAndPostGRN(po, receivedItems, meta, {
        uid: profile?.uid ?? '',
        username: profile?.username ?? '',
      });
      toast.success('GRN yaradıldı və stoka daxil edildi');
      onOpenChange(false);
      onDone();
    } catch (e) {
      console.error(e);
      toast.error('GRN yaradılmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Material qəbulu (GRN) — {po.poNumber}</DialogTitle>
          <DialogDescription>Qəbul edilən və qüsurlu miqdarları daxil edin. Landed cost avtomatik paylanır.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tracking №</Label>
            <Input value={meta.trackingNumber} onChange={(e) => setMeta({ ...meta, trackingNumber: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Daşıyıcı</Label>
            <Input value={meta.carrier} onChange={(e) => setMeta({ ...meta, carrier: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Konteyner</Label>
            <Input value={meta.containerNumber} onChange={(e) => setMeta({ ...meta, containerNumber: e.target.value })} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="w-20">Sifariş</TableHead>
              <TableHead className="w-24">Qəbul</TableHead>
              <TableHead className="w-24">Qəbul edilən</TableHead>
              <TableHead className="w-24">Qüsurlu</TableHead>
              <TableHead className="w-28">Partiya</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((it) => {
              const remaining = it.quantity - (it.receivedQuantity ?? 0);
              const r = rows[it.materialId];
              return (
                <TableRow key={it.materialId}>
                  <TableCell>
                    <p className="font-medium">{it.materialName}</p>
                    <p className="text-xs text-muted-foreground">Qalıq: {remaining} {it.unit}</p>
                  </TableCell>
                  <TableCell className="text-sm">{it.quantity}</TableCell>
                  <TableCell>
                    <Input type="number" step="any" value={r?.received ?? 0} onChange={(e) => update(it.materialId, { received: +e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="any" value={r?.accepted ?? 0} onChange={(e) => update(it.materialId, { accepted: +e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="any" value={r?.rejected ?? 0} onChange={(e) => update(it.materialId, { rejected: +e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input value={r?.batchNumber ?? ''} onChange={(e) => update(it.materialId, { batchNumber: e.target.value })} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Ləğv et
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />} Qəbul et və stoka daxil et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
