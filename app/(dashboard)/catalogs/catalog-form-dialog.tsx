'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Loader2, Search, Shirt, Star, X } from 'lucide-react';
import type { Catalog, CatalogStatus, Product } from '@/types';
import type { CatalogInput } from '@/lib/firebase/catalogs';
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
import { AiWriteButton } from '@/components/ai/ai-write-button';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Catalog | null;
  products: Product[];
  onSubmit: (v: CatalogInput) => Promise<void>;
  submitting: boolean;
}

export function CatalogFormDialog({ open, onOpenChange, initial, products, onSubmit, submitting }: Props) {
  const [titleAz, setTitleAz] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [season, setSeason] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [status, setStatus] = useState<CatalogStatus>('draft');
  const [coverProductId, setCoverProductId] = useState<string>('');
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitleAz(initial?.title?.az ?? '');
    setTitleEn(initial?.title?.en ?? '');
    setSubtitle(initial?.subtitle ?? '');
    setSeason(initial?.season ?? '');
    setCollectionName(initial?.collectionName ?? '');
    setIssueNumber(initial?.issueNumber ?? '');
    setStatus(initial?.status ?? 'draft');
    setCoverProductId(initial?.coverProductId ?? '');
    setPicked(initial?.productIds ?? []);
    setSearch('');
  }, [open, initial]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const available = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products
      .filter((p) => !picked.includes(p.id))
      .filter((p) => !s || p.name?.az?.toLowerCase().includes(s) || p.modelCode?.toLowerCase().includes(s));
  }, [products, picked, search]);

  function add(id: string) {
    setPicked((p) => [...p, id]);
  }
  function remove(id: string) {
    setPicked((p) => p.filter((x) => x !== id));
    if (coverProductId === id) setCoverProductId('');
  }
  function move(idx: number, dir: -1 | 1) {
    setPicked((p) => {
      const next = [...p];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return p;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function submit() {
    await onSubmit({
      title: { az: titleAz.trim(), en: titleEn.trim() },
      subtitle: subtitle.trim() || undefined,
      season: season.trim() || undefined,
      collectionName: collectionName.trim() || undefined,
      issueNumber: issueNumber.trim() || undefined,
      coverProductId: coverProductId || undefined,
      productIds: picked,
      status,
    });
  }

  const thumb = (p?: Product) => p?.images?.find((i) => i.isPrimary)?.url ?? p?.images?.[0]?.url;
  const canSave = titleAz.trim().length > 0 && picked.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{initial ? 'Jurnalı düzəlt' : 'Yeni jurnal / katalog'}</DialogTitle>
          <DialogDescription>Kolleksiya jurnalı — başlıq, mövsüm və modellərin sırası</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] grid-cols-1 gap-5 overflow-y-auto pr-1 lg:grid-cols-2">
          {/* Sol — meta məlumat */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Başlıq (AZ) *</Label>
                <Input value={titleAz} onChange={(e) => setTitleAz(e.target.value)} placeholder="Yaz Kolleksiyası 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Başlıq (EN)</Label>
                <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Spring Collection 2026" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Alt başlıq</Label>
                <AiWriteButton
                  label="AI ilə yaz"
                  buildPrompt={() => `Cins/denim moda jurnalı kataloqu üçün cəlbedici, qısa alt başlıq (tagline) yaz (Azərbaycan, 1 qısa cümlə). Kataloq: ${titleAz || 'kolleksiya'}, mövsüm: ${season || ''}, kolleksiya: ${collectionName || ''}. Yalnız tagline-i qaytar.`}
                  onResult={(t) => setSubtitle(t)}
                />
              </div>
              <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Indigo nağılı — yeni siluetlər" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Mövsüm</Label>
                <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Yaz-Yay 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Kolleksiya</Label>
                <Input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} placeholder="Heritage" />
              </div>
              <div className="space-y-1.5">
                <Label>Buraxılış №</Label>
                <Input value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} placeholder="01" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CatalogStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Qaralama</SelectItem>
                  <SelectItem value="published">Dərc olunmuş</SelectItem>
                  <SelectItem value="archived">Arxiv</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mövcud məhsullar */}
            <div className="space-y-1.5">
              <Label>Məhsul əlavə et</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Ad və ya model kodu..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-card border border-border p-1">
                {available.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Uyğun məhsul yoxdur</p>
                ) : (
                  available.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => add(p.id)}
                      className="flex w-full items-center gap-2 rounded-button p-1.5 text-left transition-colors hover:bg-secondary"
                    >
                      <Thumb url={thumb(p)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name?.az}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.modelCode}</p>
                      </div>
                      <span className="text-xs text-primary">+ əlavə et</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sağ — seçilmiş modellərin sırası */}
          <div className="space-y-1.5">
            <Label>Jurnaldakı modellər ({picked.length}) — sıra üz qabığından başlayır</Label>
            <div className="max-h-[60vh] space-y-1.5 overflow-y-auto rounded-card border border-border p-2">
              {picked.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Hələ model seçilməyib.<br />Soldan əlavə edin.</p>
              ) : (
                picked.map((id, idx) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  const isCover = coverProductId ? coverProductId === id : idx === 0;
                  return (
                    <div key={id} className={cn('flex items-center gap-2 rounded-button border p-1.5', isCover ? 'border-primary bg-primary/5' : 'border-border')}>
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-5 text-center text-xs font-bold text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
                      <Thumb url={thumb(p)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name?.az}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.modelCode}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className={cn('h-7 w-7', isCover && 'text-primary')} title="Üz qabığı et" onClick={() => setCoverProductId(id)}>
                        <Star className={cn('h-3.5 w-3.5', isCover && 'fill-primary')} />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === picked.length - 1} onClick={() => move(idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => remove(id)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Ləğv et</Button>
          <Button type="button" onClick={submit} disabled={submitting || !canSave}>{submitting && <Loader2 className="animate-spin" />} Yadda saxla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Thumb({ url }: { url?: string }) {
  return (
    <span className="flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Shirt className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}
