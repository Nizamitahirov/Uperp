'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { where } from 'firebase/firestore';
import { CalendarClock, Save, Loader2, CheckCheck, ClipboardList } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { saveAttendance, buildTimesheet, type AttendanceEntry } from '@/lib/firebase/attendance';
import { useAuth } from '@/components/providers/auth-provider';
import type { Attendance, AttendanceStatus, Employee } from '@/types';
import { formatNumber } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const STATUS_OPTIONS: [AttendanceStatus, string][] = [
  ['present', 'Gəldi'], ['half_day', 'Yarım gün'], ['remote', 'Uzaqdan'], ['leave', 'Məzuniyyət'], ['absent', 'Gəlmədi'], ['holiday', 'Bayram'],
];
const todayKey = () => new Date().toISOString().slice(0, 10);
const monthKey = () => new Date().toISOString().slice(0, 7);

interface Row { status: AttendanceStatus; hoursWorked: string; overtimeHours: string; note: string }

export default function AttendancePage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const [dateKey, setDateKey] = useState(todayKey());
  const [month, setMonth] = useState(monthKey());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees') });
  const active = useMemo(() => employees.filter((e) => e.status === 'active' || e.status === 'probation'), [employees]);

  const { data: dayRecords = [] } = useQuery({
    queryKey: ['attendance', dateKey],
    queryFn: () => listDocs<Attendance>('attendance', [where('dateKey', '==', dateKey)]),
  });
  const { data: monthRecords = [] } = useQuery({
    queryKey: ['attendance-month', month],
    queryFn: () => listDocs<Attendance>('attendance', [where('dateKey', '>=', `${month}-01`), where('dateKey', '<=', `${month}-31`)]),
  });

  useEffect(() => {
    const byEmp = new Map(dayRecords.map((r) => [r.employeeId, r]));
    const next: Record<string, Row> = {};
    for (const e of active) {
      const r = byEmp.get(e.id);
      next[e.id] = r
        ? { status: r.status, hoursWorked: String(r.hoursWorked ?? 0), overtimeHours: String(r.overtimeHours ?? 0), note: r.note ?? '' }
        : { status: 'present', hoursWorked: '8', overtimeHours: '0', note: '' };
    }
    setRows(next);
  }, [dayRecords, active]);

  const timesheet = useMemo(() => buildTimesheet(monthRecords), [monthRecords]);

  function setRow(id: string, patch: Partial<Row>) { setRows((p) => ({ ...p, [id]: { ...p[id], ...patch } })); }
  function markAll(status: AttendanceStatus) {
    setRows((p) => { const n = { ...p }; for (const id of Object.keys(n)) n[id] = { ...n[id], status, hoursWorked: status === 'present' ? '8' : status === 'half_day' ? '4' : '0' }; return n; });
  }

  async function save() {
    const entries: AttendanceEntry[] = active.map((e) => {
      const r = rows[e.id];
      return { employeeId: e.id, employeeName: e.fullName, userId: e.userId ?? null, status: r.status, hoursWorked: +r.hoursWorked || 0, overtimeHours: +r.overtimeHours || 0, note: r.note || undefined };
    });
    setSaving(true);
    try {
      const n = await saveAttendance(dateKey, entries, actor);
      toast.success(`${n} işçi üçün davamiyyət yadda saxlanıldı`);
      qc.invalidateQueries({ queryKey: ['attendance', dateKey] });
      qc.invalidateQueries({ queryKey: ['attendance-month', month] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Davamiyyət" subtitle="Gündəlik davamiyyət qeydiyyatı və aylıq timesheet" />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily"><CalendarClock className="mr-1.5 h-4 w-4" /> Günlük qeyd</TabsTrigger>
          <TabsTrigger value="timesheet"><ClipboardList className="mr-1.5 h-4 w-4" /> Timesheet (aylıq)</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input type="date" className="h-9 w-44" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
            {canManage && <Button variant="outline" size="sm" onClick={() => markAll('present')}><CheckCheck className="h-4 w-4" /> Hamısı gəldi</Button>}
            <span className="ml-auto" />
            {canManage && <Button onClick={save} disabled={saving || active.length === 0}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button>}
          </div>
          <Card className="rounded-card">
            {active.length === 0 ? <EmptyState title="Aktiv işçi yoxdur" description="Əvvəlcə işçi əlavə edin" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead className="w-40">Status</TableHead><TableHead className="text-right w-24">Saat</TableHead><TableHead className="text-right w-24">Əlavə iş</TableHead><TableHead>Qeyd</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {active.map((e) => {
                      const r = rows[e.id] ?? { status: 'present' as AttendanceStatus, hoursWorked: '8', overtimeHours: '0', note: '' };
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.fullName}<span className="ml-1 text-xs text-muted-foreground">{e.positionTitle ?? ''}</span></TableCell>
                          <TableCell>
                            <Select value={r.status} onValueChange={(v) => setRow(e.id, { status: v as AttendanceStatus, hoursWorked: v === 'present' ? '8' : v === 'half_day' ? '4' : '0' })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{STATUS_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Input type="number" step="any" className="h-8 w-20 text-right ml-auto" value={r.hoursWorked} onChange={(ev) => setRow(e.id, { hoursWorked: ev.target.value })} /></TableCell>
                          <TableCell><Input type="number" step="any" className="h-8 w-20 text-right ml-auto" value={r.overtimeHours} onChange={(ev) => setRow(e.id, { overtimeHours: ev.target.value })} /></TableCell>
                          <TableCell><Input className="h-8" value={r.note} onChange={(ev) => setRow(e.id, { note: ev.target.value })} placeholder="—" /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="timesheet">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input type="month" className="h-9 w-44" value={month} onChange={(e) => setMonth(e.target.value)} />
            <span className="ml-auto" />
            <ExportButton filename={`timesheet-${month}`} rows={timesheet} columns={[
              { header: 'İşçi', value: 'employeeName' }, { header: 'İş günü', value: 'presentDays' }, { header: 'Yarım gün', value: 'halfDays' },
              { header: 'Məzuniyyət', value: 'leaveDays' }, { header: 'Qayıb', value: 'absentDays' }, { header: 'Saat', value: 'totalHours' }, { header: 'Əlavə iş', value: 'overtimeHours' },
            ]} />
          </div>
          <Card className="rounded-card">
            {timesheet.length === 0 ? <EmptyState title="Qeyd yoxdur" description="Bu ay üçün davamiyyət qeydi yoxdur" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead className="text-right">İş günü</TableHead><TableHead className="text-right">Yarım</TableHead><TableHead className="text-right">Məzuniyyət</TableHead><TableHead className="text-right">Qayıb</TableHead><TableHead className="text-right">Cəmi saat</TableHead><TableHead className="text-right">Əlavə iş</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {timesheet.map((t) => (
                      <TableRow key={t.employeeId}>
                        <TableCell className="font-medium">{t.employeeName}</TableCell>
                        <TableCell className="text-right tabular-nums">{t.presentDays}</TableCell>
                        <TableCell className="text-right tabular-nums">{t.halfDays}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-600">{t.leaveDays}</TableCell>
                        <TableCell className="text-right tabular-nums text-rose-600">{t.absentDays}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatNumber(t.totalHours, 1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(t.overtimeHours, 1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">Timesheet əmək haqqı hesablanmasında iş günü, saat və əlavə iş üçün istifadə olunur.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
