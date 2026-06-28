'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, Wallet, Package, Factory, ShoppingCart, AlertTriangle, Sparkles, Loader2,
  Plus, ArrowRight,
} from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { aiPrompt } from '@/lib/ai/client';
import { useAuth } from '@/components/providers/auth-provider';
import { getRoleName } from '@/lib/rbac/permissions';
import type { SalesOrder, Receivable, Payable, RawMaterial, FinishedGoodStock, ProductionOrder } from '@/types';
import { getStockStatus } from '@/lib/utils/stock';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

const MONTHS_AZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];

export default function DashboardPage() {
  const { profile } = useAuth();
  const [insight, setInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const [sales, receivables, payables, materials, finished, production] = await Promise.all([
        listDocs<SalesOrder>('sales_orders', []),
        listDocs<Receivable>('receivables', []),
        listDocs<Payable>('payables', []),
        listDocs<RawMaterial>('raw_materials', []),
        listDocs<FinishedGoodStock>('finished_goods', []),
        listDocs<ProductionOrder>('production_orders', []),
      ]);
      return { sales, receivables, payables, materials, finished, production };
    },
  });

  const kpis = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const todayStr = now.toDateString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const ms = (ts: unknown) => (ts as { toMillis?: () => number })?.toMillis?.() ?? 0;

    const delivered = data.sales.filter((s) => s.status === 'delivered');
    const todaySales = delivered.filter((s) => new Date(ms(s.date) || ms(s.createdAt)).toDateString() === todayStr).reduce((a, s) => a + s.totalAmount, 0);
    const monthSales = delivered.filter((s) => (ms(s.date) || ms(s.createdAt)) >= monthStart).reduce((a, s) => a + s.totalAmount, 0);
    const arTotal = data.receivables.reduce((a, r) => a + (r.balance ?? 0), 0);
    const apTotal = data.payables.reduce((a, p) => a + (p.balance ?? 0), 0);
    const rawValue = data.materials.reduce((a, m) => a + (m.stockValue ?? 0), 0);
    const fgValue = data.finished.reduce((a, f) => a + (f.currentStock ?? 0) * (f.unitCost ?? 0), 0);
    const activeOrders = data.sales.filter((s) => ['new', 'confirmed', 'preparing', 'shipped'].includes(s.status)).length;
    const monthProduction = data.production.filter((p) => (ms(p.createdAt)) >= monthStart).reduce((a, p) => a + (p.producedQuantity ?? 0), 0);
    const criticalStock = data.materials.filter((m) => ['critical', 'out'].includes(getStockStatus(m))).length;

    // COGS təxmini (delivered subtotal − istifadə üçün sadə marja)
    const monthRevenue = monthSales;
    const netProfit = monthRevenue * 0.3; // sadələşdirilmiş; dəqiq P&L Reports-da

    return { todaySales, monthSales, arTotal, apTotal, inventoryValue: rawValue + fgValue, activeOrders, monthProduction, criticalStock, netProfit };
  }, [data]);

  const salesTrend = useMemo(() => {
    if (!data) return [];
    const ms = (ts: unknown) => (ts as { toMillis?: () => number })?.toMillis?.() ?? 0;
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    for (const s of data.sales.filter((x) => x.status === 'delivered')) {
      const d = new Date(ms(s.date) || ms(s.createdAt));
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + s.totalAmount);
    }
    return Array.from(buckets.entries()).map(([k, v]) => ({ month: MONTHS_AZ[Number(k.split('-')[1])], value: Math.round(v) }));
  }, [data]);

  const topProducts = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const s of data.sales) for (const it of s.items ?? []) map.set(it.productName, (map.get(it.productName) ?? 0) + it.quantity);
    return Array.from(map.entries()).map(([name, qty]) => ({ name: name.slice(0, 14), qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [data]);

  async function generateInsight() {
    if (!kpis) return;
    setAiLoading(true);
    try {
      const text = await aiPrompt(
        `Cins şalvar istehsalı ERP-i üçün qısa idarəetmə xülasəsi yaz (2-3 cümlə, Azərbaycan dili). Bu ay satış: ${kpis.monthSales.toFixed(0)} AZN, aktiv sifariş: ${kpis.activeOrders}, debitor: ${kpis.arTotal.toFixed(0)} AZN, kritik stok material sayı: ${kpis.criticalStock}, bu ay istehsal: ${kpis.monthProduction} ədəd. Tövsiyə də ver.`,
      );
      setInsight(text);
    } catch (e) {
      toast.error('AI insight alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Executive Dashboard"
        subtitle={`${profile?.fullName ?? ''} · ${getRoleName(profile?.role)}`}
        action={
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" size="sm" asChild><Link href="/sales/new"><Plus className="h-4 w-4" /> Satış</Link></Button>
            <Button variant="outline" size="sm" asChild><Link href="/pos">POS</Link></Button>
          </div>
        }
      />

      {isLoading || !kpis ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Bu gün satış" value={formatCurrency(kpis.todaySales, 'AZN')} icon={TrendingUp} color="text-success" />
            <Kpi label="Bu ay satış" value={formatCurrency(kpis.monthSales, 'AZN')} icon={TrendingUp} color="text-info" />
            <Kpi label="Bu ay istehsal" value={`${formatNumber(kpis.monthProduction, 0)} ədəd`} icon={Factory} color="text-primary" />
            <Kpi label="Anbar dəyəri" value={formatCurrency(kpis.inventoryValue, 'AZN')} icon={Package} color="text-warning" />
            <Kpi label="Debitor (AR)" value={formatCurrency(kpis.arTotal, 'AZN')} icon={Wallet} color="text-success" />
            <Kpi label="Kreditor (AP)" value={formatCurrency(kpis.apTotal, 'AZN')} icon={Wallet} color="text-danger" />
            <Kpi label="Aktiv sifariş" value={String(kpis.activeOrders)} icon={ShoppingCart} color="text-info" />
            <Kpi label="Kritik stok" value={String(kpis.criticalStock)} icon={AlertTriangle} color="text-danger" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Satış trendi (6 ay)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="rounded-card">
              <CardHeader><CardTitle className="text-base">Top məhsullar (satılan ədəd)</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Satış məlumatı yoxdur</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6 rounded-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI Insights (Groq)</CardTitle>
              <Button variant="outline" size="sm" onClick={generateInsight} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} Yarat
              </Button>
            </CardHeader>
            <CardContent>
              {insight ? <p className="text-sm leading-relaxed">{insight}</p> : <p className="text-sm text-muted-foreground">AI ilə bu ayın xülasəsini və tövsiyələri yaradın.</p>}
            </CardContent>
          </Card>

          {kpis.criticalStock > 0 && (
            <Link href="/materials" className="mt-4 flex items-center justify-between rounded-card border border-danger/30 bg-red-50 p-4 text-sm text-danger">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {kpis.criticalStock} material kritik/bitmiş stokda</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof TrendingUp; color: string }) {
  return (
    <Card className="rounded-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent><div className="text-xl font-bold">{value}</div></CardContent>
    </Card>
  );
}
