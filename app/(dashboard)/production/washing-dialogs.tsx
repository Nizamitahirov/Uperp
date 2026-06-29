'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createWashingOrder, returnWashing } from '@/lib/firebase/washing';
import { useAuth } from '@/components/providers/auth-provider';
import { WASH_TYPES } from '@/lib/constants';
import type { ProductionOrder, WashingOrder, WashType } from '@/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

export function WashingSendDialog({
  order,
  open,
  onOpenChange,
  onDone,
}: {
  order: ProductionOrder;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [washType, setWashType] = useState<WashType>('stone');
  const [outsourced, setOutsourced] = useState(false);
  const [laundry, setLaundry] = useState('');
  const [price, setPrice] = useState(0);
  const [sent, setSent] = useState(order.totalQuantity);
  const [expected, setExpected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSent(order.totalQuantity);
  }, [open, order]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await createWashingOrder(
        order,
        {
          washType,
          isOutsourced: outsourced,
          laundryName: laundry || undefined,
          pricePerPiece: price,
          sentQuantity: Number(sent),
          expectedReturnDate: expected || undefined,
        },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      toast.success('Yuyulmaya göndərildi');
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error('Yuyulma sifarişi alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yuyulmaya göndər — {order.orderNumber}</DialogTitle>
          <DialogDescription>Yuyulma növü və miqdarı seçin</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Yuyulma növü</Label>
            <Select value={washType} onValueChange={(v) => setWashType(v as WashType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(WASH_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} (norma {v.maxLoss}%)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Göndərilən miqdar</Label>
            <Input type="number" value={sent} onChange={(e) => setSent(+e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="outsourced" checked={outsourced} onChange={(e) => setOutsourced(e.target.checked)} />
            <Label htmlFor="outsourced">Kənar laundry (outsource)</Label>
          </div>
          {outsourced && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Laundry</Label><Input value={laundry} onChange={(e) => setLaundry(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Tarif (AZN/ədəd)</Label><Input type="number" step="any" value={price} onChange={(e) => setPrice(+e.target.value)} /></div>
            </div>
          )}
          <div className="space-y-1.5"><Label>Gözlənilən qayıdış</Label><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Ləğv et</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Göndər</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WashingReturnDialog({
  wash,
  order,
  open,
  onOpenChange,
  onDone,
}: {
  wash: WashingOrder | null;
  order: ProductionOrder;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [returned, setReturned] = useState(0);
  const [damaged, setDamaged] = useState(0);
  const [shrinkage, setShrinkage] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && wash) {
      setReturned(wash.sentQuantity);
      setDamaged(0);
      setShrinkage(0);
    }
  }, [open, wash]);

  if (!wash) return null;
  const loss = wash.sentQuantity - returned;
  const lossPct = wash.sentQuantity > 0 ? (loss / wash.sentQuantity) * 100 : 0;
  const maxLoss = WASH_TYPES[wash.washType]?.maxLoss ?? 100;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await returnWashing(
        wash!,
        order,
        { returnedQuantity: Number(returned), damagedQuantity: Number(damaged), shrinkageMeasured: shrinkage },
        { uid: profile?.uid ?? '', username: profile?.username ?? '' },
      );
      toast.success(`Qayıdış qeyd edildi — itki ${res.lossPercentage.toFixed(1)}%`, res.high ? 'Diqqət: norma keçilib!' : undefined);
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error('Qayıdış alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yuyulmadan qayıdış — {wash.washNumber}</DialogTitle>
          <DialogDescription>Göndərilən: {wash.sentQuantity} ədəd · Norma itki: {maxLoss}%</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Qayıdan (sağlam)</Label><Input type="number" value={returned} onChange={(e) => setReturned(+e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Zədələnən</Label><Input type="number" value={damaged} onChange={(e) => setDamaged(+e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Ölçülən büzülmə %</Label><Input type="number" step="any" value={shrinkage} onChange={(e) => setShrinkage(+e.target.value)} /></div>
          <div className={`rounded-button p-2 text-sm ${lossPct > maxLoss ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            İtki: {loss} ədəd ({lossPct.toFixed(1)}%) {lossPct > maxLoss ? '— ⚠️ norma keçilib' : '— norma daxilində'}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Ləğv et</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Qeyd et</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
