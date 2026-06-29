'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { issueStock, adjustInventory } from '@/lib/firebase/stock';
import { useAuth } from '@/components/providers/auth-provider';
import type { MovementType, RawMaterial } from '@/types';
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

type Mode = 'issue' | 'adjust';

const ISSUE_TYPES: { value: MovementType; label: string }[] = [
  { value: 'OUT_PRODUCTION', label: 'İstehsala buraxılış' },
  { value: 'OUT_DISPOSAL', label: 'İmha / zay' },
  { value: 'OUT_SAMPLE', label: 'Nümunə' },
  { value: 'OUT_RETURN_SUP', label: 'Təchizatçıya qaytarma' },
];

export function StockActionDialog({
  material,
  open,
  onOpenChange,
  onDone,
}: {
  material: RawMaterial;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<Mode>('issue');
  const [qty, setQty] = useState('');
  const [counted, setCounted] = useState('');
  const [type, setType] = useState<MovementType>('OUT_PRODUCTION');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (mode === 'issue') {
        const n = Number(qty);
        if (!n || n <= 0) throw new Error('Miqdar daxil edin');
        await issueStock(material.id, n, { type, referenceType: 'Disposal', notes }, actor);
        toast.success('Stok çıxışı qeydə alındı');
      } else {
        const n = Number(counted);
        if (Number.isNaN(n) || n < 0) throw new Error('Faktiki sayım daxil edin');
        await adjustInventory(material.id, n, notes || 'İnventarizasiya', actor);
        toast.success('İnventarizasiya düzəlişi tətbiq edildi');
      }
      onOpenChange(false);
      setQty('');
      setCounted('');
      setNotes('');
      onDone();
    } catch (e) {
      toast.error('Əməliyyat alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stok hərəkəti — {material.name}</DialogTitle>
          <DialogDescription>
            Cari stok: {material.currentStock} {material.unit} · Maya metodu: {material.costingMethod}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant={mode === 'issue' ? 'default' : 'outline'} size="sm" onClick={() => setMode('issue')}>
            Çıxış
          </Button>
          <Button variant={mode === 'adjust' ? 'default' : 'outline'} size="sm" onClick={() => setMode('adjust')}>
            İnventarizasiya
          </Button>
        </div>

        {mode === 'issue' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Hərəkət növü</Label>
              <Select value={type} onValueChange={(v) => setType(v as MovementType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Miqdar ({material.unit})</Label>
              <Input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Faktiki sayım ({material.unit})</Label>
            <Input type="number" step="any" value={counted} onChange={(e) => setCounted(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Sistemdəki {material.currentStock} {material.unit} ilə fərq düzəliş hərəkəti yaradacaq.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Qeyd</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Ləğv et
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />} Tətbiq et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
