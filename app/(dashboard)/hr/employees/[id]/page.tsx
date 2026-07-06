'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, Pencil, Mail, Phone, MapPin, Calendar, Building2, Briefcase, Wallet, FileText, Upload, Trash2, Link2, Loader2, Plane } from 'lucide-react';
import { getDocById, listDocs, createDoc, deleteDocById } from '@/lib/firebase/firestore';
import { updateEmployee, linkEmployeeUser } from '@/lib/firebase/hr';
import { uploadFile } from '@/lib/firebase/storage';
import { useAuth } from '@/components/providers/auth-provider';
import type { AppUser, Department, Employee, EmployeeDocument, Position } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { EmployeeFormDialog } from '../employee-form-dialog';
import { EMP_STATUS_META, CONTRACT_LABELS, PAY_LABELS } from '../constants';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  const fileRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: emp, isLoading } = useQuery({ queryKey: ['employees', id], queryFn: () => getDocById<Employee>('employees', id) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => listDocs<Department>('departments') });
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => listDocs<Position>('positions') });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees') });
  const { data: users = [] } = useQuery({ queryKey: ['users-simple-hr'], queryFn: () => listDocs<AppUser>('users'), enabled: canManage });
  const { data: docs = [] } = useQuery({ queryKey: ['employee_documents', id], queryFn: () => listDocs<EmployeeDocument>('employee_documents', [where('employeeId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id });

  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();

  async function handleSubmit(v: Record<string, unknown>) {
    setSubmitting(true);
    try { await updateEmployee(id, v, actor); toast.success('Yeniləndi'); setFormOpen(false); qc.invalidateQueries({ queryKey: ['employees', id] }); qc.invalidateQueries({ queryKey: ['employees'] }); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSubmitting(false); }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(`hr/documents/${id}`, file);
      await createDoc('employee_documents', { employeeId: id, type: 'other', name: file.name, url });
      toast.success('Sənəd əlavə edildi'); qc.invalidateQueries({ queryKey: ['employee_documents', id] });
    } catch (e) { toast.error('Yüklənmədi', e instanceof Error ? e.message : undefined); } finally { setUploading(false); }
  }
  async function delDoc(docId: string) { await deleteDocById('employee_documents', docId); qc.invalidateQueries({ queryKey: ['employee_documents', id] }); }

  async function linkUser(userId: string) {
    try { await linkEmployeeUser(id, userId === '__none' ? null : userId, actor); toast.success('Hesab bağlandı'); qc.invalidateQueries({ queryKey: ['employees', id] }); }
    catch { toast.error('Alınmadı'); }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!emp) return <div><Button variant="ghost" onClick={() => router.push('/hr/employees')}><ArrowLeft className="h-4 w-4" /> Geri</Button><p className="mt-4 text-muted-foreground">İşçi tapılmadı.</p></div>;

  const st = EMP_STATUS_META[emp.status] ?? EMP_STATUS_META.active;

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/hr/employees')}><ArrowLeft className="h-4 w-4" /> İşçilər</Button>

      {/* Başlıq */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
          {emp.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emp.avatarUrl} alt={emp.fullName} className="h-full w-full object-cover" />
          ) : (emp.fullName || 'U').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{emp.fullName}</h1><Badge variant={st.variant}>{st.label}</Badge></div>
          <p className="text-sm text-muted-foreground">{emp.positionTitle ?? '—'} · {emp.departmentName ?? '—'} · {emp.employeeNo}</p>
        </div>
        {canManage && <Button onClick={() => setFormOpen(true)}><Pencil className="h-4 w-4" /> Düzəlt</Button>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Şəxsi + iş */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4 text-primary" /> İş məlumatları</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Info icon={Building2} label="Departament" value={emp.departmentName} />
              <Info icon={Briefcase} label="Vəzifə" value={emp.positionTitle} />
              <Info icon={Calendar} label="İşə qəbul" value={formatDate(ms(emp.hireDate))} />
              <Info label="Müqavilə" value={CONTRACT_LABELS[emp.contractType] ?? emp.contractType} />
              <Info label="Müqavilə bitmə" value={emp.contractEndDate ? formatDate(ms(emp.contractEndDate)) : '—'} />
              <Info icon={MapPin} label="İş yeri" value={emp.workLocation} />
              <Info icon={Plane} label="Məzuniyyət balansı" value={`${emp.leaveBalance ?? emp.annualLeaveEntitlement ?? 0} gün`} />
              <Info label="Rəhbər" value={employees.find((x) => x.id === emp.managerId)?.fullName} />
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail className="h-4 w-4 text-primary" /> Şəxsi məlumatlar</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Info icon={Phone} label="Telefon" value={emp.phone} />
              <Info icon={Mail} label="Email" value={emp.email} />
              <Info label="FIN" value={emp.nationalId} />
              <Info icon={Calendar} label="Doğum tarixi" value={emp.birthDate ? formatDate(ms(emp.birthDate)) : '—'} />
              <Info icon={MapPin} label="Ünvan" value={emp.address} />
              <Info label="Təcili əlaqə" value={emp.emergencyContact} />
            </CardContent>
          </Card>

          {/* Sənədlər */}
          <Card className="rounded-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Sənədlər</CardTitle>
              {canManage && <><Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Yüklə</Button><input ref={fileRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} /></>}
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Sənəd yoxdur</p> : docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline">{d.name}</a>
                  {canManage && <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => delDoc(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Əmək haqqı + ESS */}
        <div className="space-y-4">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" /> Əmək haqqı</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Ödəniş tipi</span><span className="font-medium">{PAY_LABELS[emp.payType] ?? emp.payType}</span></div>
              <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Baza maaş</span><span className="text-lg font-bold text-primary">{formatCurrency(emp.baseSalary ?? 0, 'AZN')}</span></div>
              {(emp.allowances ?? []).map((a, i) => <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground">+ {a.name}</span><span className="text-emerald-600">{formatCurrency(a.amount, 'AZN')}</span></div>)}
              {(emp.deductions ?? []).map((a, i) => <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground">− {a.name}</span><span className="text-rose-600">{formatCurrency(a.amount, 'AZN')}</span></div>)}
              <div className="border-t pt-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Bank</span><span>{emp.bankName ?? '—'}</span></div><div className="flex justify-between text-xs"><span className="text-muted-foreground">IBAN</span><span className="font-mono">{emp.iban ?? '—'}</span></div></div>
            </CardContent>
          </Card>

          {canManage && (
            <Card className="rounded-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4 text-primary" /> ESS hesabı</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">Self-service üçün istifadəçi hesabı bağla</p>
                <Select value={emp.userId ?? '__none'} onValueChange={linkUser}>
                  <SelectTrigger><SelectValue placeholder="Hesab seç" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">— bağlı deyil —</SelectItem>{users.map((u) => <SelectItem key={u.uid} value={u.uid}>{u.fullName || u.username} ({u.email})</SelectItem>)}</SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} initial={emp} departments={departments} positions={positions} employees={employees} onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value?: string | null }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">{Icon && <Icon className="h-3 w-3" />} {label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  );
}
