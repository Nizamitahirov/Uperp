'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy, where } from 'firebase/firestore';
import { ArrowLeft, Pencil, Mail, Phone, MapPin, Calendar, Building2, Briefcase, Wallet, FileText, Upload, Trash2, Link2, Loader2, Plane, UserX, TrendingUp, ShieldAlert, Plus } from 'lucide-react';
import { getDocById, listDocs, createDoc, deleteDocById } from '@/lib/firebase/firestore';
import { updateEmployee, linkEmployeeUser, terminateEmployee, previewSettlement, type SettlementPreview } from '@/lib/firebase/hr';
import { reviseSalary, addDisciplinary, DISCIPLINARY_CATEGORIES, DISCIPLINARY_CATEGORY_MAP } from '@/lib/firebase/employee-records';
import { uploadFile } from '@/lib/firebase/storage';
import { useAuth } from '@/components/providers/auth-provider';
import type { AppUser, Department, DisciplinaryRecord, Employee, EmployeeDocument, LeaveTransaction, Position, SalaryHistory } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { formatCurrency as fc } from '@/lib/utils/format';
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
  const [termOpen, setTermOpen] = useState(false);
  const [term, setTerm] = useState({ terminationDate: new Date().toISOString().slice(0, 10), reason: '', note: '' });
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [salOpen, setSalOpen] = useState(false);
  const [sal, setSal] = useState({ effectiveDate: new Date().toISOString().slice(0, 10), newSalary: '', newPayType: '', reason: '' });
  const [savingSal, setSavingSal] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [disc, setDisc] = useState({ date: new Date().toISOString().slice(0, 10), category: 'warning' as DisciplinaryRecord['category'], subject: '', details: '' });
  const [savingDisc, setSavingDisc] = useState(false);

  const { data: emp, isLoading } = useQuery({ queryKey: ['employees', id], queryFn: () => getDocById<Employee>('employees', id) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => listDocs<Department>('departments') });
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => listDocs<Position>('positions') });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees') });
  const { data: users = [] } = useQuery({ queryKey: ['users-simple-hr'], queryFn: () => listDocs<AppUser>('users'), enabled: canManage });
  const { data: docs = [] } = useQuery({ queryKey: ['employee_documents', id], queryFn: () => listDocs<EmployeeDocument>('employee_documents', [where('employeeId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id });
  const { data: ledger = [] } = useQuery({ queryKey: ['leave_transactions', id], queryFn: () => listDocs<LeaveTransaction>('leave_transactions', [where('employeeId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id });
  const { data: salaryHistory = [] } = useQuery({ queryKey: ['salary_history', id], queryFn: () => listDocs<SalaryHistory>('salary_history', [where('employeeId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id && canManage });
  const { data: disciplinary = [] } = useQuery({ queryKey: ['disciplinary_records', id], queryFn: () => listDocs<DisciplinaryRecord>('disciplinary_records', [where('employeeId', '==', id), orderBy('createdAt', 'desc')]), enabled: !!id && canManage });

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

  async function openTerm() { if (!emp) return; try { setPreview(await previewSettlement(emp)); } catch { setPreview(null); } setTermOpen(true); }
  async function doTerminate() {
    if (!emp) return;
    setTerminating(true);
    try {
      await terminateEmployee(emp, term, actor);
      toast.success('İşçi işdən çıxarıldı — yekun haqq-hesab yaradıldı');
      setTermOpen(false); qc.invalidateQueries({ queryKey: ['employees', id] }); qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setTerminating(false); }
  }

  function openSal() { if (!emp) return; setSal({ effectiveDate: new Date().toISOString().slice(0, 10), newSalary: String(emp.baseSalary ?? ''), newPayType: emp.payType, reason: '' }); setSalOpen(true); }
  async function doRevise() {
    if (!emp || !sal.newSalary) { toast.error('Yeni maaş tələb olunur'); return; }
    setSavingSal(true);
    try {
      await reviseSalary(emp, { effectiveDate: sal.effectiveDate, newSalary: +sal.newSalary, newPayType: (sal.newPayType || emp.payType) as Employee['payType'], reason: sal.reason || undefined }, actor);
      toast.success('Maaş yeniləndi'); setSalOpen(false);
      qc.invalidateQueries({ queryKey: ['employees', id] }); qc.invalidateQueries({ queryKey: ['salary_history', id] }); qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSavingSal(false); }
  }
  async function doDisc() {
    if (!emp || !disc.subject.trim()) { toast.error('Mövzu tələb olunur'); return; }
    setSavingDisc(true);
    try {
      await addDisciplinary(emp, { date: disc.date, category: disc.category, subject: disc.subject, details: disc.details || undefined }, actor);
      toast.success('Qeyd əlavə edildi'); setDiscOpen(false); setDisc({ date: new Date().toISOString().slice(0, 10), category: 'warning', subject: '', details: '' });
      qc.invalidateQueries({ queryKey: ['disciplinary_records', id] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSavingDisc(false); }
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
        {canManage && (
          <div className="flex gap-2">
            {emp.status !== 'terminated' && <Button variant="outline" className="text-danger" onClick={openTerm}><UserX className="h-4 w-4" /> İşdən çıxar</Button>}
            <Button onClick={() => setFormOpen(true)}><Pencil className="h-4 w-4" /> Düzəlt</Button>
          </div>
        )}
      </div>

      {emp.status === 'terminated' && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
          <UserX className="h-5 w-5 text-rose-600" />
          <span>İşdən çıxıb{emp.terminationDate ? ` · ${formatDate(ms(emp.terminationDate))}` : ''}{emp.terminationReason ? ` · ${emp.terminationReason}` : ''}</span>
        </div>
      )}

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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-primary" /> Əmək haqqı</CardTitle>
              {canManage && emp.status !== 'terminated' && <Button variant="outline" size="sm" onClick={openSal}><TrendingUp className="h-4 w-4" /> Dəyişiklik</Button>}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Ödəniş tipi</span><span className="font-medium">{PAY_LABELS[emp.payType] ?? emp.payType}</span></div>
              <div className="flex items-baseline justify-between"><span className="text-muted-foreground">Baza maaş</span><span className="text-lg font-bold text-primary">{formatCurrency(emp.baseSalary ?? 0, 'AZN')}</span></div>
              {(emp.allowances ?? []).map((a, i) => <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground">+ {a.name}</span><span className="text-emerald-600">{formatCurrency(a.amount, 'AZN')}</span></div>)}
              {(emp.deductions ?? []).map((a, i) => <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground">− {a.name}</span><span className="text-rose-600">{formatCurrency(a.amount, 'AZN')}</span></div>)}
              <div className="border-t pt-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Bank</span><span>{emp.bankName ?? '—'}</span></div><div className="flex justify-between text-xs"><span className="text-muted-foreground">IBAN</span><span className="font-mono">{emp.iban ?? '—'}</span></div></div>
              {canManage && salaryHistory.length > 0 && (
                <div className="border-t pt-2">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Maaş tarixçəsi</p>
                  {salaryHistory.slice(0, 6).map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-muted-foreground">{h.effectiveDate}{h.reason ? ` · ${h.reason}` : ''}</span>
                      <span className="font-medium">{formatCurrency(h.previousSalary, 'AZN')} → <span className="text-primary">{formatCurrency(h.newSalary, 'AZN')}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canManage && (
            <Card className="rounded-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-primary" /> İntizam qeydləri</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setDiscOpen(true)}><Plus className="h-4 w-4" /> Əlavə</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {disciplinary.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Qeyd yoxdur</p> : disciplinary.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between"><span className="text-sm font-medium">{d.subject}</span><Badge variant={d.category === 'suspension' || d.category === 'reprimand' ? 'destructive' : 'secondary'}>{DISCIPLINARY_CATEGORY_MAP.get(d.category)}</Badge></div>
                    <p className="text-xs text-muted-foreground">{d.date}{d.details ? ` · ${d.details}` : ''}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-card">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plane className="h-4 w-4 text-primary" /> Məzuniyyət tarixçəsi</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {ledger.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Hərəkət yoxdur</p> : ledger.slice(0, 10).map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
                  <span className="text-muted-foreground">{t.type === 'accrual' ? 'Toplanma' : t.type === 'usage' ? 'İstifadə' : t.type === 'reversal' ? 'Geri qaytarma' : t.type === 'opening' ? 'Açılış' : 'Düzəliş'}{t.period ? ` · ${t.period}` : ''}</span>
                  <span className={t.days >= 0 ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>{t.days >= 0 ? '+' : ''}{t.days} gün</span>
                </div>
              ))}
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

      <Dialog open={termOpen} onOpenChange={setTermOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>İşdən çıxarma və yekun haqq-hesab</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Çıxma tarixi *</Label><Input type="date" value={term.terminationDate} onChange={(e) => setTerm({ ...term, terminationDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Səbəb</Label><Input value={term.reason} onChange={(e) => setTerm({ ...term, reason: e.target.value })} placeholder="İstefa / ixtisar..." /></div>
            </div>
            {preview && (
              <div className="space-y-1.5 rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">İstifadə olunmamış məzuniyyət</span><span>{preview.unusedLeaveDays} gün × {fc(preview.dailyRate, 'AZN')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Məzuniyyət kompensasiyası</span><span className="text-emerald-600">{fc(preview.leaveEncashment, 'AZN')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Açıq avanslar</span><span className="text-rose-600">−{fc(preview.deductions, 'AZN')}</span></div>
                <div className="flex justify-between border-t pt-1.5 font-bold"><span>Yekun ödəniş</span><span className="text-primary">{fc(preview.netSettlement, 'AZN')}</span></div>
              </div>
            )}
            <div className="space-y-1.5"><Label>Qeyd</Label><Input value={term.note} onChange={(e) => setTerm({ ...term, note: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTermOpen(false)}>Ləğv</Button><Button className="bg-rose-600 hover:bg-rose-700" onClick={doTerminate} disabled={terminating}>{terminating && <Loader2 className="h-4 w-4 animate-spin" />} İşdən çıxar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maaş dəyişikliyi */}
      <Dialog open={salOpen} onOpenChange={setSalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Maaş dəyişikliyi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Qüvvəyə minmə tarixi *</Label><Input type="date" value={sal.effectiveDate} onChange={(e) => setSal({ ...sal, effectiveDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Ödəniş tipi</Label>
                <Select value={sal.newPayType} onValueChange={(v) => setSal({ ...sal, newPayType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">Aylıq</SelectItem><SelectItem value="daily">Günlük</SelectItem><SelectItem value="hourly">Saatlıq</SelectItem><SelectItem value="piece_rate">Ədədi</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Yeni maaş / dərəcə (₼) *</Label><Input type="number" step="any" value={sal.newSalary} onChange={(e) => setSal({ ...sal, newSalary: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Səbəb</Label><Input value={sal.reason} onChange={(e) => setSal({ ...sal, reason: e.target.value })} placeholder="Artım / yenidən baxış..." /></div>
            <p className="text-xs text-muted-foreground">Cari: {formatCurrency(emp.baseSalary ?? 0, 'AZN')} ({PAY_LABELS[emp.payType] ?? emp.payType}). Dəyişiklik tarixçəyə yazılır və payroll cari məbləği götürür.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSalOpen(false)}>Ləğv</Button><Button onClick={doRevise} disabled={savingSal}>{savingSal && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İntizam qeydi */}
      <Dialog open={discOpen} onOpenChange={setDiscOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>İntizam qeydi</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Tarix *</Label><Input type="date" value={disc.date} onChange={(e) => setDisc({ ...disc, date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Növ</Label>
                <Select value={disc.category} onValueChange={(v) => setDisc({ ...disc, category: v as DisciplinaryRecord['category'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DISCIPLINARY_CATEGORIES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Mövzu *</Label><Input value={disc.subject} onChange={(e) => setDisc({ ...disc, subject: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Təfərrüat</Label><Input value={disc.details} onChange={(e) => setDisc({ ...disc, details: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDiscOpen(false)}>Ləğv</Button><Button onClick={doDisc} disabled={savingDisc}>{savingDisc && <Loader2 className="h-4 w-4 animate-spin" />} Əlavə et</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
