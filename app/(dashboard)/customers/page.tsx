'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Handshake, Pencil, Plus, Trash2, FileUp } from 'lucide-react';
import { listDocs, createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore';
import { nextNumber } from '@/lib/firebase/counters';
import { logAudit } from '@/lib/firebase/audit';
import { useAuth } from '@/components/providers/auth-provider';
import type { Customer } from '@/types';
import type { CustomerFormValues } from '@/lib/validations';
import { CUSTOMER_SEGMENTS, CUSTOMER_TYPES } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils/format';
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
import { CustomerFormDialog } from './customer-form-dialog';

const COLLECTION = 'customers';

export default function CustomersPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [search, setSearch] = useState('');
  const [type, setType] = useState(ALL);
  const [segment, setSegment] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
    return customers.filter((c) => {
      if (type !== ALL && c.type !== type) return false;
      if (segment !== ALL && c.segment !== segment) return false;
      if (status !== ALL && c.status !== status) return false;
      if (s && !(c.name?.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s) || c.companyName?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [customers, search, type, segment, status]);

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

  async function importCustomers(rows: Record<string, string>[]): Promise<ImportResult> {
    let created = 0, failed = 0;
    const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      try {
        const name = r['Ad'] || r['name'] || '';
        if (!name) { failed++; errors.push(`Sətir ${i + 2}: ad boşdur`); continue; }
        const typeRaw = (r['Növ'] || '').toLowerCase();
        const type = ['wholesale', 'retail', 'distributor'].includes(typeRaw) ? typeRaw : typeRaw.includes('pərak') || typeRaw.includes('perak') ? 'retail' : typeRaw.includes('distrib') ? 'distributor' : 'wholesale';
        const code = await nextNumber('CUS');
        await createDoc(COLLECTION, {
          code, name, companyName: r['Şirkət'] || null, taxNumber: r['VÖEN'] || null,
          phone: r['Telefon'] || null, email: r['Email'] || null, address: r['Ünvan'] || null,
          type, segment: r['Seqment'] || 'regular', creditLimit: +(r['Kredit limiti'] || 0) || 0,
          paymentTermDays: +(r['Ödəniş günü'] || 0) || 0, discountRate: +(r['Endirim %'] || 0) || 0,
          currentBalance: 0, status: 'active',
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
            <ExportButton
              filename="musteriler"
              rows={filtered}
              columns={[
                { header: 'Kod', value: 'code' },
                { header: 'Ad', value: 'name' },
                { header: 'Şirkət', value: (c) => c.companyName ?? '' },
                { header: 'VÖEN', value: (c) => c.taxNumber ?? '' },
                { header: 'Telefon', value: (c) => c.phone ?? '' },
                { header: 'Email', value: (c) => c.email ?? '' },
                { header: 'Seqment', value: 'segment' },
                { header: 'Kredit limiti', value: 'creditLimit' },
                { header: 'Cari balans (AR)', value: 'currentBalance' },
                { header: 'Status', value: 'status' },
              ]}
            />
            <Button variant="outline" asChild><Link href="/crm"><Handshake className="h-4 w-4" /> CRM / Pipeline</Link></Button>
            {canCreate && <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> İmport</Button>}
            {canCreate && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni müştəri</Button>}
          </div>
        }
      />
      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Ad, kod və ya şirkət..."
        filters={[
          { key: 'type', placeholder: 'Növ', value: type, onChange: setType, allLabel: 'Bütün növlər', options: Object.entries(CUSTOMER_TYPES).map(([v, l]) => ({ value: v, label: l })) },
          { key: 'segment', placeholder: 'Seqment', value: segment, onChange: setSegment, allLabel: 'Bütün seqmentlər', options: Object.entries(CUSTOMER_SEGMENTS).map(([v, m]) => ({ value: v, label: m.label })) },
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: [{ value: 'active', label: 'Aktiv' }, { value: 'inactive', label: 'Passiv' }, { value: 'blacklist', label: 'Qara siyahı' }] },
        ]}
      />
      <Card className="rounded-card">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Müştəri tapılmadı" description={customers.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ müştəri yoxdur'} action={canCreate && !customers.length ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni müştəri</Button> : undefined} />
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
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Müştəri import (Excel)"
        headers={['Ad', 'Şirkət', 'VÖEN', 'Telefon', 'Email', 'Ünvan', 'Növ', 'Seqment', 'Kredit limiti', 'Ödəniş günü', 'Endirim %']}
        required={['Ad']}
        templateName="musteri-import"
        onImport={importCustomers}
        onDone={() => qc.invalidateQueries({ queryKey: [COLLECTION] })}
      />
      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSubmit={handleSubmit} submitting={submitting} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Müştərini sil" description={`"${deleteTarget?.name}" silinsin?`} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
