'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { listDocs, createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore';
import { logAudit } from '@/lib/firebase/audit';
import { useAuth } from '@/components/providers/auth-provider';
import type { Supplier } from '@/types';
import type { SupplierFormValues } from '@/lib/validations';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { SupplierFormDialog } from './supplier-form-dialog';

const COLLECTION = 'suppliers';

export default function SuppliersPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('suppliers', 'create');
  const canUpdate = can('suppliers', 'update');
  const canDelete = can('suppliers', 'delete');

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<Supplier>(COLLECTION),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return suppliers;
    return suppliers.filter(
      (x) =>
        x.code?.toLowerCase().includes(s) ||
        x.name?.toLowerCase().includes(s) ||
        x.contactPerson?.toLowerCase().includes(s),
    );
  }, [suppliers, search]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setFormOpen(true);
  }

  async function handleSubmit(values: SupplierFormValues) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateDocById(COLLECTION, editing.id, values);
        await logAudit({
          userId: profile?.uid ?? '',
          username: profile?.username ?? '',
          action: 'UPDATE',
          entityType: 'Supplier',
          entityId: editing.id,
        });
        toast.success('Təchizatçı yeniləndi');
      } else {
        const id = await createDoc(COLLECTION, { ...values, currentBalance: 0 });
        await logAudit({
          userId: profile?.uid ?? '',
          username: profile?.username ?? '',
          action: 'CREATE',
          entityType: 'Supplier',
          entityId: id,
        });
        toast.success('Təchizatçı yaradıldı');
      }
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch (e) {
      console.error(e);
      toast.error('Xəta baş verdi', 'Təchizatçı yadda saxlanmadı');
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
        entityType: 'Supplier',
        entityId: deleteTarget.id,
      });
      toast.success('Təchizatçı silindi');
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
        title="Təchizatçılar"
        subtitle="Təchizatçı kontragentləri"
        action={
          <div className="flex gap-2">
            <ExportButton filename="techizatcilar" rows={filtered} columns={[
              { header: 'Kod', value: 'code' },
              { header: 'Ad', value: 'name' },
              { header: 'Əlaqə', value: (s) => s.contactPerson ?? '' },
              { header: 'Telefon', value: (s) => s.phone ?? '' },
              { header: 'Email', value: (s) => s.email ?? '' },
              { header: 'VÖEN', value: (s) => s.taxNumber ?? '' },
              { header: 'Reytinq', value: (s) => s.rating ?? '' },
            ]} />
            {canCreate && <Button onClick={openCreate}><Plus /> Yeni təchizatçı</Button>}
          </div>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Kod, ad və ya əlaqədar şəxs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Təchizatçı tapılmadı"
            description={search ? 'Axtarışa uyğun nəticə yoxdur' : 'Hələ təchizatçı əlavə edilməyib'}
            action={canCreate && !search ? <Button onClick={openCreate}><Plus /> Yeni təchizatçı</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Əlaqədar şəxs</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Ölkə</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balans</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Əməliyyat</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs"><Link href={`/suppliers/${s.id}`} className="hover:underline">{s.code}</Link></TableCell>
                  <TableCell className="font-medium"><Link href={`/suppliers/${s.id}`} className="hover:underline">{s.name}</Link></TableCell>
                  <TableCell>{s.contactPerson || '—'}</TableCell>
                  <TableCell>{s.phone || '—'}</TableCell>
                  <TableCell>{s.country || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? 'success' : 'secondary'}>{s.isActive ? 'Aktiv' : 'Deaktiv'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(s.currentBalance ?? 0, s.currency)}</TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Düzəlt">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(s)}
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Təchizatçını sil"
        description={`"${deleteTarget?.name}" silinsin?`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
