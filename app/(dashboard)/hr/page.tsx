'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { UsersRound, Building2, CalendarClock, Plane, Banknote, ArrowUpRight, UserCheck, UserX } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import type { Department, Employee } from '@/types';
import { CHART_COLORS } from '@/components/charts/palette';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

const STATUS_LABEL: Record<string, string> = { active: 'Aktiv', probation: 'Sınaq', on_leave: 'Məzuniyyətdə', suspended: 'Dayandırılmış', terminated: 'İşdən çıxmış' };

export default function HrDashboardPage() {
  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees') });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => listDocs<Department>('departments') });

  const m = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active' || e.status === 'probation');
    const onLeave = employees.filter((e) => e.status === 'on_leave').length;
    const terminated = employees.filter((e) => e.status === 'terminated').length;
    const payrollCost = active.reduce((a, e) => a + (e.baseSalary ?? 0), 0);
    const byDept = new Map<string, number>();
    for (const e of active) byDept.set(e.departmentName ?? 'Təyin edilməmiş', (byDept.get(e.departmentName ?? 'Təyin edilməmiş') ?? 0) + 1);
    const byStatus = new Map<string, number>();
    for (const e of employees) byStatus.set(STATUS_LABEL[e.status] ?? e.status, (byStatus.get(STATUS_LABEL[e.status] ?? e.status) ?? 0) + 1);
    return {
      total: employees.length, active: active.length, onLeave, terminated, payrollCost,
      deptData: Array.from(byDept.entries()).map(([name, value]) => ({ name, value })),
      statusData: Array.from(byStatus.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [employees]);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div>
      <PageHeader title="İnsan Resursları" subtitle="Kadr strukturu, davamiyyət və əmək haqqı icmalı" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={UsersRound} tint="bg-primary/10 text-primary" value={String(m.total)} label="Ümumi işçi" />
        <Kpi icon={UserCheck} tint="bg-emerald-500/10 text-emerald-600" value={String(m.active)} label="Aktiv" />
        <Kpi icon={Plane} tint="bg-amber-500/10 text-amber-600" value={String(m.onLeave)} label="Məzuniyyətdə" />
        <Kpi icon={Banknote} tint="bg-sky-500/10 text-sky-600" value={formatCurrency(m.payrollCost, 'AZN')} label="Aylıq maaş fondu" />
      </div>

      {/* Sürətli keçidlər */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <QuickLink href="/hr/employees" icon={UsersRound} label="İşçilər" />
        <QuickLink href="/hr/org" icon={Building2} label="Struktur" />
        <QuickLink href="/hr/attendance" icon={CalendarClock} label="Davamiyyət" />
        <QuickLink href="/hr/leave" icon={Plane} label="Məzuniyyət" />
        <QuickLink href="/hr/payroll" icon={Banknote} label="Əmək haqqı" />
      </div>

      {employees.length === 0 ? (
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><UserX className="h-8 w-8 text-muted-foreground" /><p className="font-medium">Hələ işçi yoxdur</p><Link href="/hr/employees" className="text-sm text-primary hover:underline">İşçi əlavə et →</Link></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Departament üzrə (aktiv)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={m.deptData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} /><YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip cursor={{ fill: 'rgba(91,91,245,0.06)' }} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>{m.deptData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">Status üzrə bölgü</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={m.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={84} paddingAngle={3}>
                    {m.statusData.map((_, i) => <Cell key={i} stroke="transparent" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, tint, value, label }: { icon: typeof UsersRound; tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
function QuickLink({ href, icon: Icon, label }: { href: string; icon: typeof UsersRound; label: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
