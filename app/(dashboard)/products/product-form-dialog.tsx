'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Sparkles } from 'lucide-react';
import { productSchema, type ProductFormValues } from '@/lib/validations';
import { PRODUCT_CATEGORIES, PRODUCT_FITS, SIZE_RANGES, WASH_TYPES } from '@/lib/constants';
import { generateProductDescription } from '@/lib/ai/client';
import type { Product, WashType, ProductFit } from '@/types';
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
import { ImageUpload } from '@/components/shared/image-upload';
import { toast } from '@/components/ui/toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Product | null;
  onSubmit: (v: ProductFormValues) => Promise<void>;
  submitting: boolean;
}

const DEFAULTS: ProductFormValues = {
  modelCode: '',
  nameAz: '',
  nameEn: '',
  category: 'men',
  subCategory: '',
  colorName: '',
  colorCode: '',
  fit: 'regular',
  weight: '',
  season: '',
  collection: '',
  sizes: [],
  wholesalePrice: 0,
  retailPrice: 0,
  status: 'draft',
  descriptionAz: '',
  descriptionEn: '',
  images: [],
};

export function ProductFormDialog({ open, onOpenChange, initial, onSubmit, submitting }: Props) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: DEFAULTS,
  });
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (open) {
      reset(
        initial
          ? {
              modelCode: initial.modelCode,
              nameAz: initial.name?.az ?? '',
              nameEn: initial.name?.en ?? '',
              category: initial.category,
              subCategory: initial.subCategory ?? '',
              colorName: initial.colorName ?? '',
              colorCode: initial.colorCode ?? '',
              washEffect: initial.washEffect,
              fit: initial.fit ?? 'regular',
              weight: initial.weight ?? '',
              season: initial.season ?? '',
              collection: initial.collection ?? '',
              sizes: initial.sizes ?? [],
              wholesalePrice: initial.wholesalePrice,
              retailPrice: initial.retailPrice,
              status: initial.status,
              descriptionAz: initial.description?.az ?? '',
              descriptionEn: initial.description?.en ?? '',
              images: initial.images?.map((i) => i.url) ?? [],
            }
          : DEFAULTS,
      );
    }
  }, [open, initial, reset]);

  const sizes = watch('sizes') ?? [];
  const images = watch('images') ?? [];
  const category = watch('category');
  const fit = watch('fit');
  const washEffect = watch('washEffect');
  const status = watch('status');

  function toggleSize(s: string) {
    setValue('sizes', sizes.includes(s) ? sizes.filter((x) => x !== s) : [...sizes, s]);
  }

  async function handleAI() {
    setAiLoading(true);
    try {
      const desc = await generateProductDescription({
        name: watch('nameAz'),
        color: watch('colorName'),
        fit: watch('fit'),
        wash: watch('washEffect'),
        weight: watch('weight'),
        category: watch('category'),
      });
      setValue('descriptionAz', desc.az);
      setValue('descriptionEn', desc.en);
      toast.success('AI təsvir yaradıldı');
    } catch (e) {
      toast.error('AI təsvir alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Məhsulu düzəlt' : 'Yeni məhsul'}</DialogTitle>
          <DialogDescription>Model məlumatları və qiymət</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Model kodu *" error={errors.modelCode?.message}>
            <Input {...register('modelCode')} placeholder="JCF-IND-001" />
          </Field>
          <Field label="Ad (AZ) *" error={errors.nameAz?.message}>
            <Input {...register('nameAz')} placeholder="İndigo Classic Fit" />
          </Field>
          <Field label="Ad (EN)" error={errors.nameEn?.message}>
            <Input {...register('nameEn')} />
          </Field>
          <Field label="Kateqoriya">
            <Select value={category} onValueChange={(v) => setValue('category', v as ProductFormValues['category'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fit">
            <Select value={fit} onValueChange={(v) => setValue('fit', v as ProductFit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_FITS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Yuyulma effekti">
            <Select value={washEffect ?? ''} onValueChange={(v) => setValue('washEffect', v as WashType)}>
              <SelectTrigger><SelectValue placeholder="Seçin..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(WASH_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rəng">
            <Input {...register('colorName')} placeholder="İndigo" />
          </Field>
          <Field label="Çəki">
            <Input {...register('weight')} placeholder="12oz" />
          </Field>
          <Field label="Kolleksiya">
            <Input {...register('collection')} placeholder="2026 Spring-Summer" />
          </Field>
          <Field label="Mövsüm">
            <Input {...register('season')} placeholder="Yaz" />
          </Field>
          <Field label="Topdan qiymət (AZN)" error={errors.wholesalePrice?.message}>
            <Input type="number" step="any" {...register('wholesalePrice')} />
          </Field>
          <Field label="Pərakəndə qiymət (AZN)" error={errors.retailPrice?.message}>
            <Input type="number" step="any" {...register('retailPrice')} />
          </Field>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Ölçü aralıqları</Label>
            <div className="flex flex-wrap gap-2">
              {SIZE_RANGES.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => toggleSize(s)}
                  className={`rounded-button border px-3 py-1 text-sm ${
                    sizes.includes(s) ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label>Şəkillər</Label>
            <ImageUpload path={`products/${watch('modelCode') || 'misc'}`} value={images} onChange={(urls) => setValue('images', urls)} max={6} />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Təsvir</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAI} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} AI ilə yarat
              </Button>
            </div>
            <textarea
              {...register('descriptionAz')}
              rows={2}
              placeholder="Azərbaycanca təsvir..."
              className="flex w-full rounded-button border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <textarea
              {...register('descriptionEn')}
              rows={2}
              placeholder="English description..."
              className="flex w-full rounded-button border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Field label="Status">
            <Select value={status} onValueChange={(v) => setValue('status', v as ProductFormValues['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Qaralama</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="archived">Arxiv</SelectItem>
              </SelectContent>
            </Select>
          </Field>

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
