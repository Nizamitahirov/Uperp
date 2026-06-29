'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Handshake, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { listDocs, createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore';
import { nextNumber } from '@/lib/firebase/counters';
import { logAudit } from '@/lib/firebase/audit';
import { useAuth } from '@/components/providers/auth-provider';
import type { Customer } from '@/types';
import type { CustomerFormValues } from '@/lib/validations';
import { CUSTOMER_SEGMENTS, CUSTOMER_TYPES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { CustomerFormDialog } from './customer-form-dialog';

const COLLECTION = 'customers';

export default function CustomersPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = can('customers', 'create');
  const canUpdate = can('customers', 'update');
  const canDelete = can('customers', 'delete');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: [COLLECTION],
    queryFn: () => listDocs<Customer>(COLLECTION, [orderBy('createdAt', 'desc')]),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => c.name?.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s) || c.companyName?.toLowerCase().includes(s));
  }, [customers, search]);

  const actor = { userId: profile?.uid ?? '', username: profile?.username ?? '' };

  async function handleSubmit(values: CustomerFormValues) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateDocById(COLLECTION, editing.id, values);
        await logAudit({ ...actor, action: 'UPDATE', entityType: 'Customer', entityId: editing.id });
        toast.success('Müştəri yeniləndi');
      } else {
        const code = await nextNumber('CUS');
        const id = await createDoc(COLLECTION, { ...values, code, currentBalance: 0 });
        await logAudit({ ...actor, action: 'CREATE', entityType: 'Customer', entityId: id });
        toast.success('Müştəri yaradıldı');
      }
      setFormOpen(false);
      qc.invalidateQueries({ queryKey: [COLLECTION] });
    } catch (e) {
      console.error(e);
      toast.error('Yadda saxlanmadı');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocById(COLLECTION, deleteTarget.id);
      await logAudit({ ...actor, action: 'DELETE', entityType: 'Customer', entityId: deleteTarget.id });
      toast.success('Müştəri silindi');
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
        title="Müştərilər"
        subtitle="B2B/B2C müştərilər, seqment və kredit"
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/crm"><Handshake className="h-4 w-4" /> CRM / Pipeline</Link></Button>
            {canCreate && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni müştəri</Button>}
          </div>
        }
      />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Ad, kod və ya şirkət..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Müştəri tapılmadı" description={search ? 'Nəticə yoxdur' : 'Hələ müştəri yoxdur'} action={canCreate && !search ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni müştəri</Button> : undefined} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Növ</TableHead>
                <TableHead>Seqment</TableHead>
                <TableHead className="text-right">Balans (AR)</TableHead>
                <TableHead>Status</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Əməliyyat</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const seg = CUSTOMER_SEGMENTS[c.segment] ?? CUSTOMER_SEGMENTS.regular;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs"><Link href={`/customers/${c.id}`} className="hover:underline">{c.code}</Link></TableCell>
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="hover:underline">
                        <p className="font-medium">{c.name}</p>
                        {c.companyName && <p className="text-xs text-muted-foreground">{c.companyName}</p>}
                      </Link>
                    </TableCell>
                    <TableCell>{CUSTOMER_TYPES[c.type]}</TableCell>
                    <TableCell><Badge variant={seg.variant}>{seg.label}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(c.currentBalance ?? 0, 'AZN')}</TableCell>
                    <TableCell><Badge variant={c.status === 'active' ? 'success' : c.status === 'blacklist' ? 'destructive' : 'secondary'}>{c.status}</Badge></TableCell>
                    {(canUpdate || canDelete) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canUpdate && <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                          {canDelete && <Button variant="ghost" size="icon" className="text-danger" onClick={() => setDeleteTarget(c)}><Trash2 className="h-4 w-4" /></Button>}
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
      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSubmit={handleSubmit} submitting={submitting} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Müştərini sil" description={`"${deleteTarget?.name}" silinsin?`} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
