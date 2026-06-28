'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Loader2, PackageSearch } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { checkOverstock } from '@/lib/firebase/notifications';
import { useAuth } from '@/components/providers/auth-provider';
import type { SalesOrder, Expense, FinishedGoodStock, RawMaterial } from '@/types';
import { EXPENSE_CATEGORIES, VAT_RATE } from '@/lib/constants';
import { getStockStatus } from '@/lib/utils/stock';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#9333ea', '#0891b2'];

export default function ReportsPage() {
  const { profile } = useAuth();
  const [checking, setChecking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-data'],
    queryFn: async () => {
      const [sales, expenses, finished, materials] = await Promise.all([
        listDocs<SalesOrder>('sales_orders', []),
        listDocs<Expense>('expenses', []),
        listDocs<FinishedGoodStock>('finished_goods', []),
        listDocs<RawMaterial>('raw_materials', []),
      ]);
      return { sales, expenses, finished, materials };
    },
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
      <PageHeader title="Hesabatlar və Analitika" subtitle="P&L, satış, inventar" action={
        <Button variant="outline" onClick={runOverstock} disabled={checking}>{checking ? <Loader2 className="animate-spin" /> : <PackageSearch className="h-4 w-4" />} Overstock yoxla</Button>
      } />

      <Tabs defaultValue="finance">
        <TabsList>
          <TabsTrigger value="finance">Maliyyə (P&L)</TabsTrigger>
          <TabsTrigger value="sales">Satış</TabsTrigger>
          <TabsTrigger value="inventory">İnventar</TabsTrigger>
        </TabsList>

        <TabsContent value="finance">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Mənfəət və Zərər (P&L)</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Satışdan gəlir (net)" value={formatCurrency(pnl.revenue, 'AZN')} />
                <Row label="(−) COGS (FIFO/AVCO)" value={formatCurrency(pnl.cogs, 'AZN')} />
                <Row label="= Ümumi mənfəət" value={`${formatCurrency(pnl.grossProfit, 'AZN')} (${pnl.grossMargin.toFixed(1)}%)`} bold />
                <Row label="(−) Əməliyyat xərcləri" value={formatCurrency(pnl.totalExpenses, 'AZN')} />
                <Row label="= Xalis mənfəət" value={`${formatCurrency(pnl.netProfit, 'AZN')} (${pnl.netMargin.toFixed(1)}%)`} bold />
                <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">Toplanmış ƏDV ({VAT_RATE}%): {formatCurrency(pnl.vatCollected, 'AZN')}</div>
              </CardContent>
            </Card>
            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Xərclər (kateqoriya üzrə)</CardTitle></CardHeader>
              <CardContent>
                {expenseByCategory.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">Xərc yoxdur</p> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <Card className="mb-4 rounded-card">
            <CardHeader><CardTitle className="text-base">Kanal üzrə satış</CardTitle></CardHeader>
            <CardContent>
              {salesByChannel.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Satış yoxdur</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesByChannel}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Məhsul üzrə satış</CardTitle></CardHeader>
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'border-t pt-1 font-bold' : 'text-muted-foreground'}`}><span>{label}</span><span>{value}</span></div>;
}
function Kpi({ label, value }: { label: string; value: string }) {
  return <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>;
}
