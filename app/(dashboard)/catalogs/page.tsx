'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { BookOpen, Eye, Globe, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createCatalog, updateCatalog, deleteCatalog, setCatalogStatus, type CatalogInput } from '@/lib/firebase/catalogs';
import { logAudit } from '@/lib/firebase/audit';
import { useAuth } from '@/components/providers/auth-provider';
import type { Catalog, Product } from '@/types';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import { CatalogFormDialog } from './catalog-form-dialog';

const STATUS_META: Record<string, { label: string; variant: 'success' | 'secondary' | 'outline' }> = {
  published: { label: 'Dərc olunmuş', variant: 'success' },
  draft: { label: 'Qaralama', variant: 'secondary' },
  archived: { label: 'Arxiv', variant: 'outline' },
};

export default function CatalogsPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Catalog | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Catalog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('products', 'create');
  const canUpdate = can('products', 'update');
  const canDelete = can('products', 'delete');

  const { data: catalogs = [], isLoading } = useQuery({
    queryKey: ['catalogs'],
    queryFn: () => listDocs<Catalog>('catalogs', [orderBy('createdAt', 'desc')]),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => listDocs<Product>('products', [orderBy('createdAt', 'desc')]),
  });

  const byId = new Map(products.map((p) => [p.id, p]));
  const actor = { userId: profile?.uid ?? '', username: profile?.username ?? '' };

  function coverUrl(c: Catalog): string | undefined {
    const id = c.coverProductId || c.productIds[0];
    const p = id ? byId.get(id) : undefined;
    return p?.images?.find((i) => i.isPrimary)?.url ?? p?.images?.[0]?.url;
  }

  async function handleSubmit(values: CatalogInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateCatalog(editing.id, values);
        await logAudit({ ...actor, action: 'UPDATE', entityType: 'Catalog', entityId: editing.id });
        toast.success('Jurnal yeniləndi');
      } else {
        const id = await createCatalog(values);
        await logAudit({ ...actor, action: 'CREATE', entityType: 'Catalog', entityId: id });
        toast.success('Jurnal yaradıldı');
      }
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: ['catalogs'] });
    } catch (e) {
      console.error(e);
      toast.error('Jurnal yadda saxlanmadı');
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublish(c: Catalog) {
    const next = c.status === 'published' ? 'draft' : 'published';
    try {
      await setCatalogStatus(c.id, next);
      await logAudit({ ...actor, action: 'UPDATE', entityType: 'Catalog', entityId: c.id });
      toast.success(next === 'published' ? 'Jurnal dərc olundu' : 'Jurnal geri çəkildi');
      qc.invalidateQueries({ queryKey: ['catalogs'] });
    } catch {
      toast.error('Status dəyişmədi');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCatalog(deleteTarget.id);
      await logAudit({ ...actor, action: 'DELETE', entityType: 'Catalog', entityId: deleteTarget.id });
      toast.success('Jurnal silindi');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['catalogs'] });
    } catch {
      toast.error('Silinmə alınmadı');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Kataloq Jurnalları"
        subtitle="Kolleksiya və sezon jurnalları — yarat, preview et, dərc et"
        action={canCreate && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni jurnal</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 w-full rounded-card" />)}
        </div>
      ) : catalogs.length === 0 ? (
        <Card className="rounded-card">
          <EmptyState
            title="Hələ jurnal yoxdur"
            description="İlk kolleksiya jurnalınızı yaradın — modelləri seçin, sıralayın və dərc edin."
            action={canCreate ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni jurnal</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogs.map((c) => {
            const cover = coverUrl(c);
            const meta = STATUS_META[c.status] ?? STATUS_META.draft;
            return (
              <Card key={c.id} className="group overflow-hidden rounded-card p-0">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={c.title?.az ?? ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#16182f] text-white/20">
                      <BookOpen className="h-12 w-12" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <Badge variant={meta.variant} className="absolute right-2 top-2">{meta.label}</Badge>
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    {c.season && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">{c.season}</p>}
                    <h3 className="truncate text-lg font-bold leading-tight">{c.title?.az}</h3>
                    <p className="text-xs text-white/80">{c.productIds.length} model{c.issueNumber ? ` · № ${c.issueNumber}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/catalog?journal=${c.id}`} target="_blank"><Eye className="h-4 w-4" /> Preview</Link>
                  </Button>
                  <div className="flex items-center gap-0.5">
                    {canUpdate && (
                      <Button
                        variant={c.status === 'published' ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => togglePublish(c)}
                        title={c.status === 'published' ? 'Geri çək' : 'Dərc et'}
                      >
                        {c.status === 'published' ? <><Undo2 className="h-4 w-4" /> Geri çək</> : <><Globe className="h-4 w-4" /> Dərc et</>}
                      </Button>
                    )}
                    {canUpdate && <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" className="text-danger" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CatalogFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} products={products} onSubmit={handleSubmit} submitting={submitting} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Jurnalı sil" description={`"${deleteTarget?.title?.az}" jurnalı silinsin?`} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
