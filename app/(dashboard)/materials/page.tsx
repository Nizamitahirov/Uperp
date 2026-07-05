'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { listDocs, createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore';
import { logAudit } from '@/lib/firebase/audit';
import { useAuth } from '@/components/providers/auth-provider';
import type { RawMaterial } from '@/types';
import type { RawMaterialFormValues } from '@/lib/validations';
import { MATERIAL_CATEGORY_LABELS } from '@/lib/constants';
import { getStockStatus, STOCK_STATUS_META } from '@/lib/utils/stock';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { MaterialFormDialog } from './material-form-dialog';

const COLLECTION = 'raw_materials';

export default function MaterialsPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [stock, setStock] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RawMaterial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('raw_materials', 'create');
  const canUpdate = can('raw_materials', 'update');
  const canDelete = can('raw_materials', 'delete');

  const { data: materials = [], isLoading } = useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<RawMaterial>(COLLECTION),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return materials.filter((m) => {
      if (category !== ALL && m.category !== category) return false;
      if (stock !== ALL && getStockStatus(m) !== stock) return false;
      if (s && !(m.code?.toLowerCase().includes(s) || m.name?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [materials, search, category, stock]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(m: RawMaterial) {
    setEditing(m);
    setFormOpen(true);
  }

  async function handleSubmit(values: RawMaterialFormValues) {
    setSubmitting(true);
    try {
      const stockValue = (values.currentStock || 0) * (values.avgCost || 0);
      const payload = { ...values, stockValue };
      if (editing) {
        await updateDocById(COLLECTION, editing.id, payload);
        await logAudit({
          userId: profile?.uid ?? '',
          username: profile?.username ?? '',
          action: 'UPDATE',
          entityType: 'RawMaterial',
          entityId: editing.id,
        });
        toast.success('Material yeniləndi');
      } else {
        const id = await createDoc(COLLECTION, payload);
        await logAudit({
          userId: profile?.uid ?? '',
          username: profile?.username ?? '',
          action: 'CREATE',
          entityType: 'RawMaterial',
          entityId: id,
        });
        toast.success('Material yaradıldı');
      }
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch (e) {
      console.error(e);
      toast.error('Xəta baş verdi', 'Material yadda saxlanmadı');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocById(COLLECTION, deleteTarget.id);
      await logAudit({
        userId: profile?.uid ?? '',
        username: profile?.username ?? '',
        action: 'DELETE',
        entityType: 'RawMaterial',
        entityId: deleteTarget.id,
      });
      toast.success('Material silindi');
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
        title="Xam Material Anbarı"
        subtitle="Material kataloqu, stok və maya dəyəri"
        action={canCreate ? <Button onClick={openCreate}><Plus /> Yeni material</Button> : undefined}
      />

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Kod və ya ad üzrə axtar..."
        filters={[
          { key: 'category', placeholder: 'Kateqoriya', value: category, onChange: setCategory, allLabel: 'Bütün kateqoriyalar', options: Object.entries(MATERIAL_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l })) },
          { key: 'stock', placeholder: 'Stok statusu', value: stock, onChange: setStock, allLabel: 'Bütün statuslar', options: Object.entries(STOCK_STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
        ]}
        right={
          <ExportButton
            filename="xam-material"
            rows={filtered}
            columns={[
              { header: 'Kod', value: 'code' },
              { header: 'Ad', value: 'name' },
              { header: 'Kateqoriya', value: 'category' },
              { header: 'Vahid', value: 'unit' },
              { header: 'Cari stok', value: 'currentStock' },
              { header: 'Min stok', value: 'minStock' },
              { header: 'Reorder', value: (m) => m.reorderPoint ?? '' },
              { header: 'Orta maya', value: (m) => m.avgCost ?? '' },
              { header: 'Stok dəyəri', value: (m) => m.stockValue ?? '' },
            ]}
          />
        }
      />

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Material tapılmadı"
            description={materials.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ material əlavə edilməyib'}
            action={canCreate && !materials.length ? <Button onClick={openCreate}><Plus /> Yeni material</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Kateqoriya</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orta maya</TableHead>
                <TableHead className="text-right">Stok dəyəri</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Əməliyyat</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const status = getStockStatus(m);
                const meta = STOCK_STATUS_META[status];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/materials/${m.id}`} className="hover:underline">
                        {m.code}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/materials/${m.id}`} className="hover:underline">
                        {m.name}
                      </Link>
                    </TableCell>
                    <TableCell>{MATERIAL_CATEGORY_LABELS[m.category] ?? m.category}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(m.currentStock)} {m.unit}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${meta.className}`}>
                        {meta.dot} {meta.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(m.avgCost, m.currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.stockValue, m.currency)}</TableCell>
                    {(canUpdate || canDelete) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canUpdate && (
                            <Button variant="ghost" size="icon" onClick={() => openEdit(m)} aria-label="Düzəlt">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(m)}
                              aria-label="Sil"
                              className="text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <MaterialFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Materialı sil"
        description={`"${deleteTarget?.name}" silinsin? Bu əməliyyat geri qaytarıla bilməz.`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
