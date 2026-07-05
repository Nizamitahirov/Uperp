'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, PackageSearch, Sparkles } from 'lucide-react';
import { listDocs, getDocById } from '@/lib/firebase/firestore';
import { checkOverstock } from '@/lib/firebase/notifications';
import { aiPrompt } from '@/lib/ai/client';
import { useAuth } from '@/components/providers/auth-provider';
import type { SalesOrder, Expense, FinishedGoodStock, RawMaterial, Receivable, Payable, Customer, CashRegister } from '@/types';
import { EXPENSE_CATEGORIES, CUSTOMER_SEGMENTS } from '@/lib/constants';
import { buildAging } from '@/lib/utils/aging';
import { getStockStatus } from '@/lib/utils/stock';
import { buildIfrs } from '@/lib/utils/ifrs';
import { ChartCard } from '@/components/charts/chart-card';
import { CHART_COLORS } from '@/components/charts/palette';
import { ExportButton } from '@/components/shared/export-button';
import { FinancialStatements } from './financial-statements';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

const COLORS = CHART_COLORS;

export default function ReportsPage() {
  const { profile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [insight, setInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-data'],
    queryFn: async () => {
      const [sales, expenses, finished, materials, receivables, payables, customers, registers] = await Promise.all([
        listDocs<SalesOrder>('sales_orders', []),
        listDocs<Expense>('expenses', []),
        listDocs<FinishedGoodStock>('finished_goods', []),
        listDocs<RawMaterial>('raw_materials', []),
        listDocs<Receivable>('receivables', []),
        listDocs<Payable>('payables', []),
        listDocs<Customer>('customers', []),
        listDocs<CashRegister>('cash_registers', []),
      ]);
      return { sales, expenses, finished, materials, receivables, payables, customers, registers };
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings-global'],
    queryFn: () => getDocById<{ companyName?: string; taxNumber?: string; address?: string; phone?: string; email?: string }>('settings', 'global'),
  });

  const pnl = useMemo(() => {
    if (!data) return null;
    const delivered = data.sales.filter((s) => s.status === 'delivered');
    const revenue = delivered.reduce((a, s) => a + (s.subtotal - s.discountAmount), 0);
    const vatCollected = delivered.reduce((a, s) => a + s.vatAmount, 0);
    const fgCost = new Map(data.finished.map((f) => [f.variantSku, f.unitCost ?? 0]));
    const cogs = delivered.reduce((a, s) => a + (s.items ?? []).reduce((x, it) => x + it.quantity * (fgCost.get(it.variantSku) ?? 0), 0), 0);
    const grossProfit = revenue - cogs;
    const totalExpenses = data.expenses.reduce((a, e) => a + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    return { revenue, cogs, grossProfit, totalExpenses, netProfit, grossMargin, netMargin, vatCollected };
  }, [data]);

  const expenseByCategory = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const e of data.expenses) map.set(EXPENSE_CATEGORIES[e.category], (map.get(EXPENSE_CATEGORIES[e.category]) ?? 0) + e.amount);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const ifrs = useMemo(() => {
    if (!data || !pnl) return null;
    const expensesByCategory: Record<string, number> = {};
    for (const e of data.expenses) expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount;
    const rawInventory = data.materials.reduce((a, m) => a + (m.stockValue ?? 0), 0);
    const fgInventory = data.finished.reduce((a, f) => a + (f.currentStock ?? 0) * (f.unitCost ?? 0), 0);
    const cash = data.registers.reduce((a, r) => a + (r.currentBalance ?? 0), 0);
    const receivables = data.receivables.reduce((a, r) => a + (r.balance ?? 0), 0);
    const payables = data.payables.reduce((a, p) => a + (p.balance ?? 0), 0);
    return buildIfrs({ revenue: pnl.revenue, cogs: pnl.cogs, expensesByCategory, receivables, payables, rawInventory, fgInventory, cash });
  }, [data, pnl]);

  const company = useMemo(() => ({
    name: settings?.companyName, taxNumber: settings?.taxNumber, address: settings?.address, phone: settings?.phone, email: settings?.email,
  }), [settings]);
  const periodLabel = useMemo(() => `${new Date().getFullYear()}-ci il (cari mövqe)`, []);

  const salesByProduct = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const s of data.sales) for (const it of s.items ?? []) {
      const cur = map.get(it.productName) ?? { qty: 0, revenue: 0 };
      map.set(it.productName, { qty: cur.qty + it.quantity, revenue: cur.revenue + it.lineTotal });
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const salesByChannel = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const s of data.sales) map.set(s.channel, (map.get(s.channel) ?? 0) + s.totalAmount);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const inventory = useMemo(() => {
    if (!data) return null;
    const rawValue = data.materials.reduce((a, m) => a + (m.stockValue ?? 0), 0);
    const fgValue = data.finished.reduce((a, f) => a + (f.currentStock ?? 0) * (f.unitCost ?? 0), 0);
    const critical = data.materials.filter((m) => ['critical', 'out'].includes(getStockStatus(m)));
    const overstock = data.finished.filter((f) => f.maxStock > 0 && f.currentStock > f.maxStock);
    return { rawValue, fgValue, critical, overstock };
  }, [data]);

  const arAging = useMemo(() => buildAging((data?.receivables ?? []).map((r) => ({ id: r.id, name: r.customerName ?? r.invoiceNumber ?? r.id, reference: r.invoiceNumber, balance: r.balance, dueDate: r.dueDate }))), [data]);
  const apAging = useMemo(() => buildAging((data?.payables ?? []).map((p) => ({ id: p.id, name: p.supplierName ?? p.invoiceNumber ?? p.id, reference: p.invoiceNumber, balance: p.balance, dueDate: p.dueDate }))), [data]);

  const customers = useMemo(() => {
    if (!data) return null;
    const rev = new Map<string, number>();
    const orders = new Map<string, number>();
    for (const s of data.sales.filter((x) => x.status === 'delivered')) {
      const key = s.customerName ?? s.customerId;
      rev.set(key, (rev.get(key) ?? 0) + s.totalAmount);
      orders.set(key, (orders.get(key) ?? 0) + 1);
    }
    const top = Array.from(rev.entries())
      .map(([name, revenue]) => ({ name, revenue, orders: orders.get(name) ?? 0, aov: revenue / (orders.get(name) || 1) }))
      .sort((a, b) => b.revenue - a.revenue);
    const segMap = new Map<string, number>();
    for (const c of data.customers) {
      const label = CUSTOMER_SEGMENTS[c.segment]?.label ?? c.segment;
      segMap.set(label, (segMap.get(label) ?? 0) + 1);
    }
    const segments = Array.from(segMap.entries()).map(([name, value]) => ({ name, value }));
    const arByCustomer = new Map<string, number>();
    for (const r of data.receivables) arByCustomer.set(r.customerName ?? r.customerId, (arByCustomer.get(r.customerName ?? r.customerId) ?? 0) + (r.balance ?? 0));
    return { top: top.slice(0, 12), segments, total: data.customers.length, withBalance: Array.from(arByCustomer.values()).filter((v) => v > 0.005).length };
  }, [data]);

  async function generateInsight() {
    if (!pnl) return;
    setAiLoading(true);
    try {
      const text = await aiPrompt(
        `Cins şalvar istehsalı ERP-i üçün maliyyə/satış hesabatının qısa analitik xülasəsini yaz (3-4 cümlə, Azərbaycan dili, anomaliya və tendensiya qeyd et, tövsiyə ver). Gəlir: ${pnl.revenue.toFixed(0)} AZN, COGS: ${pnl.cogs.toFixed(0)} AZN, ümumi marja: ${pnl.grossMargin.toFixed(1)}%, xalis mənfəət: ${pnl.netProfit.toFixed(0)} AZN, xərclər: ${pnl.totalExpenses.toFixed(0)} AZN, vaxtı keçmiş debitor: ${arAging.overdueTotal.toFixed(0)} AZN.`,
      );
      setInsight(text);
    } catch (e) {
      toast.error('AI analiz alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setAiLoading(false);
    }
  }

  async function runOverstock() {
    if (!data) return;
    setChecking(true);
    try {
      const n = await checkOverstock(data.finished.map((f) => ({ id: f.id, variantSku: f.variantSku, currentStock: f.currentStock, maxStock: f.maxStock })));
      toast.success(`Overstock yoxlaması: ${n} bildiriş yaradıldı`);
    } catch { toast.error('Yoxlama alınmadı'); } finally { setChecking(false); }
  }

  if (isLoading || !pnl || !inventory) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div>
      <PageHeader title="Hesabatlar və Analitika" subtitle="P&L, AR/AP aging, satış, müştəri, inventar" action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateInsight} disabled={aiLoading}>{aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} AI analiz</Button>
          <Button variant="outline" onClick={runOverstock} disabled={checking}>{checking ? <Loader2 className="animate-spin" /> : <PackageSearch className="h-4 w-4" />} Overstock yoxla</Button>
        </div>
      } />

      {insight && (
        <Card className="mb-4 rounded-card border-primary/30 bg-primary/5">
          <CardContent className="flex gap-3 p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed">{insight}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="finance">
        <TabsList>
          <TabsTrigger value="finance">Maliyyə (P&L)</TabsTrigger>
          <TabsTrigger value="aging">AR/AP Aging</TabsTrigger>
          <TabsTrigger value="sales">Satış</TabsTrigger>
          <TabsTrigger value="customers">Müştəri</TabsTrigger>
          <TabsTrigger value="inventory">İnventar</TabsTrigger>
        </TabsList>

        <TabsContent value="finance">
          {ifrs && <FinancialStatements ifrs={ifrs} company={company} periodLabel={periodLabel} />}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard className="lg:col-span-2" title="Xərclərin təhlili (kateqoriya üzrə)" type="donut" data={expenseByCategory} context="AZN, xərc kateqoriyaları">
              {expenseByCategory.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">Xərc yoxdur</p> : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>
                      {expenseByCategory.map((_, i) => <Cell key={i} stroke="transparent" fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Rentabellik</CardTitle></CardHeader>
              <CardContent className="space-y-2.5 pt-1">
                <Ratio label="Ümumi marja" value={`${ifrs?.kpis.grossMargin.toFixed(1) ?? 0}%`} pct={ifrs?.kpis.grossMargin ?? 0} />
                <Ratio label="Xalis marja" value={`${ifrs?.kpis.netMargin.toFixed(1) ?? 0}%`} pct={ifrs?.kpis.netMargin ?? 0} />
                <div className="flex justify-between border-t pt-2 text-sm"><span className="text-muted-foreground">Vergidən əvvəlki mənfəət</span><span className="font-semibold tabular-nums">{formatCurrency(ifrs?.kpis.profitBeforeTax ?? 0, 'AZN')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mənfəət vergisi</span><span className="font-semibold tabular-nums text-rose-500">−{formatCurrency(ifrs?.kpis.incomeTax ?? 0, 'AZN')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cəmi kapital</span><span className="font-semibold tabular-nums">{formatCurrency(ifrs?.kpis.totalEquity ?? 0, 'AZN')}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aging">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AgingCard title="Debitor (AR) aging — müştəri borcları" summary={arAging} />
            <AgingCard title="Kreditor (AP) aging — təchizatçı borcları" summary={apAging} />
          </div>
        </TabsContent>

        <TabsContent value="customers">
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Ümumi müştəri" value={String(customers?.total ?? 0)} />
            <Kpi label="Borclu müştəri (AR)" value={String(customers?.withBalance ?? 0)} />
            <Kpi label="Aktiv alıcı" value={String(customers?.top.length ?? 0)} />
            <Kpi label="Top müştəri gəliri" value={formatCurrency(customers?.top[0]?.revenue ?? 0, 'AZN')} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="rounded-card lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top müştərilər (gəlir / sifariş / orta çek)</CardTitle>
                <ExportButton filename="top-musteriler" rows={customers?.top ?? []} columns={[
                  { header: 'Müştəri', value: 'name' },
                  { header: 'Sifariş', value: 'orders' },
                  { header: 'Orta çek', value: 'aov' },
                  { header: 'Gəlir', value: 'revenue' },
                ]} />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Müştəri</TableHead><TableHead className="text-right">Sifariş</TableHead><TableHead className="text-right">Orta çek</TableHead><TableHead className="text-right">Gəlir</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(customers?.top ?? []).map((c) => <TableRow key={c.name}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-right">{formatNumber(c.orders, 0)}</TableCell><TableCell className="text-right">{formatCurrency(c.aov, 'AZN')}</TableCell><TableCell className="text-right">{formatCurrency(c.revenue, 'AZN')}</TableCell></TableRow>)}
                    {(customers?.top.length ?? 0) === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Satış yoxdur</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <ChartCard title="Seqment üzrə" type="donut" data={customers?.segments ?? []} context="müştəri seqmentləri sayı">
              {(customers?.segments.length ?? 0) === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">Müştəri yoxdur</p> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={customers?.segments} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={82} paddingAngle={3}>
                      {(customers?.segments ?? []).map((_, i) => <Cell key={i} stroke="transparent" fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <div className="mb-4">
            <ChartCard title="Kanal üzrə satış" type="column" data={salesByChannel} context="AZN, satış kanalları">
              {salesByChannel.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Satış yoxdur</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesByChannel}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>{salesByChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <Card className="rounded-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Məhsul üzrə satış</CardTitle>
              <ExportButton filename="mehsul-uzre-satis" rows={salesByProduct} columns={[
                { header: 'Məhsul', value: 'name' },
                { header: 'Ədəd', value: 'qty' },
                { header: 'Gəlir', value: 'revenue' },
              ]} />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Məhsul</TableHead><TableHead className="text-right">Ədəd</TableHead><TableHead className="text-right">Gəlir</TableHead></TableRow></TableHeader>
                <TableBody>
                  {salesByProduct.map((p) => <TableRow key={p.name}><TableCell className="font-medium">{p.name}</TableCell><TableCell className="text-right">{formatNumber(p.qty, 0)}</TableCell><TableCell className="text-right">{formatCurrency(p.revenue, 'AZN')}</TableCell></TableRow>)}
                  {salesByProduct.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Satış yoxdur</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Xam material dəyəri" value={formatCurrency(inventory.rawValue, 'AZN')} />
            <Kpi label="Hazır məhsul dəyəri" value={formatCurrency(inventory.fgValue, 'AZN')} />
            <Kpi label="Kritik material" value={String(inventory.critical.length)} />
            <Kpi label="Overstock variant" value={String(inventory.overstock.length)} />
          </div>
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Kritik / bitmiş materiallar</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Material</TableHead><TableHead className="text-right">Stok</TableHead><TableHead className="text-right">Min</TableHead></TableRow></TableHeader>
                <TableBody>
                  {inventory.critical.map((m) => <TableRow key={m.id}><TableCell className="font-medium">{m.name}</TableCell><TableCell className="text-right text-danger">{formatNumber(m.currentStock)} {m.unit}</TableCell><TableCell className="text-right">{formatNumber(m.minStock)}</TableCell></TableRow>)}
                  {inventory.critical.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-success">Kritik material yoxdur 🟢</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Ratio({ label, value, pct }: { label: string; value: string; pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-[#5B5BF5] to-[#8b3df0]" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>;
}

function AgingCard({ title, summary }: { title: string; summary: ReturnType<typeof buildAging> }) {
  return (
    <ChartCard title={title} type="aging bar" data={summary.buckets} context="AZN, yaş qrupları (cari/30/60/90+)">
      <div className="mb-2 flex items-baseline gap-3">
        <span className="text-2xl font-bold">{formatCurrency(summary.total, 'AZN')}</span>
        {summary.overdueTotal > 0 && <span className="text-xs text-danger">vaxtı keçmiş: {formatCurrency(summary.overdueTotal, 'AZN')}</span>}
      </div>
      <div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={summary.buckets}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
            <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {summary.buckets.map((b, i) => <Cell key={i} fill={b.name.includes('90') ? '#dc2626' : b.name.includes('61') ? '#eab308' : '#2563eb'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {summary.rows.slice(0, 12).map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border/50 py-1 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className={`shrink-0 px-2 text-xs ${r.daysOverdue > 60 ? 'text-danger' : r.daysOverdue > 0 ? 'text-warning' : 'text-muted-foreground'}`}>{r.daysOverdue > 0 ? `${r.daysOverdue} gün` : 'cari'}</span>
              <span className="shrink-0 text-right tnum">{formatCurrency(r.balance, 'AZN')}</span>
            </div>
          ))}
          {summary.rows.length === 0 && <p className="py-6 text-center text-sm text-success">Açıq borc yoxdur 🟢</p>}
        </div>
      </div>
    </ChartCard>
  );
}
