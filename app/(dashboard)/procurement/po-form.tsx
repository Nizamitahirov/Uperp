'use client';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createPurchaseOrder, lineTotal } from '@/lib/firebase/procurement';
import { useAuth } from '@/components/providers/auth-provider';
import { purchaseOrderSchema, type PurchaseOrderFormValues } from '@/lib/validations';
import { CURRENCIES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import type { RawMaterial, Supplier } from '@/types';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

export function PurchaseOrderForm() {
  const router = useRouter();
  const { profile } = useAuth();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'active'],
    queryFn: () => listDocs<Supplier>('suppliers', [where('isActive', '==', true)]),
  });
  const { data: materials = [] } = useQuery({
    queryKey: ['raw_materials', 'active'],
    queryFn: () => listDocs<RawMaterial>('raw_materials', [where('isActive', '==', true)]),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: '',
      items: [],
      customsFee: 0,
      shippingFee: 0,
      insuranceFee: 0,
      otherFees: 0,
      currency: 'AZN',
      exchangeRate: 1,
      landedCostAllocation: 'value',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const currency = watch('currency');
  const allocation = watch('landedCostAllocation');

  const subtotal = (items ?? []).reduce((s, i) => s + lineTotal(Number(i.quantity) || 0, Number(i.unitPrice) || 0, Number(i.discount) || 0), 0);
  const extras =
    (Number(watch('customsFee')) || 0) +
    (Number(watch('shippingFee')) || 0) +
    (Number(watch('insuranceFee')) || 0) +
    (Number(watch('otherFees')) || 0);
  const total = subtotal + extras;

  function addMaterial(materialId: string) {
    const m = materials.find((x) => x.id === materialId);
    if (!m) return;
    if ((items ?? []).some((i) => i.materialId === materialId)) {
      toast.info('Bu material artıq əlavə edilib');
      return;
    }
    append({
      materialId: m.id,
      materialName: m.name,
      materialCode: m.code,
      unit: m.unit,
      quantity: 1,
      unitPrice: m.lastPurchasePrice ?? m.avgCost ?? 0,
      discount: 0,
    });
  }

  async function onSubmit(values: PurchaseOrderFormValues) {
    const supplier = suppliers.find((s) => s.id === values.supplierId);
    try {
      const id = await createPurchaseOrder(values, supplier?.name ?? '', {
        uid: profile?.uid ?? '',
        username: profile?.username ?? '',
      });
      toast.success('Satınalma sifarişi yaradıldı');
      router.push(`/procurement/${id}`);
    } catch (e) {
      console.error(e);
      toast.error('PO yaradılmadı');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <PageHeader
        title="Yeni Satınalma Sifarişi"
        subtitle="PO — materiallar və landed cost"
        action={
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />} Yadda saxla
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Sifariş məlumatları</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Təchizatçı *</Label>
              <Select value={watch('supplierId')} onValueChange={(v) => setValue('supplierId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplierId && <p className="text-xs text-danger">{errors.supplierId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Gözlənilən çatdırılma</Label>
              <Input type="date" {...register('expectedDeliveryDate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Valyuta</Label>
              <Select value={currency} onValueChange={(v) => setValue('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Məzənnə (→ AZN)</Label>
              <Input type="number" step="any" {...register('exchangeRate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Incoterms</Label>
              <Input {...register('incoterms')} placeholder="FOB, CIF..." />
            </div>
            <div className="space-y-1.5">
              <Label>Landed cost paylanması</Label>
              <Select value={allocation} onValueChange={(v) => setValue('landedCostAllocation', v as 'value' | 'quantity')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="value">Dəyər əsaslı</SelectItem>
                  <SelectItem value="quantity">Miqdar əsaslı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Qeyd</Label>
              <Input {...register('notes')} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-card">
          <CardHeader>
            <CardTitle className="text-base">Əlavə xərclər (landed cost)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FeeField label="Gömrük" reg={register('customsFee')} />
            <FeeField label="Daşıma" reg={register('shippingFee')} />
            <FeeField label="Sığorta" reg={register('insuranceFee')} />
            <FeeField label="Digər" reg={register('otherFees')} />
            <div className="border-t pt-3 text-sm">
              <Row label="Ara cəm" value={formatCurrency(subtotal, currency)} />
              <Row label="Əlavə xərclər" value={formatCurrency(extras, currency)} />
              <Row label="Cəmi" value={formatCurrency(total, currency)} bold />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 rounded-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Materiallar</CardTitle>
          <div className="w-64">
            <Select value="" onValueChange={addMaterial}>
              <SelectTrigger>
                <span className="flex items-center gap-1 text-sm">
                  <Plus className="h-4 w-4" /> Material əlavə et
                </span>
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {fields.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Material əlavə edilməyib {errors.items && <span className="text-danger">— {errors.items.message}</span>}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-28">Miqdar</TableHead>
                  <TableHead className="w-32">Qiymət</TableHead>
                  <TableHead className="w-24">Endirim %</TableHead>
                  <TableHead className="text-right">Cəm</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, idx) => {
                  const it = items?.[idx];
                  const lt = lineTotal(Number(it?.quantity) || 0, Number(it?.unitPrice) || 0, Number(it?.discount) || 0);
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <p className="font-medium">{field.materialName}</p>
                        <p className="text-xs text-muted-foreground">{field.materialCode} · {field.unit}</p>
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="any" {...register(`items.${idx}.quantity`)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="any" {...register(`items.${idx}.unitPrice`)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="any" {...register(`items.${idx}.discount`)} />
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(lt, currency)}</TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="text-danger" onClick={() => remove(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

function FeeField({ label, reg }: { label: string; reg: ReturnType<ReturnType<typeof useForm>['register']> }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-sm">{label}</Label>
      <Input type="number" step="any" className="w-32" {...reg} />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 ${bold ? 'font-bold' : 'text-muted-foreground'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
