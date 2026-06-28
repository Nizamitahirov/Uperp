'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { completeProduction } from '@/lib/firebase/production';
import { createQCInspection } from '@/lib/firebase/qc';
import { useAuth } from '@/components/providers/auth-provider';
import type { ProductionOrder } from '@/types';
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

/** QC + tamamlama: ölçü üzrə istehsal sayını, qüsuru və grade-i alır → hazır məhsul */
export function CompleteDialog({
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
  const sizes = Object.keys(order.sizeDistribution ?? {});
  const [produced, setProduced] = useState<Record<string, number>>({});
  const [defect, setDefect] = useState(0);
  const [grade, setGrade] = useState<'A' | 'B'>('A');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setProduced({ ...order.sizeDistribution });
      setDefect(0);
      setGrade('A');
    }
  }, [open, order]);

  const totalProduced = Object.values(produced).reduce((a, b) => a + (Number(b) || 0), 0);

  async function handleSubmit() {
    if (totalProduced <= 0) {
      toast.error('İstehsal miqdarı daxil edin');
      return;
    }
    const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
    setSubmitting(true);
    try {
      await createQCInspection(
        order,
        {
          inspectedQuantity: totalProduced + defect,
          acceptedQuantity: totalProduced,
          defectQuantity: defect,
          grade,
        },
        actor,
      );
      const cleanProduced = Object.fromEntries(Object.entries(produced).map(([k, v]) => [k, Number(v) || 0]));
      await completeProduction(order, cleanProduced, grade, actor);
      toast.success('İstehsal tamamlandı, hazır məhsula əlavə edildi');
      onOpenChange(false);
      onDone();
    } catch (e) {
      console.error(e);
      toast.error('Tamamlama alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QC + Tamamlama — {order.orderNumber}</DialogTitle>
          <DialogDescription>İstehsal olunan sayı ölçü üzrə daxil edin. Qəbul edilənlər hazır məhsula keçəcək.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {sizes.map((s) => (
            <div key={s} className="flex items-center justify-between gap-2">
              <Label className="text-sm">{s} (plan: {order.sizeDistribution[s]})</Label>
              <Input type="number" min={0} className="w-32" value={produced[s] ?? 0} onChange={(e) => setProduced({ ...produced, [s]: +e.target.value })} />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <Label className="text-sm">Qüsurlu (zay)</Label>
            <Input type="number" min={0} className="w-32" value={defect} onChange={(e) => setDefect(+e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">Sort (grade)</Label>
            <Select value={grade} onValueChange={(v) => setGrade(v as 'A' | 'B')}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A (1-ci sort)</SelectItem>
                <SelectItem value="B">B (2-ci sort)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between border-t pt-2 text-sm font-bold"><span>Qəbul ediləcək</span><span>{totalProduced} ədəd</span></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Ləğv et</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Tamamla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
