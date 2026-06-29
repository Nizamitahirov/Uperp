'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { customerSchema, type CustomerFormValues } from '@/lib/validations';
import { CUSTOMER_SEGMENTS, CUSTOMER_TYPES } from '@/lib/constants';
import type { Customer, CustomerSegment, CustomerType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Customer | null;
  onSubmit: (v: CustomerFormValues) => Promise<void>;
  submitting: boolean;
}

const DEFAULTS: CustomerFormValues = {
  name: '', companyName: '', type: 'wholesale', taxNumber: '', email: '', contactPerson: '',
  phone: '', address: '', creditLimit: 0, paymentTermDays: 0, discountRate: 0, segment: 'regular',
  status: 'active', notes: '',
};

export function CustomerFormDialog({ open, onOpenChange, initial, onSubmit, submitting }: Props) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      reset(initial ? {
        name: initial.name, companyName: initial.companyName ?? '', type: initial.type,
        taxNumber: initial.taxNumber ?? '', email: initial.email ?? '', contactPerson: initial.contactPerson ?? '',
        phone: initial.phone ?? '', address: initial.address ?? '', creditLimit: initial.creditLimit,
        paymentTermDays: initial.paymentTermDays, discountRate: initial.discountRate, segment: initial.segment,
        status: initial.status, notes: initial.notes ?? '',
      } : DEFAULTS);
    }
  }, [open, initial, reset]);

  const type = watch('type');
  const segment = watch('segment');
  const status = watch('status');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Müştərini düzəlt' : 'Yeni müştəri'}</DialogTitle>
          <DialogDescription>Müştəri məlumatları və maliyyə şərtləri</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ad *" error={errors.name?.message}><Input {...register('name')} /></Field>
          <Field label="Şirkət"><Input {...register('companyName')} /></Field>
          <Field label="Növ">
            <Select value={type} onValueChange={(v) => setValue('type', v as CustomerType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CUSTOMER_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Seqment">
            <Select value={segment} onValueChange={(v) => setValue('segment', v as CustomerSegment)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CUSTOMER_SEGMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="VÖEN"><Input {...register('taxNumber')} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
          <Field label="Əlaqədar şəxs"><Input {...register('contactPerson')} /></Field>
          <Field label="Telefon"><Input {...register('phone')} /></Field>
          <Field label="Ünvan"><Input {...register('address')} /></Field>
          <Field label="Kredit limiti (AZN)"><Input type="number" step="any" {...register('creditLimit')} /></Field>
          <Field label="Ödəniş müddəti (gün)"><Input type="number" {...register('paymentTermDays')} /></Field>
          <Field label="Endirim %"><Input type="number" step="any" {...register('discountRate')} /></Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setValue('status', v as CustomerFormValues['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="passive">Passiv</SelectItem>
                <SelectItem value="blacklist">Qara siyahı</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Qeyd"><Input {...register('notes')} /></Field></div>
          <DialogFooter className="sm:col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Ləğv et</Button>
            <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Yadda saxla</Button>
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
