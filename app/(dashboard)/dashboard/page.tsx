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
  Wallet, Package, Factory, ShoppingCart, AlertTriangle, Sparkles, Loader2,
  Plus, ArrowRight, ArrowUpRight, Droplets, Boxes, Target, Settings as SettingsIcon,
} from 'lucide-react';
import { listDocs, getDocById } from '@/lib/firebase/firestore';
import { aiPrompt } from '@/lib/ai/client';
import { ChartCard } from '@/components/charts/chart-card';
import { CHART_COLORS, PRIMARY } from '@/components/charts/palette';
import { useAuth } from '@/components/providers/auth-provider';
import { getRoleName } from '@/lib/rbac/permissions';
import type {
  SalesOrder, Receivable, Payable, RawMaterial, FinishedGoodStock, ProductionOrder,
  Delivery, PurchaseOrder, Customer, WashingOrder, Product,
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
      const [sales, receivables, payables, materials, finished, production, deliveries, purchaseOrders, customers, washing, products] = await Promise.all([
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
        listDocs<Product>('products', []),
      ]);
      return { sales, receivables, payables, materials, finished, production, deliveries, purchaseOrders, customers, washing, products };
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings-global'],
    queryFn: () => getDocById<{ monthlySalesTarget?: number }>('settings', 'global'),
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

  // "Davam et" kartları — ən çox satılan modellər (şəkil + satış progress)
  const featured = useMemo(() => {
    if (!data) return [];
    const soldByName = new Map<string, number>();
    for (const s of data.sales) for (const it of s.items ?? []) soldByName.set(it.productName, (soldByName.get(it.productName) ?? 0) + it.quantity);
    const list = data.products
      .filter((p) => p.status === 'active')
      .map((p) => ({ p, sold: soldByName.get(p.name?.az ?? '') ?? 0 }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6);
    const maxSold = Math.max(1, ...list.map((x) => x.sold));
    return list.map((x) => ({
      id: x.p.id,
      name: x.p.name?.az ?? '',
      category: x.p.category,
      image: x.p.images?.find((i) => i.isPrimary)?.url ?? x.p.images?.[0]?.url,
      price: x.p.wholesalePrice,
      progress: Math.round((x.sold / maxSold) * 100),
      sold: x.sold,
    }));
  }, [data]);
  const salesTarget = settings?.monthlySalesTarget ?? 0;
  const targetPct = m && salesTarget > 0 ? Math.min(100, (m.monthSales / salesTarget) * 100) : 0;

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

  const heroCta = HERO_CTA[role] ?? { href: '/dashboard', label: 'Panelə bax' };

  return (
    <div>
      {isLoading || !m ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-[75vh] w-full rounded-3xl" />
          <Skeleton className="hidden h-[75vh] w-full rounded-3xl lg:block" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* ═══════════ LEFT ═══════════ */}
            <div className="flex min-w-0 flex-col gap-6">
              {/* HERO */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6b5cf2] via-[#6a4cf3] to-[#8b3df0] p-7 text-white shadow-[0_24px_70px_-24px_rgba(91,91,245,0.6)] lg:p-9">
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <Sparkles className="absolute right-8 top-4 h-40 w-40 text-white/[0.12]" strokeWidth={1} />
                  <Sparkles className="absolute right-44 top-24 h-16 w-16 text-white/[0.09]" strokeWidth={1} />
                  <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                </div>
                <div className="relative max-w-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">UP ERP · {getRoleName(role)}</p>
                  <h1 className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight lg:text-[2.7rem]">{greet}, {firstName} <span>🔥</span></h1>
                  <p className="mt-2 text-sm text-white/75">{todayStr} · davam et, bu ayın hədəfinə çatmağa az qalıb!</p>
                  <Link href={heroCta.href} className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-[#0d0d14] py-2.5 pl-5 pr-2.5 text-sm font-semibold text-white transition-transform hover:scale-105">
                    {heroCta.label}
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15"><ArrowRight className="h-4 w-4" /></span>
                  </Link>
                </div>
              </section>

              {/* 3 mini progress cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                {miniStats(role, m).map((s, i) => <StatMini key={i} {...s} />)}
              </div>

              {/* Ən çox satılan (carousel) */}
              <div className="flex flex-1 flex-col">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight">Ən çox satılan modellər</h2>
                  <Link href="/products" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">Hamısı <ArrowUpRight className="h-4 w-4" /></Link>
                </div>
                {featured.length === 0 ? (
                  <Card className="rounded-card flex-1"><Empty text="Hələ satış datası yoxdur" /></Card>
                ) : (
                  <div className="flex flex-1 items-stretch gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {featured.map((f) => <FeatureCard key={f.id} item={f} />)}
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════ RIGHT — Statistik ═══════════ */}
            <aside className="flex flex-col gap-5">
              {/* Avatar ring + aylıq hədəf */}
              <Card className="rounded-card">
                <CardHeader className="pb-0">
                  <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Aylıq satış hədəfi</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center pt-4 text-center">
                  <AvatarRing name={firstName} avatarUrl={profile?.avatarUrl} percent={Math.round(targetPct)} />
                  {salesTarget > 0 ? (
                    <>
                      <p className="mt-4 text-lg font-bold">{formatCurrency(m.monthSales, 'AZN')}</p>
                      <p className="text-xs text-muted-foreground">/ {formatCurrency(salesTarget, 'AZN')} hədəf · bu ay</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 text-sm font-medium">Hədəf təyin edilməyib</p>
                      <Link href="/settings" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><SettingsIcon className="h-3 w-3" /> Tənzimləmələrdə hədəf təyin et</Link>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Aylıq satış bar chart */}
              <Card className="rounded-card">
                <CardHeader className="pb-0"><CardTitle className="text-base">Aylıq satış</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={salesTrend} barSize={22}>
                      <defs>
                        <linearGradient id="miniBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c6cf5" /><stop offset="100%" stopColor="#5B5BF5" /></linearGradient>
                      </defs>
                      <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} width={28} />
                      <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} cursor={{ fill: 'rgba(91,91,245,0.06)' }} />
                      <Bar dataKey="value" radius={[8, 8, 4, 4]}>
                        {salesTrend.map((d, i) => {
                          const max = Math.max(...salesTrend.map((x) => x.value));
                          return <Cell key={i} fill={d.value === max ? '#5B5BF5' : 'url(#miniBar)'} fillOpacity={d.value === max ? 1 : 0.45} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top müştərilər */}
              <Card className="rounded-card flex flex-1 flex-col">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Top müştərilər</CardTitle>
                  <Link href="/customers" className="text-xs font-medium text-primary hover:underline">See all</Link>
                </CardHeader>
                <CardContent className="space-y-1">
                  {m.topCustomers.length === 0 ? <Empty text="Müştəri satışı yoxdur" /> : m.topCustomers.slice(0, 5).map((c) => (
                    <div key={c.name} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-xs font-bold text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">Müştəri</p></div>
                      <span className="shrink-0 text-sm font-bold text-primary">{formatCurrency(c.revenue, 'AZN')}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>

          {/* Son sifarişlər — tam en */}
          <Card className="rounded-card mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Son sifarişlər</CardTitle>
              <Link href="/sales" className="text-sm font-medium text-primary hover:underline">Hamısı</Link>
            </CardHeader>
            <CardContent className="p-0">
              {m.recentOrders.length === 0 ? <Empty text="Sifariş yoxdur" /> : (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[560px] grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 border-b border-border px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Müştəri</span><span>Kanal</span><span>Məbləğ</span><span>Status</span><span>Əməliyyat</span>
                  </div>
                  {m.recentOrders.map((s) => (
                    <div key={s.id} className="grid min-w-[560px] grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-2 border-b border-border/50 px-5 py-2.5 text-sm last:border-0">
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{(s.customerName ?? '?').slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0"><span className="block truncate font-medium">{s.customerName ?? '—'}</span><span className="block truncate text-xs text-muted-foreground">{s.soNumber}</span></span>
                      </div>
                      <span className="truncate text-muted-foreground">{s.channel}</span>
                      <span className="font-semibold">{formatCurrency(s.totalAmount ?? 0, 'AZN')}</span>
                      <span><Badge variant={SALES_ORDER_STATUS_META[s.status]?.variant ?? 'secondary'}>{SALES_ORDER_STATUS_META[s.status]?.label ?? s.status}</Badge></span>
                      <Link href={`/sales/${s.id}`} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary transition-colors hover:bg-primary/10"><ArrowUpRight className="h-4 w-4" /></Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Qrafiklər (direktor + satış) — zəngin tiplər + AI izah ── */}
          {showCharts && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Kombo: aylıq satış (sütun) + kümulyativ (xətt) — 1/3 en */}
              <ChartCard title="Satış trendi və kümulyativ (6 ay)" type="combo (bar + line)" data={salesTrend} context="AZN, aylıq satış sütun, kümulyativ xətt">
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={salesTrend}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.45} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={32} />
                    <Tooltip formatter={(v: number) => formatCurrency(v, 'AZN')} />
                    <Bar name="Aylıq satış" dataKey="value" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={20} />
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
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
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
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={sizeData}>
                      <PolarGrid className="stroke-muted" />
                      <PolarAngleAxis dataKey="size" fontSize={11} />
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
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} width={32} /><Tooltip />
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
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={inventoryMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>
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

const HERO_CTA: Record<string, { href: string; label: string }> = {
  director: { href: '/sales/new', label: 'Yeni satış' },
  sales: { href: '/sales/new', label: 'Yeni satış' },
  cashier: { href: '/pos', label: 'POS aç' },
  accountant: { href: '/finance', label: 'Maliyyəyə bax' },
  warehouse: { href: '/procurement/grn', label: 'GRN qəbulu' },
  production: { href: '/production/new', label: 'İstehsal sifarişi' },
  supply: { href: '/procurement/new', label: 'Yeni PO' },
};

interface MiniStat { icon: typeof Plus; tint: string; value: string; label: string }
function miniStats(role: string, m: Metrics): MiniStat[] {
  if (role === 'warehouse' || role === 'supply') return [
    { icon: Package, tint: 'bg-violet-500/12 text-violet-600', value: formatCurrency(m.inventoryValue, 'AZN'), label: 'Anbar dəyəri' },
    { icon: AlertTriangle, tint: 'bg-rose-500/12 text-rose-600', value: String(m.criticalMaterials.length), label: 'Kritik stok' },
    { icon: ShoppingCart, tint: 'bg-sky-500/12 text-sky-600', value: String(m.openPOs.length), label: 'Açıq PO' },
  ];
  if (role === 'production') return [
    { icon: Factory, tint: 'bg-violet-500/12 text-violet-600', value: String(m.activeProduction.length), label: 'Aktiv istehsal' },
    { icon: Droplets, tint: 'bg-sky-500/12 text-sky-600', value: String(m.inWashing.length), label: 'Yuyulmada' },
    { icon: Boxes, tint: 'bg-pink-500/12 text-pink-600', value: `${formatNumber(m.monthProduction, 0)}`, label: 'Bu ay istehsal' },
  ];
  if (role === 'accountant') return [
    { icon: Wallet, tint: 'bg-violet-500/12 text-violet-600', value: formatCurrency(m.arTotal, 'AZN'), label: 'Debitor (AR)' },
    { icon: Wallet, tint: 'bg-rose-500/12 text-rose-600', value: formatCurrency(m.apTotal, 'AZN'), label: 'Kreditor (AP)' },
    { icon: AlertTriangle, tint: 'bg-amber-500/12 text-amber-600', value: formatCurrency(m.arAging.overdueTotal, 'AZN'), label: 'Vaxtı keçmiş' },
  ];
  return [
    { icon: ShoppingCart, tint: 'bg-violet-500/12 text-violet-600', value: String(m.activeOrders), label: 'Aktiv sifariş' },
    { icon: Wallet, tint: 'bg-sky-500/12 text-sky-600', value: formatCurrency(m.arTotal, 'AZN'), label: 'Debitor (AR)' },
    { icon: AlertTriangle, tint: 'bg-rose-500/12 text-rose-600', value: String(m.criticalMaterials.length), label: 'Kritik stok' },
  ];
}

function StatMini({ icon: Icon, tint, value, label }: MiniStat) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-bold leading-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const CAT_TAG: Record<string, string> = {
  men: 'bg-sky-500/12 text-sky-600', women: 'bg-pink-500/12 text-pink-600', kids: 'bg-amber-500/12 text-amber-600',
};
const CAT_LABEL: Record<string, string> = { men: 'Kişi', women: 'Qadın', kids: 'Uşaq' };
const FEAT_GRAD = ['from-[#5B5BF5] to-[#9333ea]', 'from-[#06b6d4] to-[#3b82f6]', 'from-[#ec4899] to-[#8b5cf6]', 'from-[#14b8a6] to-[#5B5BF5]'];

function FeatureCard({ item }: { item: { id: string; name: string; category: string; image?: string; price: number; progress: number; sold: number } }) {
  return (
    <div className="flex w-[250px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-1 hover:shadow-soft-lg">
      <div className="relative min-h-[150px] flex-1 overflow-hidden rounded-xl">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br p-3', FEAT_GRAD[item.id.charCodeAt(0) % FEAT_GRAD.length])}>
            <span className="text-center text-sm font-bold text-white">{item.name}</span>
          </div>
        )}
      </div>
      <span className={cn('mt-3 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', CAT_TAG[item.category] ?? 'bg-secondary text-foreground')}>{CAT_LABEL[item.category] ?? item.category}</span>
      <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug">{item.name}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-[#5B5BF5] to-[#8b3df0]" style={{ width: `${Math.max(6, item.progress)}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-bold text-primary">{formatCurrency(item.price, 'AZN')}</span>
        <span className="text-muted-foreground">{item.sold} satılıb</span>
      </div>
    </div>
  );
}

function AvatarRing({ name, avatarUrl, percent }: { name: string; avatarUrl?: string; percent: number }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="relative h-28 w-28">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#5B5BF5 ${p * 3.6}deg, rgba(127,127,127,0.14) 0deg)` }} />
      <div className="absolute inset-[7px] overflow-hidden rounded-full bg-card">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>
        )}
      </div>
      <span className="absolute -right-1 top-1 rounded-full bg-[#5B5BF5] px-2 py-0.5 text-[11px] font-bold text-white shadow-lg">{p.toFixed(0)}%</span>
    </div>
  );
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
          <ResponsiveContainer width="100%" height={160}>
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

