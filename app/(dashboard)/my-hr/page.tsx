'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { where, orderBy } from 'firebase/firestore';
import { Plane, Plus, Loader2, CalendarClock, Briefcase, Wallet, HeartHandshake, FileText, Inbox } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createLeaveRequest, LEAVE_TYPES } from '@/lib/firebase/leave';
import { createHrRequest, HR_REQUEST_TYPES, HR_REQUEST_TYPE_MAP, HR_REQUEST_STATUS_META } from '@/lib/firebase/hr-requests';
import { printDocument } from '@/lib/utils/print';
import { useAuth } from '@/components/providers/auth-provider';
import type { Attendance, Employee, HrRequest, HrRequestType, LeaveRequest, Payslip } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const STATUS_META: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  pending: { label: 'Gözləyir', variant: 'warning' }, approved: { label: 'Təsdiqlənib', variant: 'success' },
  rejected: { label: 'Rədd', variant: 'destructive' }, cancelled: { label: 'Ləğv', variant: 'secondary' },
};
const ATT_LABEL: Record<string, string> = { present: 'Gəldi', half_day: 'Yarım gün', remote: 'Uzaqdan', leave: 'Məzuniyyət', absent: 'Gəlmədi', holiday: 'Bayram' };

export default function MyHrPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const uid = profile?.uid;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'annual', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({ type: 'certificate' as HrRequestType, subject: '', details: '' });
  const [reqSaving, setReqSaving] = useState(false);

  const { data: employees = [], isLoading } = useQuery({ queryKey: ['my-employee', uid], queryFn: () => listDocs<Employee>('employees', [where('userId', '==', uid)]), enabled: !!uid });
  const emp = employees[0];

  const { data: leaves = [] } = useQuery({ queryKey: ['my-leaves', emp?.id], queryFn: () => listDocs<LeaveRequest>('leave_requests', [where('employeeId', '==', emp!.id), orderBy('createdAt', 'desc')]), enabled: !!emp?.id });
  const { data: attendance = [] } = useQuery({ queryKey: ['my-attendance', emp?.id], queryFn: () => listDocs<Attendance>('attendance', [where('employeeId', '==', emp!.id), orderBy('dateKey', 'desc')]), enabled: !!emp?.id });
  const { data: payslips = [] } = useQuery({ queryKey: ['my-payslips', uid], queryFn: () => listDocs<Payslip>('payslips', [where('userId', '==', uid), orderBy('period', 'desc')]), enabled: !!uid });
  const { data: hrRequests = [] } = useQuery({ queryKey: ['my-hr-requests', emp?.id], queryFn: () => listDocs<HrRequest>('hr_requests', [where('employeeId', '==', emp!.id), orderBy('createdAt', 'desc')]), enabled: !!emp?.id });

  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();

  function printPayslip(p: Payslip) {
    const c = (n: number) => formatCurrency(n, 'AZN');
    const row = (l: string, v: number, neg = false) => `<tr><td>${l}</td><td class="right">${neg ? '−' : ''}${c(Math.abs(v))}</td></tr>`;
    const body = `<h1>Əmək haqqı vərəqəsi</h1><p class="muted">${p.employeeName ?? ''} · ${p.period}</p><table><thead><tr><th>Hesablama</th><th class="right">Məbləğ</th></tr></thead><tbody>${row('Baza', p.base)}${p.overtime ? row('Əlavə iş', p.overtime) : ''}${p.pieceRatePay ? row('Ədədi', p.pieceRatePay) : ''}${p.seniorityAllowance ? row('Staj əlavəsi', p.seniorityAllowance) : ''}${p.bonus ? row('Bonus', p.bonus) : ''}${p.allowances ? row('Əlavələr', p.allowances) : ''}<tr style="font-weight:700"><td>Brüt</td><td class="right">${c(p.gross)}</td></tr>${row('Gəlir vergisi', p.incomeTax, true)}${row('Sosial', p.socialEmployee, true)}${row('İşsizlik', p.unemploymentEmployee, true)}${row('Tibbi', p.medicalEmployee, true)}${p.advances ? row('Avans', p.advances, true) : ''}${p.loanDeduction ? row('Kredit tutulması', p.loanDeduction, true) : ''}<tr style="font-weight:800;border-top:2px solid #5B5BF5"><td>NET</td><td class="right">${c(p.net)}</td></tr></tbody></table>`;
    printDocument('Payslip', body, { docType: 'PAYSLIP', docNumber: p.period });
  }
  const recentAttendance = useMemo(() => attendance.slice(0, 10), [attendance]);

  async function submit() {
    if (!emp || !form.startDate || !form.endDate) { toast.error('Tarixləri seçin'); return; }
    setSaving(true);
    try {
      await createLeaveRequest({ employeeId: emp.id, employeeName: emp.fullName, userId: uid, type: form.type, startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined }, { uid: uid ?? '', username: profile?.username ?? '' });
      toast.success('Sorğu göndərildi'); setOpen(false); setForm({ type: 'annual', startDate: '', endDate: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['my-leaves', emp.id] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  async function submitRequest() {
    if (!emp || !reqForm.subject.trim()) { toast.error('Mövzu tələb olunur'); return; }
    setReqSaving(true);
    try {
      await createHrRequest({ employeeId: emp.id, employeeName: emp.fullName, userId: uid, type: reqForm.type, subject: reqForm.subject, details: reqForm.details || undefined }, { uid: uid ?? '', username: profile?.username ?? '' });
      toast.success('Sorğu göndərildi'); setReqOpen(false); setReqForm({ type: 'certificate', subject: '', details: '' });
      qc.invalidateQueries({ queryKey: ['my-hr-requests', emp.id] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setReqSaving(false); }
  }

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /></div>;

  if (!emp) {
    return (
      <div>
        <PageHeader title="Mənim HR" subtitle="Employee Self-Service" />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><HeartHandshake className="h-8 w-8 text-muted-foreground" /><p className="font-medium">Hesabınız işçi kartı ilə bağlı deyil</p><p className="max-w-md text-sm text-muted-foreground">HR menecerindən hesabınızı işçi qeydinə bağlamağı xahiş edin.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Mənim HR" subtitle="Profil, məzuniyyət və davamiyyət" />

      {/* Profil başlığı */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-3xl border border-border bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-xl font-bold text-primary">
          {emp.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emp.avatarUrl} alt={emp.fullName} className="h-full w-full object-cover" />
          ) : (emp.fullName || 'U').slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">{emp.fullName}</h1>
          <p className="text-sm text-muted-foreground">{emp.positionTitle ?? '—'} · {emp.departmentName ?? '—'} · {emp.employeeNo}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Plane} tint="bg-primary/10 text-primary" value={`${emp.leaveBalance ?? emp.annualLeaveEntitlement ?? 0}`} label="Məzuniyyət balansı (gün)" />
        <Kpi icon={Briefcase} tint="bg-sky-500/10 text-sky-600" value={formatDate(ms(emp.hireDate))} label="İşə qəbul" />
        <Kpi icon={Wallet} tint="bg-emerald-500/10 text-emerald-600" value={formatCurrency(emp.baseSalary ?? 0, 'AZN')} label="Baza maaş" />
        <Kpi icon={CalendarClock} tint="bg-amber-500/10 text-amber-600" value={String(leaves.filter((l) => l.status === 'pending').length)} label="Gözləyən sorğu" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Məzuniyyət sorğuları */}
        <Card className="rounded-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Məzuniyyət sorğularım</CardTitle>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni sorğu</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {leaves.length === 0 ? <EmptyState title="Sorğu yoxdur" description="Yeni sorğu göndərin" /> : leaves.slice(0, 8).map((l) => {
              const st = STATUS_META[l.status] ?? STATUS_META.pending;
              return (
                <div key={l.id} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{l.typeLabel ?? l.type}</p><p className="text-xs text-muted-foreground">{formatDate(ms(l.startDate))} – {formatDate(ms(l.endDate))} · {l.days} gün</p></div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Davamiyyət */}
        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">Son davamiyyət</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {recentAttendance.length === 0 ? <EmptyState title="Qeyd yoxdur" description="Davamiyyət qeydi yoxdur" /> : recentAttendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-border/50 py-1.5 text-sm last:border-0">
                <span>{a.dateKey}</span>
                <span className={cn('text-xs', a.status === 'absent' ? 'text-rose-600' : a.status === 'leave' ? 'text-amber-600' : 'text-muted-foreground')}>{ATT_LABEL[a.status] ?? a.status} · {a.hoursWorked}s</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Payslip-lərim */}
      <Card className="rounded-card mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Əmək haqqı vərəqələrim</CardTitle></CardHeader>
        <CardContent className="p-0">
          {payslips.length === 0 ? <EmptyState title="Payslip yoxdur" description="Əmək haqqı hesablandıqda burada görünəcək" /> : (
            <div className="divide-y divide-border/60">
              {payslips.slice(0, 12).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-sm">{p.period}</span>
                  <span className="ml-auto text-sm text-muted-foreground">Brüt {formatCurrency(p.gross, 'AZN')}</span>
                  <span className="text-sm font-bold text-primary">Net {formatCurrency(p.net, 'AZN')}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printPayslip(p)} title="PDF"><FileText className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* HR sorğularım */}
      <Card className="rounded-card mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4 text-primary" /> HR sorğularım (arayış, düzəliş)</CardTitle>
          <Button size="sm" onClick={() => setReqOpen(true)}><Plus className="h-4 w-4" /> Yeni sorğu</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {hrRequests.length === 0 ? <EmptyState title="Sorğu yoxdur" description="Arayış və ya məlumat düzəlişi üçün sorğu göndərin" /> : hrRequests.slice(0, 8).map((r) => {
            const st = HR_REQUEST_STATUS_META[r.status];
            return (
              <div key={r.id} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.subject}</p><p className="text-xs text-muted-foreground">{HR_REQUEST_TYPE_MAP.get(r.type)}{r.response ? ` · Cavab: ${r.response}` : ''}</p></div>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Məzuniyyət sorğusu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Növ *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Başlama *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bitmə *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Səbəb</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Ləğv</Button><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Göndər</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>HR sorğusu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Növ *</Label>
              <Select value={reqForm.type} onValueChange={(v) => setReqForm({ ...reqForm, type: v as HrRequestType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HR_REQUEST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Mövzu *</Label><Input value={reqForm.subject} onChange={(e) => setReqForm({ ...reqForm, subject: e.target.value })} placeholder="məs. Bank üçün gəlir arayışı" /></div>
            <div className="space-y-1.5"><Label>Təfərrüat</Label><Input value={reqForm.details} onChange={(e) => setReqForm({ ...reqForm, details: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReqOpen(false)}>Ləğv</Button><Button onClick={submitRequest} disabled={reqSaving}>{reqSaving && <Loader2 className="h-4 w-4 animate-spin" />} Göndər</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, tint, value, label }: { icon: typeof Plane; tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
