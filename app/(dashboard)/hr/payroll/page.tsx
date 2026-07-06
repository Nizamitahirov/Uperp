'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Banknote, Plus, Loader2, Settings2, Wallet, ArrowUpRight, HandCoins } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createPayrollRun, createAdvance, fetchPayrollConfig, savePayrollConfig } from '@/lib/firebase/payroll';
import { DEFAULT_PAYROLL_CONFIG, type PayrollConfig } from '@/lib/payroll';
import { useAuth } from '@/components/providers/auth-provider';
import type { Employee, PayrollRun } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' }> = {
  draft: { label: 'Qaralama', variant: 'secondary' }, approved: { label: 'Təsdiqlənib', variant: 'default' }, paid: { label: 'Ödənilib', variant: 'success' },
};
const monthKey = () => new Date().toISOString().slice(0, 7);

// Bracket ↔ flat parametr çevirmələri (config dialoqu üçün)
function toFlat(c: PayrollConfig) {
  return {
    itExempt: c.incomeTax[0]?.upTo ?? 8000, itRate: c.incomeTax[c.incomeTax.length - 1]?.rate ?? 14,
    socThr: c.socialEmployee[0]?.upTo ?? 200, socEmpBelow: c.socialEmployee[0]?.rate ?? 3, socEmpAbove: c.socialEmployee[1]?.rate ?? 10,
    socErBelow: c.socialEmployer[0]?.rate ?? 22, socErAbove: c.socialEmployer[1]?.rate ?? 15,
    unEmp: c.unemploymentEmployee[0]?.rate ?? 0.5, unEr: c.unemploymentEmployer[0]?.rate ?? 0.5,
    medThr: c.medicalEmployee[0]?.upTo ?? 8000, medEmpBelow: c.medicalEmployee[0]?.rate ?? 2, medEmpAbove: c.medicalEmployee[1]?.rate ?? 0.5,
    otMult: c.overtimeMultiplier, stdHours: c.monthlyStandardHours,
  };
}
function fromFlat(f: ReturnType<typeof toFlat>): PayrollConfig {
  return {
    incomeTax: [{ upTo: +f.itExempt, rate: 0 }, { upTo: null, rate: +f.itRate }],
    socialEmployee: [{ upTo: +f.socThr, rate: +f.socEmpBelow }, { upTo: null, rate: +f.socEmpAbove }],
    socialEmployer: [{ upTo: +f.socThr, rate: +f.socErBelow }, { upTo: null, rate: +f.socErAbove }],
    unemploymentEmployee: [{ upTo: null, rate: +f.unEmp }],
    unemploymentEmployer: [{ upTo: null, rate: +f.unEr }],
    medicalEmployee: [{ upTo: +f.medThr, rate: +f.medEmpBelow }, { upTo: null, rate: +f.medEmpAbove }],
    medicalEmployer: [{ upTo: +f.medThr, rate: +f.medEmpBelow }, { upTo: null, rate: +f.medEmpAbove }],
    overtimeMultiplier: +f.otMult, monthlyStandardHours: +f.stdHours, workingDaysPerMonth: DEFAULT_PAYROLL_CONFIG.workingDaysPerMonth,
  };
}

export default function PayrollPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const [runOpen, setRunOpen] = useState(false);
  const [period, setPeriod] = useState(monthKey());
  const [creating, setCreating] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [flat, setFlat] = useState(toFlat(DEFAULT_PAYROLL_CONFIG));
  const [advOpen, setAdvOpen] = useState(false);
  const [adv, setAdv] = useState({ employeeId: '', amount: 0, note: '' });
  const [saving, setSaving] = useState(false);

  const { data: runs = [], isLoading } = useQuery({ queryKey: ['payroll_runs'], queryFn: () => listDocs<PayrollRun>('payroll_runs', [orderBy('createdAt', 'desc')]) });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees') });

  const kpis = useMemo(() => {
    const paid = runs.filter((r) => r.status === 'paid');
    const lastPaid = paid[0];
    return { total: runs.length, lastNet: lastPaid?.totalNet ?? 0, lastCost: lastPaid?.totalEmployerCost ?? 0 };
  }, [runs]);

  async function newRun() {
    setCreating(true);
    try {
      const id = await createPayrollRun(period, actor);
      toast.success(`Run yaradıldı (${period})`); setRunOpen(false);
      qc.invalidateQueries({ queryKey: ['payroll_runs'] });
      router.push(`/hr/payroll/${id}`);
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setCreating(false); }
  }

  async function openConfig() { const c = await fetchPayrollConfig(); setFlat(toFlat(c)); setCfgOpen(true); }
  async function saveConfig() {
    setSaving(true);
    try { await savePayrollConfig(fromFlat(flat), actor); toast.success('Parametrlər yadda saxlanıldı'); setCfgOpen(false); }
    catch { toast.error('Alınmadı'); } finally { setSaving(false); }
  }

  async function saveAdvance() {
    if (!adv.employeeId || adv.amount <= 0) { toast.error('İşçi və məbləğ seçin'); return; }
    const emp = employees.find((e) => e.id === adv.employeeId);
    setSaving(true);
    try { await createAdvance({ employeeId: adv.employeeId, employeeName: emp?.fullName, amount: adv.amount, note: adv.note || undefined }, actor); toast.success('Avans qeydə alındı — növbəti run-da tutulacaq'); setAdvOpen(false); setAdv({ employeeId: '', amount: 0, note: '' }); }
    catch { toast.error('Alınmadı'); } finally { setSaving(false); }
  }

  const setF = (k: keyof typeof flat, v: string) => setFlat((p) => ({ ...p, [k]: +v }));

  return (
    <div>
      <PageHeader title="Əmək haqqı" subtitle="Aylıq əmək haqqı hesablanması və payslip-lər" action={
        canManage ? <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAdvOpen(true)}><HandCoins className="h-4 w-4" /> Avans</Button>
          <Button variant="outline" onClick={openConfig}><Settings2 className="h-4 w-4" /> Parametrlər</Button>
          <Button onClick={() => setRunOpen(true)}><Plus /> Yeni run</Button>
        </div> : undefined
      } />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi icon={Banknote} tint="bg-primary/10 text-primary" value={String(kpis.total)} label="Run sayı" />
        <Kpi icon={Wallet} tint="bg-emerald-500/10 text-emerald-600" value={formatCurrency(kpis.lastNet, 'AZN')} label="Son net ödəniş" />
        <Kpi icon={Banknote} tint="bg-sky-500/10 text-sky-600" value={formatCurrency(kpis.lastCost, 'AZN')} label="Son işəgötürən xərci" />
      </div>

      <Card className="rounded-card">
        {isLoading ? <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
          : runs.length === 0 ? <EmptyState title="Run yoxdur" description="İlk əmək haqqı run-ını yaradın" action={canManage ? <Button onClick={() => setRunOpen(true)}><Plus /> Yeni run</Button> : undefined} />
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>№</TableHead><TableHead>Dövr</TableHead><TableHead className="text-right">İşçi</TableHead><TableHead className="text-right">Brüt</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">İşəgötürən xərci</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {runs.map((r) => {
                    const st = STATUS_META[r.status] ?? STATUS_META.draft;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.number}</TableCell>
                        <TableCell className="font-medium">{r.period}</TableCell>
                        <TableCell className="text-right">{r.employeeCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.totalGross, 'AZN')}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(r.totalNet, 'AZN')}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.totalEmployerCost, 'AZN')}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right"><Link href={`/hr/payroll/${r.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary hover:bg-primary/10"><ArrowUpRight className="h-4 w-4" /></Link></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </Card>

      {/* Yeni run */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Yeni əmək haqqı run-ı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Dövr (ay)</Label><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Aktiv işçilər üçün davamiyyət, piece-rate, əlavələr və avanslar əsasında brüt→net hesablanacaq.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRunOpen(false)}>Ləğv</Button><Button onClick={newRun} disabled={creating}>{creating && <Loader2 className="h-4 w-4 animate-spin" />} Hesabla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Avans */}
      <Dialog open={advOpen} onOpenChange={setAdvOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Maaş avansı</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>İşçi</Label>
              <Select value={adv.employeeId} onValueChange={(v) => setAdv({ ...adv, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{employees.filter((e) => e.status !== 'terminated').map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Məbləğ (₼)</Label><Input type="number" step="any" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: +e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Qeyd</Label><Input value={adv.note} onChange={(e) => setAdv({ ...adv, note: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdvOpen(false)}>Ləğv</Button><Button onClick={saveAdvance} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Qeyd et</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Parametrlər */}
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Əmək haqqı parametrləri (AZ)</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm">
            <Group title="Gəlir vergisi">
              <Num label="Güzəşt həddi (₼)" v={flat.itExempt} onChange={(v) => setF('itExempt', v)} />
              <Num label="Həddən yuxarı %" v={flat.itRate} onChange={(v) => setF('itRate', v)} />
            </Group>
            <Group title="Sosial sığorta (DSMF)">
              <Num label="Hədd (₼)" v={flat.socThr} onChange={(v) => setF('socThr', v)} />
              <Num label="İşçi ≤hədd %" v={flat.socEmpBelow} onChange={(v) => setF('socEmpBelow', v)} />
              <Num label="İşçi >hədd %" v={flat.socEmpAbove} onChange={(v) => setF('socEmpAbove', v)} />
              <Num label="İşəgötürən ≤hədd %" v={flat.socErBelow} onChange={(v) => setF('socErBelow', v)} />
              <Num label="İşəgötürən >hədd %" v={flat.socErAbove} onChange={(v) => setF('socErAbove', v)} />
            </Group>
            <Group title="İşsizlikdən sığorta">
              <Num label="İşçi %" v={flat.unEmp} onChange={(v) => setF('unEmp', v)} />
              <Num label="İşəgötürən %" v={flat.unEr} onChange={(v) => setF('unEr', v)} />
            </Group>
            <Group title="İcbari tibbi sığorta">
              <Num label="Hədd (₼)" v={flat.medThr} onChange={(v) => setF('medThr', v)} />
              <Num label="≤hədd %" v={flat.medEmpBelow} onChange={(v) => setF('medEmpBelow', v)} />
              <Num label=">hədd %" v={flat.medEmpAbove} onChange={(v) => setF('medEmpAbove', v)} />
            </Group>
            <Group title="Digər">
              <Num label="Əlavə iş əmsalı" v={flat.otMult} onChange={(v) => setF('otMult', v)} />
              <Num label="Aylıq norma saat" v={flat.stdHours} onChange={(v) => setF('stdHours', v)} />
            </Group>
            <p className="text-xs text-muted-foreground">Defaultlar 2024–25 özəl (qeyri-neft) sektor üçün təxminidir. Cari qanunvericiliyə uyğun dəqiqləşdirin.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCfgOpen(false)}>Ləğv</Button><Button onClick={saveConfig} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, tint, value, label }: { icon: typeof Banknote; tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><div className="grid grid-cols-2 gap-2">{children}</div></div>;
}
function Num({ label, v, onChange }: { label: string; v: number; onChange: (v: string) => void }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label><Input type="number" step="any" value={v} onChange={(e) => onChange(e.target.value)} className="h-8" /></div>;
}
