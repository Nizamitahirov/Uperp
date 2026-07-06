'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Plus, FileUp, UsersRound } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createEmployee, updateEmployee } from '@/lib/firebase/hr';
import { useAuth } from '@/components/providers/auth-provider';
import type { Department, Employee, Position } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { ImportDialog, type ImportResult } from '@/components/shared/import-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { EmployeeFormDialog } from './employee-form-dialog';
import { EMP_STATUS_META, CONTRACT_LABELS } from './constants';

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'create');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [contract, setContract] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees', [orderBy('createdAt', 'desc')]) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => listDocs<Department>('departments') });
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => listDocs<Position>('positions') });

  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (dept !== ALL && e.departmentId !== dept) return false;
      if (status !== ALL && e.status !== status) return false;
      if (contract !== ALL && e.contractType !== contract) return false;
      if (s && !(e.fullName?.toLowerCase().includes(s) || e.employeeNo?.toLowerCase().includes(s) || e.positionTitle?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [employees, search, dept, status, contract]);

  async function handleSubmit(v: Record<string, unknown>) {
    setSubmitting(true);
    try {
      if (editing) { await updateEmployee(editing.id, v, actor); toast.success('İşçi yeniləndi'); }
      else { await createEmployee(v as never, actor); toast.success('İşçi əlavə edildi'); }
      setFormOpen(false); qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (e) { toast.error('Yadda saxlanmadı', e instanceof Error ? e.message : undefined); } finally { setSubmitting(false); }
  }

  async function importEmployees(rows: Record<string, string>[]): Promise<ImportResult> {
    let created = 0, failed = 0; const errors: string[] = [];
    for (const [i, r] of rows.entries()) {
      try {
        const first = r['Ad'] || ''; if (!first) { failed++; errors.push(`Sətir ${i + 2}: ad boşdur`); continue; }
        const dep = departments.find((d) => d.name === r['Departament']);
        const pos = positions.find((p) => p.title === r['Vəzifə']);
        await createEmployee({
          firstName: first, lastName: r['Soyad'] || '', phone: r['Telefon'] || null, email: r['Email'] || null,
          departmentId: dep?.id ?? null, departmentName: dep?.name ?? null, positionId: pos?.id ?? null, positionTitle: pos?.title ?? null,
          contractType: 'permanent', status: 'active', payType: (r['Ödəniş tipi'] === 'piece_rate' ? 'piece_rate' : 'monthly'),
          baseSalary: +(r['Baza maaş'] || 0) || 0, annualLeaveEntitlement: 30, hireDate: r['İşə qəbul'] ? new Date(r['İşə qəbul']) : null,
        } as never, actor);
        created++;
      } catch (e) { failed++; errors.push(`Sətir ${i + 2}: ${e instanceof Error ? e.message : 'xəta'}`); }
    }
    return { created, failed, errors };
  }

  return (
    <div>
      <PageHeader title="İşçilər" subtitle="İşçi kartotekası — şəxsi, iş və əmək haqqı məlumatları" action={
        <div className="flex gap-2">
          {canManage && <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" /> İmport</Button>}
          {canManage && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni işçi</Button>}
        </div>
      } />

      <FilterBar
        search={search} onSearch={setSearch} searchPlaceholder="Ad, tabel№ və ya vəzifə..."
        filters={[
          { key: 'dept', placeholder: 'Departament', value: dept, onChange: setDept, allLabel: 'Bütün departamentlər', options: departments.map((d) => ({ value: d.id, label: d.name })) },
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(EMP_STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
          { key: 'contract', placeholder: 'Müqavilə', value: contract, onChange: setContract, allLabel: 'Bütün tiplər', options: Object.entries(CONTRACT_LABELS).map(([v, l]) => ({ value: v, label: l })) },
        ]}
        right={<ExportButton filename="isciler" rows={filtered} columns={[
          { header: 'Tabel№', value: 'employeeNo' }, { header: 'Ad Soyad', value: 'fullName' },
          { header: 'Departament', value: (e) => e.departmentName ?? '' }, { header: 'Vəzifə', value: (e) => e.positionTitle ?? '' },
          { header: 'Telefon', value: (e) => e.phone ?? '' }, { header: 'Baza maaş', value: 'baseSalary' }, { header: 'Status', value: 'status' },
        ]} />}
      />

      <Card className="rounded-card">
        {isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : filtered.length === 0 ? <EmptyState title="İşçi tapılmadı" description={employees.length ? 'Filtrə uyğun nəticə yoxdur' : 'İlk işçini əlavə edin'} action={canManage && !employees.length ? <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Yeni işçi</Button> : undefined} />
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Tabel№</TableHead><TableHead>İşçi</TableHead><TableHead>Departament / Vəzifə</TableHead><TableHead>İşə qəbul</TableHead><TableHead className="text-right">Baza maaş</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const st = EMP_STATUS_META[e.status] ?? EMP_STATUS_META.active;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.employeeNo}</TableCell>
                        <TableCell>
                          <Link href={`/hr/employees/${e.id}`} className="flex items-center gap-2.5 hover:underline">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {e.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={e.avatarUrl} alt={e.fullName} className="h-full w-full object-cover" />
                              ) : (e.fullName || 'U').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="font-medium">{e.fullName}</span>
                          </Link>
                        </TableCell>
                        <TableCell><p className="text-sm">{e.positionTitle ?? '—'}</p><p className="text-xs text-muted-foreground">{e.departmentName ?? '—'}</p></TableCell>
                        <TableCell>{formatDate(ms(e.hireDate))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(e.baseSalary ?? 0, 'AZN')}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </Card>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} departments={departments} positions={positions} employees={employees} onSubmit={handleSubmit} submitting={submitting} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} title="İşçi import (Excel)"
        headers={['Ad', 'Soyad', 'Departament', 'Vəzifə', 'Telefon', 'Email', 'Ödəniş tipi', 'Baza maaş', 'İşə qəbul']} required={['Ad']} templateName="isci-import"
        onImport={importEmployees} onDone={() => qc.invalidateQueries({ queryKey: ['employees'] })} />
    </div>
  );
}
