'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Pencil, Plus, Trash2, Shirt, QrCode, FileUp } from 'lucide-react';
import { listDocs, createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore';
import { nextNumber } from '@/lib/firebase/counters';
import { logAudit } from '@/lib/firebase/audit';
import { useAuth } from '@/components/providers/auth-provider';
import type { Product } from '@/types';
import type { ProductFormValues } from '@/lib/validations';
import { PRODUCT_CATEGORIES, PRODUCT_FITS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { printLabels } from '@/lib/utils/labels';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { ImportDialog, type ImportResult } from '@/components/shared/import-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ProductFormDialog } from './product-form-dialog';

const COLLECTION = 'products';

function toPayload(v: ProductFormValues) {
  return {
    modelCode: v.modelCode,
    name: { az: v.nameAz, en: v.nameEn || '' },
    category: v.category,
    subCategory: v.subCategory || null,
    colorName: v.colorName || null,
    colorCode: v.colorCode || null,
    washEffect: v.washEffect || null,
    fit: v.fit || null,
    weight: v.weight || null,
    season: v.season || null,
    collection: v.collection || null,
    sizes: v.sizes,
    wholesalePrice: v.wholesalePrice,
    retailPrice: v.retailPrice,
    status: v.status,
    description: { az: v.descriptionAz || '', en: v.descriptionEn || '' },
    images: (v.images ?? []).map((url, i) => ({ url, type: i === 0 ? 'main' : 'detail', isPrimary: i === 0 })),
  };
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [fit, setFit] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('products', 'create');
  const canUpdate = can('products', 'update');
  const canDelete = can('products', 'delete');

  const { data: products = [], isLoading } = useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<Product>(COLLECTION, [orderBy('createdAt', 'desc')]),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== ALL && p.category !== category) return false;
      if (fit !== ALL && p.fit !== fit) return false;
      if (status !== ALL && p.status !== status) return false;
      if (s && !(p.modelCode?.toLowerCase().includes(s) || p.name?.az?.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [products, search, category, fit, status]);

  const actor = { userId: profile?.uid ?? '', username: profile?.username ?? '' };

  async function handleSubmit(values: ProductFormValues) {
    setSubmitting(true);
    try {
      const payload = toPayload(values);
      if (editing) {
        await updateDocById(COLLECTION, editing.id, payload);
        await logAudit({ ...actor, action: 'UPDATE', entityType: 'Product', entityId: editing.id });
        toast.success('Məhsul yeniləndi');
      } else {
        const sku = await nextNumber('PRD');
        const id = await createDoc(COLLECTION, { ...payload, sku, cost: 0 });
        await logAudit({ ...actor, action: 'CREATE', entityType: 'Product', entityId: id });
        toast.success('Məhsul yaradıldı');
      }
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch (e) {
      console.error(e);
      toast.error('Məhsul yadda saxlanmadı');
    } finally {
      setSubmitting(false);
    }
  }

  async function importProducts(rows: Record<string, string>[]): Promise<ImportResult> {
    let created = 0, failed = 0;
    const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      try {
        const nameAz = r['Ad (AZ)'] || r['Ad'] || r['name'] || '';
        const modelCode = r['Model kodu'] || r['modelCode'] || '';
        if (!nameAz || !modelCode) { failed++; errors.push(`Sətir ${i + 2}: ad və ya model kodu boşdur`); continue; }
        const catRaw = (r['Kateqoriya'] || '').toLowerCase();
        const category = ['men', 'women', 'kids'].includes(catRaw) ? catRaw : catRaw.includes('qad') ? 'women' : (catRaw.includes('uşaq') || catRaw.includes('usaq')) ? 'kids' : 'men';
        const sku = await nextNumber('PRD');
        await createDoc(COLLECTION, {
          sku, modelCode, name: { az: nameAz, en: r['Ad (EN)'] || '' }, category,
          fit: r['Fit'] || null, wholesalePrice: +(r['Topdan qiymət'] || r['Topdan'] || 0) || 0,
          retailPrice: +(r['Pərakəndə qiymət'] || r['Pərakəndə'] || 0) || 0, cost: 0,
          status: r['Status'] || 'active', sizes: [], images: [],
        });
        created++;
      } catch (e) { failed++; errors.push(`Sətir ${i + 2}: ${e instanceof Error ? e.message : 'xəta'}`); }
    }
    return { created, failed, errors };
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocById(COLLECTION, deleteTarget.id);
      await logAudit({ ...actor, action: 'DELETE', entityType: 'Product', entityId: deleteTarget.id });
      toast.success('Məhsul silindi');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch {
      toast.error('Silinmə alınmadı');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Məhsul Kataloqu"
        subtitle="Modellər, qiymət və atributlar"
        action={
          <div className="flex gap-2">
            <ExportButton
              filename="mehsullar"
              rows={filtered}
              columns={[
                { header: 'SKU', value: 'sku' },
                { header: 'Model kodu', value: 'modelCode' },
                { header: 'Ad', value: (p) => p.name?.az ?? '' },
                { header: 'Kateqoriya', value: (p) => PRODUCT_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category },
                { header: 'Fit', value: (p) => (p.fit ? PRODUCT_FITS[p.fit] : '') },
                { header: 'Rəng', value: (p) => p.colorName ?? '' },
                { header: 'Topdan', value: (p) => p.wholesalePrice },
                { header: 'Pərakəndə', value: (p) => p.retailPrice },
                { header: 'Maya', value: (p) => p.cost },
                { header: 'Status', value: 'status' },
              ]}
            />
            <Button variant="outline" onClick={() => printLabels(filtered.map((p) => ({ code: p.sku || p.modelCode || p.id, name: p.name?.az ?? '', sub: formatCurrency(p.wholesalePrice, 'AZN') })))} disabled={filtered.length === 0}><QrCode className="h-4 w-4" /> Etiketlər</Button>
            {canCreate && <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> İmport</Button>}
            {canCreate && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni məhsul</Button>}
          </div>
        }
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="SKU, model kodu və ya ad..."
        filters={[
          { key: 'category', placeholder: 'Kateqoriya', value: category, onChange: setCategory, allLabel: 'Bütün kateqoriyalar', options: PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })) },
          { key: 'fit', placeholder: 'Fit', value: fit, onChange: setFit, allLabel: 'Bütün fitlər', options: Object.entries(PRODUCT_FITS).map(([v, l]) => ({ value: v, label: l })) },
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: [{ value: 'active', label: 'Aktiv' }, { value: 'draft', label: 'Qaralama' }, { value: 'archived', label: 'Arxiv' }] },
        ]}
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Məhsul tapılmadı" description={products.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ məhsul əlavə edilməyib'} action={canCreate && !products.length ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni məhsul</Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Kateqoriya</TableHead>
                <TableHead>Fit</TableHead>
                <TableHead className="text-right">Topdan</TableHead>
                <TableHead className="text-right">Maya</TableHead>
                <TableHead>Status</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Əməliyyat</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                        {(() => {
                          const img = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
                          return img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt={p.name?.az ?? ''} className="h-full w-full object-cover" />
                          ) : (
                            <Shirt className="h-4 w-4 text-muted-foreground" />
                          );
                        })()}
                      </span>
                      <div>
                        <p className="font-medium leading-none">{p.name?.az}</p>
                        <p className="text-xs text-muted-foreground">{p.modelCode}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{PRODUCT_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}</TableCell>
                  <TableCell>{p.fit ? PRODUCT_FITS[p.fit] : '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.wholesalePrice, 'AZN')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.cost, 'AZN')}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'active' ? 'success' : p.status === 'draft' ? 'secondary' : 'outline'}>
                      {p.status === 'active' ? 'Aktiv' : p.status === 'draft' ? 'Qaralama' : 'Arxiv'}
                    </Badge>
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                        {canDelete && <Button variant="ghost" size="icon" className="text-danger" onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Məhsul import (Excel)"
        headers={['Model kodu', 'Ad (AZ)', 'Ad (EN)', 'Kateqoriya', 'Fit', 'Topdan qiymət', 'Pərakəndə qiymət', 'Status']}
        required={['Model kodu', 'Ad (AZ)']}
        templateName="mehsul-import"
        onImport={importProducts}
        onDone={() => qc.invalidateQueries({ queryKey: [COLLECTION] })}
      />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSubmit={handleSubmit} submitting={submitting} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Məhsulu sil" description={`"${deleteTarget?.name?.az}" silinsin?`} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
