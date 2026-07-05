'use client';

import { useMemo, useState } from 'react';
import { FileText, FileSpreadsheet, Building2, Scale, ArrowRightLeft } from 'lucide-react';
import type { IfrsResult, Statement, StmtLine } from '@/lib/utils/ifrs';
import { printDocument } from '@/lib/utils/print';
import { exportToExcel } from '@/lib/utils/export';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface CompanyInfo {
  name?: string; taxNumber?: string; address?: string; phone?: string; email?: string;
}

const TABS: { id: Statement['id']; label: string; icon: typeof FileText }[] = [
  { id: 'income', label: 'Mənfəət və Zərər', icon: FileText },
  { id: 'balance', label: 'Balans', icon: Scale },
  { id: 'cashflow', label: 'Pul Axını', icon: ArrowRightLeft },
];

/** Uçot formatı: mənfi → mötərizədə, sıfır → «—» */
function fmtAmount(n?: number): string {
  if (n === undefined) return '';
  if (Math.abs(n) < 0.005) return '—';
  const s = new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(Math.round(n)));
  return n < 0 ? `(${s})` : s;
}

export function FinancialStatements({ ifrs, company, periodLabel }: { ifrs: IfrsResult; company: CompanyInfo; periodLabel: string }) {
  const [active, setActive] = useState<Statement['id']>('income');
  const stmt = ifrs[active];

  const balanced = useMemo(() => {
    if (active !== 'balance') return true;
    const assets = stmt.lines.find((l) => l.label === 'CƏMİ AKTİVLƏR')?.amount ?? 0;
    const eqLiab = stmt.lines.find((l) => l.label.startsWith('CƏMİ KAPİTAL'))?.amount ?? 0;
    return Math.abs(assets - eqLiab) < 1;
  }, [active, stmt]);

  function exportExcel() {
    const rows = stmt.lines.map((l) => ({
      maddə: (l.level === 1 ? '    ' : '') + l.label,
      məbləğ: l.amount ?? '',
    }));
    exportToExcel(
      `ifrs-${stmt.id}`,
      [{ header: 'Maddə', value: 'maddə', width: 46 }, { header: 'Məbləğ (AZN)', value: 'məbləğ', width: 18 }],
      rows,
      stmt.title.slice(0, 28),
    );
  }

  function exportPdf() {
    const body = `
      <h1>${stmt.title}</h1>
      <p class="muted">${stmt.standard} · ${periodLabel} · valyuta: AZN</p>
      <table>
        <thead><tr><th>Maddə</th><th class="right">Məbləğ</th></tr></thead>
        <tbody>
          ${stmt.lines.map((l) => {
            const isTotal = l.kind === 'total';
            const isSub = l.kind === 'subtotal';
            const isHeader = l.kind === 'header';
            const style = [
              isHeader ? 'background:#eef0fb;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.5px' : '',
              isTotal ? 'font-weight:800;border-top:2px solid #5B5BF5;font-size:13.5px' : '',
              isSub ? 'font-weight:700;border-top:1px solid #c9cce0' : '',
              l.level === 1 ? 'padding-left:26px' : '',
            ].filter(Boolean).join(';');
            return `<tr><td style="${style}">${l.label}${l.note ? ` <span style="color:#9aa0bd;font-size:10px">${l.note}</span>` : ''}</td><td class="right" style="${style}">${l.amount === undefined ? '' : fmtAmount(l.amount)}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="muted" style="margin-top:16px;font-size:10.5px">Qeyd: Hesabat mövcud əməliyyat datasından IAS 1 / IAS 7 formatında hazırlanıb. Rəqəmlər AZN ilə, tam ədədə yuvarlaqlaşdırılıb.</p>
    `;
    printDocument(stmt.title, body, {
      company,
      docType: 'MALİYYƏ HESABATI',
      meta: [{ label: 'Standart', value: stmt.standard.split('—')[0].trim() }, { label: 'Dövr', value: periodLabel }],
    });
  }

  return (
    <div className="space-y-4">
      {/* KPI zolağı */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gəlir" value={fmtAmount(ifrs.kpis.revenue)} tone="neutral" />
        <Kpi label="Ümumi marja" value={`${ifrs.kpis.grossMargin.toFixed(1)}%`} tone="primary" />
        <Kpi label="Xalis mənfəət" value={fmtAmount(ifrs.kpis.netProfit)} tone={ifrs.kpis.netProfit >= 0 ? 'up' : 'down'} />
        <Kpi label="Cəmi aktivlər" value={fmtAmount(ifrs.kpis.totalAssets)} tone="neutral" />
      </div>

      {/* Statement seçici + export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-secondary/50 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active === t.id ? 'bg-background text-primary shadow-soft' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="h-4 w-4 text-primary" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 text-success" /> Excel</Button>
        </div>
      </div>

      {/* Hesabat sənədi */}
      <Card className="rounded-card">
        <CardContent className="p-0">
          <div className="flex items-start justify-between gap-3 border-b border-border p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
              <div>
                <p className="text-base font-bold leading-tight">{stmt.title}</p>
                <p className="text-xs text-muted-foreground">{stmt.standard}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{company.name || 'UP ERP'}</p>
              <p className="text-xs font-medium">{periodLabel} · AZN</p>
            </div>
          </div>

          <div className="px-5 py-3">
            {stmt.lines.map((l, i) => <StmtRow key={i} line={l} />)}
          </div>

          {active === 'balance' && (
            <div className={cn('border-t border-border px-5 py-2.5 text-xs font-medium', balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600')}>
              {balanced ? '✓ Balans bərabərdir (Aktivlər = Kapital + Öhdəliklər)' : '⚠ Balans yoxlanılır'}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Hesabatlar mövcud əməliyyat datasından IAS 1 (Maliyyə vəziyyəti, Mənfəət/Zərər) və IAS 7 (Pul axını) formatında avtomatik qurulur.
        Açılış qalıqları izlənmədiyi üçün pul axını dolayı metodla təxmini hesablanır.
      </p>
    </div>
  );
}

function StmtRow({ line }: { line: StmtLine }) {
  const { kind = 'line', level = 0, label, amount, note } = line;
  if (kind === 'header') {
    return (
      <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground first:mt-0">
        <span>{label}</span>
      </div>
    );
  }
  const isTotal = kind === 'total';
  const isSub = kind === 'subtotal';
  const isSectionLabel = amount === undefined;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-1.5 text-sm',
        level === 1 && 'pl-4',
        isSub && 'mt-0.5 border-t border-border/70 font-semibold',
        isTotal && 'mt-0.5 border-t-2 border-primary/60 py-2 text-[15px] font-bold text-primary',
        !isSub && !isTotal && !isSectionLabel && 'text-muted-foreground',
        isSectionLabel && 'font-semibold text-foreground',
      )}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {note && <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{note}</span>}
      </span>
      <span className={cn('tabular-nums', amount !== undefined && amount < 0 && !isTotal && !isSub && 'text-rose-500')}>{fmtAmount(amount)}</span>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'primary' | 'up' | 'down' }) {
  const toneCls = {
    neutral: 'text-foreground',
    primary: 'text-primary',
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-rose-600 dark:text-rose-400',
  }[tone];
  return (
    <Card className="rounded-card">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-bold tracking-tight tabular-nums', toneCls)}>{value}</p>
      </CardContent>
    </Card>
  );
}
