'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { supplierSchema, type SupplierFormValues } from '@/lib/validations';
import type { Supplier } from '@/types';
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
  initial?: Supplier | null;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  submitting: boolean;
}

const DEFAULTS: SupplierFormValues = {
  code: '',
  name: '',
  type: 'company',
  taxNumber: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  country: '',
  paymentTerms: '',
  currency: 'AZN',
  isActive: true,
  notes: '',
};

export function SupplierFormDialog({ open, onOpenChange, initial, onSubmit, submitting }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      reset(
        initial
          ? {
              code: initial.code,
              name: initial.name,
              type: initial.type,
              taxNumber: initial.taxNumber ?? '',
              contactPerson: initial.contactPerson ?? '',
              email: initial.email ?? '',
              phone: initial.phone ?? '',
              address: initial.address ?? '',
              country: initial.country ?? '',
              paymentTerms: initial.paymentTerms ?? '',
              currency: initial.currency,
              rating: initial.rating,
              isActive: initial.isActive,
              notes: initial.notes ?? '',
            }
          : DEFAULTS,
      );
    }
  }, [open, initial, reset]);

  const type = watch('type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Təchizatçını düzəlt' : 'Yeni təchizatçı'}</DialogTitle>
          <DialogDescription>Təchizatçı məlumatlarını daxil edin</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kod *" error={errors.code?.message}>
            <Input {...register('code')} placeholder="SUP-001" />
          </Field>
          <Field label="Ad *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Türkiyə Denim MMC" />
          </Field>

          <Field label="Növ" error={errors.type?.message}>
            <Select value={type} onValueChange={(v) => setValue('type', v as 'company' | 'individual')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company">Şirkət</SelectItem>
                <SelectItem value="individual">Fərdi</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="VÖEN / Tax number" error={errors.taxNumber?.message}>
            <Input {...register('taxNumber')} />
          </Field>

          <Field label="Əlaqədar şəxs" error={errors.contactPerson?.message}>
            <Input {...register('contactPerson')} />
          </Field>
          <Field label="Telefon" error={errors.phone?.message}>
            <Input {...register('phone')} placeholder="+994..." />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Ölkə" error={errors.country?.message}>
            <Input {...register('country')} placeholder="Türkiyə / Çin" />
          </Field>

          <Field label="Ünvan" error={errors.address?.message}>
            <Input {...register('address')} />
          </Field>
          <Field label="Ödəniş şərtləri" error={errors.paymentTerms?.message}>
            <Input {...register('paymentTerms')} placeholder="30 gün, ön ödəniş..." />
          </Field>

          <Field label="Valyuta" error={errors.currency?.message}>
            <Input {...register('currency')} />
          </Field>
          <Field label="Reytinq (0-5)" error={errors.rating?.message}>
            <Input type="number" step="any" min={0} max={5} {...register('rating')} />
          </Field>

          <div className="col-span-full">
            <Field label="Qeyd" error={errors.notes?.message}>
              <Input {...register('notes')} />
            </Field>
          </div>

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
