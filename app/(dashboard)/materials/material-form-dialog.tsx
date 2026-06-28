'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { rawMaterialSchema, type RawMaterialFormValues } from '@/lib/validations';
import { MATERIAL_CATEGORIES, type RawMaterial } from '@/types';
import { MATERIAL_CATEGORY_LABELS, UNITS } from '@/lib/constants';
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RawMaterial | null;
  onSubmit: (values: RawMaterialFormValues) => Promise<void>;
  submitting: boolean;
}

const DEFAULTS: RawMaterialFormValues = {
  code: '',
  name: '',
  category: 'denim_fabric',
  subCategory: '',
  unit: 'metr',
  currentStock: 0,
  minStock: 0,
  costingMethod: 'FIFO',
  avgCost: 0,
  currency: 'AZN',
  isActive: true,
};

export function MaterialFormDialog({ open, onOpenChange, initial, onSubmit, submitting }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RawMaterialFormValues>({
    resolver: zodResolver(rawMaterialSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      reset(
        initial
          ? {
              code: initial.code,
              name: initial.name,
              category: initial.category,
              subCategory: initial.subCategory ?? '',
              unit: initial.unit,
              currentStock: initial.currentStock,
              minStock: initial.minStock,
              maxStock: initial.maxStock,
              reorderPoint: initial.reorderPoint,
              moq: initial.moq,
              costingMethod: initial.costingMethod,
              avgCost: initial.avgCost,
              currency: initial.currency,
              primarySupplierId: initial.primarySupplierId ?? '',
              leadTimeDays: initial.leadTimeDays,
              barcode: initial.barcode ?? '',
              isActive: initial.isActive,
            }
          : DEFAULTS,
      );
    }
  }, [open, initial, reset]);

  const category = watch('category');
  const costingMethod = watch('costingMethod');
  const unit = watch('unit');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Materialı düzəlt' : 'Yeni xam material'}</DialogTitle>
          <DialogDescription>Material məlumatlarını daxil edin</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kod *" error={errors.code?.message}>
            <Input {...register('code')} placeholder="MAT-001" />
          </Field>
          <Field label="Ad *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="14oz Denim parça" />
          </Field>

          <Field label="Kateqoriya *" error={errors.category?.message}>
            <Select value={category} onValueChange={(v) => setValue('category', v as RawMaterialFormValues['category'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {MATERIAL_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alt kateqoriya" error={errors.subCategory?.message}>
            <Input {...register('subCategory')} />
          </Field>

          <Field label="Ölçü vahidi *" error={errors.unit?.message}>
            <Select value={unit} onValueChange={(v) => setValue('unit', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Maya metodu" error={errors.costingMethod?.message}>
            <Select value={costingMethod} onValueChange={(v) => setValue('costingMethod', v as 'FIFO' | 'AVCO')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIFO">FIFO</SelectItem>
                <SelectItem value="AVCO">AVCO</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Cari stok" error={errors.currentStock?.message}>
            <Input type="number" step="any" {...register('currentStock')} />
          </Field>
          <Field label="Minimum stok" error={errors.minStock?.message}>
            <Input type="number" step="any" {...register('minStock')} />
          </Field>

          <Field label="Yenidən sifariş nöqtəsi" error={errors.reorderPoint?.message}>
            <Input type="number" step="any" {...register('reorderPoint')} />
          </Field>
          <Field label="Maksimum stok" error={errors.maxStock?.message}>
            <Input type="number" step="any" {...register('maxStock')} />
          </Field>

          <Field label="Orta maya (AZN)" error={errors.avgCost?.message}>
            <Input type="number" step="any" {...register('avgCost')} />
          </Field>
          <Field label="Lead time (gün)" error={errors.leadTimeDays?.message}>
            <Input type="number" step="any" {...register('leadTimeDays')} />
          </Field>

          <Field label="Barkod" error={errors.barcode?.message}>
            <Input {...register('barcode')} />
          </Field>
          <Field label="MOQ (min. sifariş)" error={errors.moq?.message}>
            <Input type="number" step="any" {...register('moq')} />
          </Field>

          <DialogFooter className="col-span-full mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Ləğv et
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Yadda saxla
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
