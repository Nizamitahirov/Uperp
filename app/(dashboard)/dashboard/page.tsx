'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  RadialBarChart, RadialBar,
} from 'recharts';
import {
  TrendingUp, Wallet, Package, Factory, ShoppingCart, AlertTriangle, Sparkles, Loader2,
  Plus, ArrowRight, ArrowUpRight, Truck, Droplets, ClipboardCheck, Boxes, CreditCard, Receipt,
} from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { aiPrompt } from '@/lib/ai/client';
import { ChartCard } from '@/components/charts/chart-card';
import { CHART_COLORS, PRIMARY } from '@/components/charts/palette';
import { useAuth } from '@/components/providers/auth-provider';
import { getRoleName } from '@/lib/rbac/permissions';
import type {
  SalesOrder, Receivable, Payable, RawMaterial, FinishedGoodStock, ProductionOrder,
  Delivery, PurchaseOrder, Customer, WashingOrder,
} from '@/types';
import { getStockStatus } from '@/lib/utils/stock';
import { buildAging } from '@/lib/utils/aging';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SALES_ORDER_STATUS_META, PRODUCTION_STATUS_META } from '@/lib/constants';
import { toast } from '@/components/ui/toast';

const MONTHS_AZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const ACTIVE_PROD = ['planned', 'material_check', 'in_progress', 'in_washing', 'in_qc'];
const OPEN_PO = ['draft', 'approved', 'sent_to_supplier', 'confirmed', 'shipped', 'partially_received'];
const ms = (ts: unknown) => (ts as { toMillis?: () => number })?.toMillis?.() ?? 0;

export default function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'director';
  const [insight, setInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: async () => {
      const [sales, receivables, payables, materials, finished, production, deliveries, purchaseOrders, customers, washing] = await Promise.all([
        listDocs<SalesOrder>('sales_orders', []),
        listDocs<Receivable>('receivables', []),
        listDocs<Payable>('payables', []),
        listDocs<RawMaterial>('raw_materials', []),
        listDocs<FinishedGoodStock>('finished_goods', []),
        listDocs<ProductionOrder>('production_orders', []),
        listDocs<Delivery>('deliveries', []),
        listDocs<PurchaseOrder>('purchase_orders', []),
        listDocs<Customer>('customers', []),
        listDocs<WashingOrder>('washing_orders', []),
      ]);
      return { sales, receivables, payables, materials, finished, production, deliveries, purchaseOrders, customers, washing };
    },
  });

  const m = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const todayStr = now.toDateString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const delivered = data.sales.filter((s) => s.status === 'delivered');
    const todaySales = delivered.filter((s) => new Date(ms(s.date) || ms(s.createdAt)).toDateString() === todayStr).reduce((a, s) => a + s.totalAmount, 0);
    const monthSales = delivered.filter((s) => (ms(s.date) || ms(s.createdAt)) >= monthStart).reduce((a, s) => a + s.totalAmount, 0);
    const arTotal = data.receivables.reduce((a, r) => a + (r.balance ?? 0), 0);
    const apTotal = data.payables.reduce((a, p) => a + (p.balance ?? 0), 0);
    const rawValue = data.materials.reduce((a, x) => a + (x.stockValue ?? 0), 0);
    const fgValue = data.finished.reduce((a, f) => a + (f.currentStock ?? 0) * (f.unitCost ?? 0), 0);
    const activeOrders = data.sales.filter((s) => ['new', 'confirmed', 'preparing', 'shipped'].includes(s.status)).length;
    const monthProduction = data.production.filter((p) => ms(p.createdAt) >= monthStart).reduce((a, p) => a + (p.producedQuantity ?? 0), 0);
    const criticalMaterials = data.materials.filter((x) => ['critical', 'out'].includes(getStockStatus(x)));
    const netProfit = monthSales * 0.3;

    const activeProduction = data.production.filter((p) => ACTIVE_PROD.includes(p.status));
    const inWashing = data.washing.filter((w) => ['sent', 'in_process'].includes(w.status));
    const openPOs = data.purchaseOrders.filter((p) => OPEN_PO.includes(p.status));
    const pendingGRN = data.purchaseOrders.filter((p) => ['confirmed', 'shipped', 'partially_received'].includes(p.status));
    const todayDeliveries = data.deliveries.filter((d) => new Date(ms(d.createdAt)).toDateString() === todayStr).length;
    const fgVariants = data.finished.filter((f) => (f.currentStock ?? 0) > 0).length;

    // Vaxtı çatan ödənişlər (növbəti 7 gün + keçmiş)
    const soon = now.getTime() + 7 * 86_400_000;
    const dueReceivables = data.receivables.filter((r) => (r.balance ?? 0) > 0 && r.dueDate && ms(r.dueDate) <= soon);
    const dueSum = dueReceivables.reduce((a, r) => a + r.balance, 0);

    const arAging = buildAging(data.receivables.map((r) => ({ id: r.id, name: r.customerName ?? r.invoiceNumber ?? r.id, reference: r.invoiceNumber, balance: r.balance, dueDate: r.dueDate })));
    const apAging = buildAging(data.payables.map((p) => ({ id: p.id, name: p.supplierName ?? p.invoiceNumber ?? p.id, reference: p.invoiceNumber, balance: p.balance, dueDate: p.dueDate })));

    // Top müştərilər (gəlir üzrə)
    const custRev = new Map<string, number>();
    for (const s of delivered) custRev.set(s.customerName ?? s.customerId, (custRev.get(s.customerName ?? s.customerId) ?? 0) + s.totalAmount);
    const topCustomers = Array.from(custRev.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const recentOrders = [...data.sales].sort((a, b) => ms(b.createdAt) - ms(a.createdAt)).slice(0, 6);

    return {
      todaySales, monthSales, arTotal, apTotal, inventoryValue: rawValue + fgValue, rawValue, fgValue,
      activeOrders, monthProduction, criticalMaterials, netProfit, activeProduction, inWashing,
      openPOs, pendingGRN, todayDeliveries, fgVariants, dueReceivables, dueSum, arAging, apAging,
      topCustomers, recentOrders, customerCount: data.customers.length,
    };
  }, [data]);

  // Kombo qrafik — aylıq satış (sütun) + kümulyativ (xətt)
  const salesTrend = useMemo(() => {
    if (!data) return [];
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
    let cum = 0;
    return Array.from(buckets.entries()).map(([k, v]) => {
      cum += v;
      return { month: MONTHS_AZ[Number(k.split('-')[1])], value: Math.round(v), cumulative: Math.round(cum) };
    });
  }, [data]);

  const topProducts = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const s of data.sales) for (const it of s.items ?? []) map.set(it.productName, (map.get(it.productName) ?? 0) + it.quantity);
    return Array.from(map.entries()).map(([name, qty]) => ({ name: name.slice(0, 14), qty })).sort((a, b) => b.qty - a.qty).slice(0, 6);
  }, [data]);

  // Donut — kanal üzrə satış
  const channelData = useMemo(() => {
    if (!data) return [];
    const labels: Record<string, string> = { online: 'Onlayn', wholesale: 'Topdan', retail: 'Pərakəndə', pos: 'POS', b2b: 'B2B', b2c: 'B2C' };
    const map = new Map<string, number>();
    for (const s of data.sales) map.set(labels[s.channel] ?? s.channel, (map.get(labels[s.channel] ?? s.channel) ?? 0) + s.totalAmount);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [data]);

  // Radar — ölçü aralığı üzrə satış (ədəd)
  const sizeData = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const s of data.sales) for (const it of s.items ?? []) { if (it.size) map.set(it.size, (map.get(it.size) ?? 0) + it.quantity); }
    return Array.from(map.entries()).map(([size, qty]) => ({ size, qty })).sort((a, b) => a.size.localeCompare(b.size));
  }, [data]);

  // Donut — anbar tərkibi (xam vs hazır)
  const inventoryMix = useMemo(() => {
    if (!m) return [];
    return [
      { name: 'Xam material', value: Math.round(m.rawValue) },
      { name: 'Hazır məhsul', value: Math.round(m.fgValue) },
    ].filter((x) => x.value > 0);
  }, [m]);

  async function generateInsight() {
    if (!m) return;
    setAiLoading(true);
    try {
      const text = await aiPrompt(
        `Cins şalvar istehsalı ERP-i üçün ${getRoleName(role)} roluna uyğun qısa idarəetmə xülasəsi yaz (2-3 cümlə, Azərbaycan dili). Bu ay satış: ${m.monthSales.toFixed(0)} AZN, aktiv sifariş: ${m.activeOrders}, debitor: ${m.arTotal.toFixed(0)} AZN, kreditor: ${m.apTotal.toFixed(0)} AZN, kritik stok material: ${m.criticalMaterials.length}, aktiv istehsal: ${m.activeProduction.length}, bu ay istehsal: ${m.monthProduction} ədəd. Tövsiyə də ver.`,
      );
      setInsight(text);
    } catch (e) {
      toast.error('AI insight alınmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setAiLoading(false);
    }
  }

  const showAI = ['director', 'accountant', 'sales'].includes(role);
  const showCharts = ['director', 'sales'].includes(role);

  const now = new Date();
  const greet = now.getHours() < 12 ? 'Sabahınız xeyir' : now.getHours() < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir';
  const firstName = (profile?.fullName || profile?.username || 'İstifadəçi').split(' ')[0];
  const todayStr = now.toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      {/* ── HERO greeting banner ── */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#5B5BF5] via-[#6d4af3] to-[#8b3df0] p-6 text-white shadow-[0_24px_70px_-24px_rgba(91,91,245,0.65)] lg:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />
          <Sparkles className="absolute right-10 top-8 h-16 w-16 text-white/15" />
          <Sparkles className="absolute right-40 top-20 h-8 w-8 text-white/10" />
        </div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-white/70">{todayStr}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight lg:text-[2.6rem]">{greet}, {firstName} <span className="inline-block">🔥</span></h1>
            <p className="mt-1.5 text-sm text-white/75">{getRoleName(role)} · davam et, hədəfə çatmağa az qalıb!</p>
            <div className="mt-5"><QuickActions role={role} glass /></div>
          </div>
          {m && (
            <div className="flex shrink-0 gap-3">
              <HeroStat label="Bu gün satış" value={formatCurrency(m.todaySales, 'AZN')} />
              <HeroStat label="Bu ay satış" value={formatCurrency(m.monthSales, 'AZN')} highlight />
            </div>
          )}
        </div>
      </section>

      {isLoading || !m ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : (
        <>
          {/* ── Rol-spesifik KPI sətri (11.2) ── */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <RoleKpis role={role} m={m} />
          </div>

          {/* ── Qrafiklər (direktor + satış) — zəngin tiplər + AI izah ── */}
          {showCharts && (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Kombo: aylıq satış (sütun) + kümulyativ (xətt) */}
              <ChartCard className="lg:col-span-2" title="Satış trendi və kümulyativ (6 ay)" type="combo (bar + line)" data={salesTrend} context="AZN, aylıq satış sütun, kümulyativ xətt">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={salesTrend}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} />
                    <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                    <Legend />
                    <Bar name="Aylıq satış" dataKey="value" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={36} />
                    <Line name="Kümulyativ" type="monotone" dataKey="cumulative" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Radial gauge: mənfəət marjası */}
              <GaugeCard
                title="Mənfəət marjası"
                percent={m.monthSales > 0 ? (m.netProfit / m.monthSales) * 100 : 0}
                label="bu ay (təxmini)"
                color={PRIMARY}
                sub={[
                  { label: 'Aktiv sifariş', value: String(m.activeOrders) },
                  { label: 'Debitor', value: formatCurrency(m.arTotal, 'AZN') },
                ]}
              />

              {/* Donut: kanal üzrə satış */}
              <ChartCard title="Kanal üzrə satış" type="donut" data={channelData} context="AZN, satış kanalları payı">
                {channelData.length === 0 ? <Empty text="Satış məlumatı yoxdur" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={3}>
                        {channelData.map((_, i) => <Cell key={i} stroke="transparent" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Radar: ölçü üzrə satış */}
              <ChartCard title="Ölçü aralığı üzrə satış" type="radar" data={sizeData} context="ədəd, ölçü aralıqları">
                {sizeData.length === 0 ? <Empty text="Ölçü məlumatı yoxdur" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={sizeData}>
                      <PolarGrid className="stroke-muted" />
                      <PolarAngleAxis dataKey="size" fontSize={12} />
                      <PolarRadiusAxis fontSize={10} />
                      <Radar name="Ədəd" dataKey="qty" stroke={PRIMARY} fill={PRIMARY} fillOpacity={0.35} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Sütun: top məhsullar */}
              <ChartCard title="Top məhsullar (satılan ədəd)" type="column" data={topProducts} context="ədəd, ən çox satılan modellər">
                {topProducts.length === 0 ? <Empty text="Satış məlumatı yoxdur" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={12} /><Tooltip />
                      <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
                        {topProducts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Donut: anbar tərkibi (yalnız direktor) */}
              {role === 'director' && (
                <ChartCard title="Anbar dəyəri tərkibi" type="donut" data={inventoryMix} context="AZN, xam material vs hazır məhsul">
                  {inventoryMix.length === 0 ? <Empty text="Stok məlumatı yoxdur" /> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={inventoryMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} paddingAngle={3}>
                          {inventoryMix.map((_, i) => <Cell key={i} stroke="transparent" fill={[CHART_COLORS[4], CHART_COLORS[0]][i % 2]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              )}
            </div>
          )}

          {/* ── Rol-spesifik panellər ── */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RolePanels role={role} m={m} />
          </div>

          {/* ── AI Insights ── */}
          {showAI && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-transparent to-fuchsia-500/[0.06] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-white shadow-lg"><Sparkles className="h-5 w-5" /></span>
                  <div>
                    <p className="text-sm font-semibold">AI Insights</p>
                    <p className="text-xs text-muted-foreground">Groq · {getRoleName(role)} üçün</p>
                  </div>
                </div>
                <Button size="sm" onClick={generateInsight} disabled={aiLoading} className="shadow-glow">
                  {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} Yarat
                </Button>
              </div>
              <p className={cn('mt-3 text-sm leading-relaxed', !insight && 'text-muted-foreground')}>
                {insight || `AI ilə ${getRoleName(role)} üçün xülasə və tövsiyələr yaradın.`}
              </p>
            </div>
          )}

          {m.criticalMaterials.length > 0 && ['director', 'warehouse', 'supply'].includes(role) && (
            <Link href="/materials" className="mt-4 flex items-center justify-between rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 to-transparent p-4 text-sm font-medium text-rose-600 transition-colors hover:from-rose-500/15 dark:text-rose-400">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> {m.criticalMaterials.length} material kritik/bitmiş stokda</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}

interface Metrics {
  todaySales: number; monthSales: number; arTotal: number; apTotal: number; inventoryValue: number;
  rawValue: number; fgValue: number; activeOrders: number; monthProduction: number;
  criticalMaterials: RawMaterial[]; netProfit: number; activeProduction: ProductionOrder[];
  inWashing: WashingOrder[]; openPOs: PurchaseOrder[]; pendingGRN: PurchaseOrder[];
  todayDeliveries: number; fgVariants: number; dueReceivables: Receivable[]; dueSum: number;
  arAging: ReturnType<typeof buildAging>; apAging: ReturnType<typeof buildAging>;
  topCustomers: { name: string; revenue: number }[]; recentOrders: SalesOrder[]; customerCount: number;
}

function QuickActions({ role, glass }: { role: string; glass?: boolean }) {
  const actions: Record<string, { href: string; label: string; icon: typeof Plus }[]> = {
    director: [{ href: '/sales/new', label: 'Satış', icon: Plus }, { href: '/pos', label: 'POS', icon: ShoppingCart }],
    sales: [{ href: '/sales/new', label: 'Yeni satış', icon: Plus }, { href: '/quotations', label: 'Təklif', icon: Receipt }],
    cashier: [{ href: '/pos', label: 'POS', icon: ShoppingCart }, { href: '/cash', label: 'Kassa', icon: Wallet }],
    accountant: [{ href: '/finance', label: 'Ödəniş qeyd et', icon: CreditCard }, { href: '/finance', label: 'Xərc', icon: Receipt }],
    warehouse: [{ href: '/procurement/grn', label: 'GRN', icon: Truck }, { href: '/materials', label: 'Material', icon: Package }],
    production: [{ href: '/production/new', label: 'İstehsal sifarişi', icon: Plus }],
    supply: [{ href: '/procurement/new', label: 'Yeni PO', icon: Plus }, { href: '/procurement/pr', label: 'PR', icon: ClipboardCheck }],
  };
  const list = actions[role] ?? [];
  if (list.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((a, i) => (
        <Link
          key={a.href + a.label}
          href={a.href}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all',
            glass
              ? i === 0
                ? 'bg-white text-[#5B5BF5] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] hover:scale-105'
                : 'border border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20'
              : 'border border-border hover:bg-secondary',
          )}
        >
          <a.icon className="h-4 w-4" /> {a.label}
        </Link>
      ))}
    </div>
  );
}

function HeroStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('min-w-[150px] rounded-2xl border border-white/20 p-4 backdrop-blur-md', highlight ? 'bg-white/20' : 'bg-white/10')}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function RoleKpis({ role, m }: { role: string; m: Metrics }) {
  if (role === 'accountant') return <>
    <Kpi label="Bu ay satış" value={formatCurrency(m.monthSales, 'AZN')} icon={TrendingUp} color="text-info" />
    <Kpi label="Debitor (AR)" value={formatCurrency(m.arTotal, 'AZN')} icon={Wallet} color="text-success" />
    <Kpi label="Kreditor (AP)" value={formatCurrency(m.apTotal, 'AZN')} icon={Wallet} color="text-danger" />
    <Kpi label="Vaxtı keçmiş AR" value={formatCurrency(m.arAging.overdueTotal, 'AZN')} icon={AlertTriangle} color="text-warning" />
  </>;
  if (role === 'warehouse') return <>
    <Kpi label="Anbar dəyəri" value={formatCurrency(m.inventoryValue, 'AZN')} icon={Package} color="text-warning" />
    <Kpi label="Xam material dəyəri" value={formatCurrency(m.rawValue, 'AZN')} icon={Package} color="text-info" />
    <Kpi label="Hazır məhsul variant" value={String(m.fgVariants)} icon={Boxes} color="text-primary" />
    <Kpi label="Kritik stok" value={String(m.criticalMaterials.length)} icon={AlertTriangle} color="text-danger" />
  </>;
  if (role === 'production') return <>
    <Kpi label="Aktiv istehsal" value={String(m.activeProduction.length)} icon={Factory} color="text-primary" />
    <Kpi label="Bu ay istehsal" value={`${formatNumber(m.monthProduction, 0)} ədəd`} icon={Factory} color="text-info" />
    <Kpi label="Yuyulmada" value={String(m.inWashing.length)} icon={Droplets} color="text-warning" />
    <Kpi label="Kritik material" value={String(m.criticalMaterials.length)} icon={AlertTriangle} color="text-danger" />
  </>;
  if (role === 'supply') return <>
    <Kpi label="Açıq PO" value={String(m.openPOs.length)} icon={ShoppingCart} color="text-primary" />
    <Kpi label="Gözləyən GRN" value={String(m.pendingGRN.length)} icon={Truck} color="text-warning" />
    <Kpi label="Kreditor (AP)" value={formatCurrency(m.apTotal, 'AZN')} icon={Wallet} color="text-danger" />
    <Kpi label="Kritik material" value={String(m.criticalMaterials.length)} icon={AlertTriangle} color="text-info" />
  </>;
  if (role === 'sales' || role === 'cashier') return <>
    <Kpi label="Bu gün satış" value={formatCurrency(m.todaySales, 'AZN')} icon={TrendingUp} color="text-success" />
    <Kpi label="Bu ay satış" value={formatCurrency(m.monthSales, 'AZN')} icon={TrendingUp} color="text-info" />
    <Kpi label="Aktiv sifariş" value={String(m.activeOrders)} icon={ShoppingCart} color="text-primary" />
    <Kpi label="Debitor (AR)" value={formatCurrency(m.arTotal, 'AZN')} icon={Wallet} color="text-warning" />
  </>;
  // director (default) — tam executive
  return <>
    <Kpi label="Bu gün satış" value={formatCurrency(m.todaySales, 'AZN')} icon={TrendingUp} color="text-success" />
    <Kpi label="Bu ay satış" value={formatCurrency(m.monthSales, 'AZN')} icon={TrendingUp} color="text-info" />
    <Kpi label="Bu ay istehsal" value={`${formatNumber(m.monthProduction, 0)} ədəd`} icon={Factory} color="text-primary" />
    <Kpi label="Anbar dəyəri" value={formatCurrency(m.inventoryValue, 'AZN')} icon={Package} color="text-warning" />
    <Kpi label="Debitor (AR)" value={formatCurrency(m.arTotal, 'AZN')} icon={Wallet} color="text-success" />
    <Kpi label="Kreditor (AP)" value={formatCurrency(m.apTotal, 'AZN')} icon={Wallet} color="text-danger" />
    <Kpi label="Aktiv sifariş" value={String(m.activeOrders)} icon={ShoppingCart} color="text-info" />
    <Kpi label="Kritik stok" value={String(m.criticalMaterials.length)} icon={AlertTriangle} color="text-danger" />
  </>;
}

function RolePanels({ role, m }: { role: string; m: Metrics }) {
  // Anbardar / Təchizat — kritik materiallar
  if (role === 'warehouse' || role === 'supply') {
    return <>
      <PanelCard title="Kritik / bitmiş materiallar" href="/materials">
        {m.criticalMaterials.length === 0 ? <Empty text="Kritik material yoxdur 🟢" /> : m.criticalMaterials.slice(0, 8).map((x) => (
          <Row3 key={x.id} a={x.name} b={`${formatNumber(x.currentStock)} ${x.unit}`} c={<span className="text-danger">min {formatNumber(x.minStock)}</span>} />
        ))}
      </PanelCard>
      {role === 'supply' ? (
        <PanelCard title="Açıq satınalma sifarişləri" href="/procurement">
          {m.openPOs.length === 0 ? <Empty text="Açıq PO yoxdur" /> : m.openPOs.slice(0, 8).map((p) => (
            <Row3 key={p.id} a={p.poNumber ?? p.id} b={p.supplierName ?? '—'} c={formatCurrency(p.totalAmount ?? 0, 'AZN')} />
          ))}
        </PanelCard>
      ) : (
        <PanelCard title="Gözləyən GRN (qəbul)" href="/procurement/grn">
          {m.pendingGRN.length === 0 ? <Empty text="Gözləyən qəbul yoxdur" /> : m.pendingGRN.slice(0, 8).map((p) => (
            <Row3 key={p.id} a={p.poNumber ?? p.id} b={p.supplierName ?? '—'} c={<Badge variant="warning">qəbul gözləyir</Badge>} />
          ))}
        </PanelCard>
      )}
    </>;
  }
  // İstehsalat — aktiv istehsal sifarişləri
  if (role === 'production') {
    return <>
      <PanelCard title="Aktiv istehsal sifarişləri" href="/production">
        {m.activeProduction.length === 0 ? <Empty text="Aktiv istehsal yoxdur" /> : m.activeProduction.slice(0, 8).map((p) => (
          <Row3 key={p.id} a={p.orderNumber} b={p.productName ?? '—'} c={<Badge variant={PRODUCTION_STATUS_META[p.status]?.variant ?? 'secondary'}>{PRODUCTION_STATUS_META[p.status]?.label ?? p.status}</Badge>} />
        ))}
      </PanelCard>
      <PanelCard title="Yuyulmada olan partiyalar" href="/washing">
        {m.inWashing.length === 0 ? <Empty text="Yuyulmada partiya yoxdur" /> : m.inWashing.slice(0, 8).map((w) => (
          <Row3 key={w.id} a={w.washNumber} b={`${formatNumber(w.sentQuantity, 0)} ədəd`} c={w.laundryName ?? (w.isOutsourced ? 'Kənar' : 'Daxili')} />
        ))}
      </PanelCard>
    </>;
  }
  // Mühasib — AR/AP aging
  if (role === 'accountant') {
    return <>
      <AgingPanel title="Debitor (AR) aging" summary={m.arAging} href="/finance" />
      <AgingPanel title="Kreditor (AP) aging" summary={m.apAging} href="/finance" />
    </>;
  }
  // Satış / Kassir — top müştərilər + son sifarişlər
  if (role === 'sales' || role === 'cashier' || role === 'director') {
    return <>
      <PanelCard title="Top müştərilər (gəlir)" href="/customers">
        {m.topCustomers.length === 0 ? <Empty text="Müştəri satışı yoxdur" /> : m.topCustomers.map((c) => (
          <Row3 key={c.name} a={c.name} b="" c={formatCurrency(c.revenue, 'AZN')} />
        ))}
      </PanelCard>
      <PanelCard title="Son sifarişlər" href="/sales">
        {m.recentOrders.length === 0 ? <Empty text="Sifariş yoxdur" /> : m.recentOrders.map((s) => (
          <Row3 key={s.id} a={s.soNumber ?? s.id} b={s.customerName ?? '—'} c={<Badge variant={SALES_ORDER_STATUS_META[s.status]?.variant ?? 'secondary'}>{SALES_ORDER_STATUS_META[s.status]?.label ?? s.status}</Badge>} />
        ))}
      </PanelCard>
    </>;
  }
  return null;
}

/** Canlı məlumat — bütün rollarda altda göstərilə bilər (hazırda panellərə inteqrasiya edilib) */
function AgingPanel({ title, summary, href }: { title: string; summary: ReturnType<typeof buildAging>; href: string }) {
  return (
    <PanelCard title={title} href={href}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold">{formatCurrency(summary.total, 'AZN')}</span>
        {summary.overdueTotal > 0 && <span className="text-xs text-danger">vaxtı keçmiş: {formatCurrency(summary.overdueTotal, 'AZN')}</span>}
      </div>
      {summary.buckets.map((b) => (
        <div key={b.name} className="flex items-center justify-between py-0.5 text-sm">
          <span className="text-muted-foreground">{b.name}</span>
          <span className={b.name.includes('90') ? 'font-medium text-danger' : ''}>{formatCurrency(b.value, 'AZN')}</span>
        </div>
      ))}
    </PanelCard>
  );
}

function GaugeCard({ title, percent, label, color, sub }: { title: string; percent: number; label: string; color: string; sub?: { label: string; value: string }[] }) {
  const pct = Math.min(100, Math.max(0, percent));
  const data = [{ name: title, value: pct }];
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
              <defs>
                <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#5B5BF5" /><stop offset="100%" stopColor="#8b3df0" />
                </linearGradient>
              </defs>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: 'rgba(127,127,127,0.12)' }} dataKey="value" cornerRadius={20} fill="url(#gaugeGrad)" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold tracking-tight" style={{ color }}>{pct.toFixed(0)}%</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        </div>
        {sub && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {sub.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-sm font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PanelCard({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-card transition-shadow hover:shadow-soft-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Hamısı <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}
function Row3({ a, b, c }: { a: React.ReactNode; b: React.ReactNode; c: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5 text-sm last:border-0">
      <span className="min-w-0 flex-1 truncate font-medium">{a}</span>
      {b ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{b}</span> : null}
      <span className="shrink-0 text-right">{c}</span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

const KPI_THEME: Record<string, { ic: string; blob: string }> = {
  'text-success': { ic: 'from-emerald-400 to-emerald-600', blob: 'bg-emerald-500/15' },
  'text-info': { ic: 'from-sky-400 to-blue-600', blob: 'bg-sky-500/15' },
  'text-primary': { ic: 'from-[#5B5BF5] to-[#8b3df0]', blob: 'bg-[#5B5BF5]/15' },
  'text-warning': { ic: 'from-amber-400 to-orange-500', blob: 'bg-amber-500/15' },
  'text-danger': { ic: 'from-rose-400 to-red-600', blob: 'bg-rose-500/15' },
};

function Kpi({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof TrendingUp; color: string }) {
  const t = KPI_THEME[color] ?? KPI_THEME['text-primary'];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg">
      <div aria-hidden className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity group-hover:opacity-80', t.blob)} />
      <span className={cn('relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg', t.ic)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="relative mt-3 text-2xl font-bold leading-none tracking-tight">{value}</p>
      <p className="relative mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
