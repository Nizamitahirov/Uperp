'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { ArrowLeft, Check, Banknote, FileText, Loader2 } from 'lucide-react';
import { getDocById, listDocs } from '@/lib/firebase/firestore';
import { setRunStatus } from '@/lib/firebase/payroll';
import { printDocument } from '@/lib/utils/print';
import { useAuth } from '@/components/providers/auth-provider';
import type { PayrollRun, Payslip } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' }> = {
  draft: { label: 'Qaralama', variant: 'secondary' }, approved: { label: 'Təsdiqlənib', variant: 'default' }, paid: { label: 'Ödənilib', variant: 'success' },
};
const c = (n: number) => formatCurrency(n, 'AZN');

export default function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };
  const [working, setWorking] = useState(false);

  const { data: run, isLoading } = useQuery({ queryKey: ['payroll_runs', id], queryFn: () => getDocById<PayrollRun>('payroll_runs', id) });
  const { data: payslips = [] } = useQuery({ queryKey: ['payslips', id], queryFn: () => listDocs<Payslip>('payslips', [where('runId', '==', id)]), enabled: !!id });

  async function advance(status: 'approved' | 'paid') {
    if (!run) return;
    setWorking(true);
    try { await setRunStatus(run, status, actor); toast.success(status === 'approved' ? 'Təsdiqləndi' : 'Ödənildi — maliyyəyə post edildi'); qc.invalidateQueries({ queryKey: ['payroll_runs', id] }); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setWorking(false); }
  }

  function printPayslip(p: Payslip) {
    const rows = (label: string, val: number, neg = false) => `<tr><td>${label}</td><td class="right">${neg ? '−' : ''}${c(Math.abs(val))}</td></tr>`;
    const body = `
      <h1>Əmək haqqı vərəqəsi (Payslip)</h1>
      <p class="muted">${p.employeeName ?? ''} · Dövr: ${p.period}</p>
      <table><thead><tr><th>Hesablama</th><th class="right">Məbləğ</th></tr></thead><tbody>
        ${rows('Baza', p.base)}
        ${p.overtime ? rows('Əlavə iş', p.overtime) : ''}
        ${p.pieceRatePay ? rows('Ədədi (piece-rate)', p.pieceRatePay) : ''}
        ${p.allowances ? rows('Əlavələr', p.allowances) : ''}
        <tr style="font-weight:700;border-top:1px solid #c9cce0"><td>Brüt (gross)</td><td class="right">${c(p.gross)}</td></tr>
        ${rows('Gəlir vergisi', p.incomeTax, true)}
        ${rows('Sosial sığorta', p.socialEmployee, true)}
        ${rows('İşsizlik sığortası', p.unemploymentEmployee, true)}
        ${rows('Tibbi sığorta', p.medicalEmployee, true)}
        ${p.otherDeductions ? rows('Digər tutulmalar', p.otherDeductions, true) : ''}
        ${p.advances ? rows('Avans', p.advances, true) : ''}
        <tr style="font-weight:800;border-top:2px solid #5B5BF5;font-size:14px"><td>NET (əlinizə)</td><td class="right">${c(p.net)}</td></tr>
      </tbody></table>
      <p class="muted" style="margin-top:14px">İş günü: ${p.presentDays} · Saat: ${p.totalHours} · Əlavə iş: ${p.overtimeHours}s · Bank: ${p.bankName ?? '—'} · IBAN: ${p.iban ?? '—'}</p>
    `;
    printDocument('Payslip', body, { docType: 'PAYSLIP', docNumber: p.period, meta: [{ label: 'İşçi', value: p.employeeName ?? '' }] });
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!run) return <div><Button variant="ghost" onClick={() => router.push('/hr/payroll')}><ArrowLeft className="h-4 w-4" /> Geri</Button><p className="mt-4 text-muted-foreground">Run tapılmadı.</p></div>;

  const st = STATUS_META[run.status] ?? STATUS_META.draft;

  return (
    <div>
      <Button variant="ghost" className="mb-2" onClick={() => router.push('/hr/payroll')}><ArrowLeft className="h-4 w-4" /> Əmək haqqı</Button>
      <PageHeader title={`Run ${run.number} · ${run.period}`} subtitle={`${run.employeeCount} işçi`} action={
        canManage ? <div className="flex gap-2">
          {run.status === 'draft' && <Button onClick={() => advance('approved')} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Təsdiqlə</Button>}
          {run.status === 'approved' && <Button onClick={() => advance('paid')} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />} Ödənildi</Button>}
        </div> : undefined
      } />

      <div className="mb-4 flex items-center gap-3"><Badge variant={st.variant}>{st.label}</Badge>{run.postedExpenseId && <span className="text-xs text-muted-foreground">Maliyyəyə post edilib</span>}</div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Sum label="Cəmi brüt" value={c(run.totalGross)} />
        <Sum label="Cəmi net" value={c(run.totalNet)} />
        <Sum label="Cəmi vergi" value={c(run.totalTax)} />
        <Sum label="İşəgötürən xərci" value={c(run.totalEmployerCost)} />
      </div>

      <Card className="rounded-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="font-semibold">Payslip-lər</p>
          <ExportButton filename={`payroll-${run.period}`} rows={payslips} columns={[
            { header: 'İşçi', value: 'employeeName' }, { header: 'Brüt', value: 'gross' }, { header: 'Gəlir vergisi', value: 'incomeTax' },
            { header: 'Sosial', value: 'socialEmployee' }, { header: 'İşsizlik', value: 'unemploymentEmployee' }, { header: 'Tibbi', value: 'medicalEmployee' },
            { header: 'Avans', value: 'advances' }, { header: 'Net', value: 'net' }, { header: 'İşəgötürən xərci', value: 'employerCost' },
          ]} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead className="text-right">Brüt</TableHead><TableHead className="text-right">Vergi</TableHead><TableHead className="text-right">Sosial</TableHead><TableHead className="text-right">Avans</TableHead><TableHead className="text-right">Net</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {payslips.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.employeeName}<span className="ml-1 text-xs text-muted-foreground">{p.presentDays}g</span></TableCell>
                  <TableCell className="text-right tabular-nums">{c(p.gross)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600">{c(p.incomeTax)}</TableCell>
                  <TableCell className="text-right tabular-nums text-rose-600">{c(p.socialEmployee)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.advances ? c(p.advances) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{c(p.net)}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => printPayslip(p)} title="Payslip PDF"><FileText className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold tabular-nums">{value}</p></CardContent></Card>;
}
