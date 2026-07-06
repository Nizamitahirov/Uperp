'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Plane, Check, X, Plus, Loader2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createLeaveRequest, setLeaveStatus, LEAVE_TYPES } from '@/lib/firebase/leave';
import { useAuth } from '@/components/providers/auth-provider';
import type { Employee, LeaveRequest, LeaveStatus } from '@/types';
import { formatDate } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { ExportButton } from '@/components/shared/export-button';
import { EmptyState } from '@/components/shared/empty-state';
import { FilterBar, ALL } from '@/components/shared/filter-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const STATUS_META: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  pending: { label: 'Gözləyir', variant: 'warning' }, approved: { label: 'Təsdiqlənib', variant: 'success' },
  rejected: { label: 'Rədd', variant: 'destructive' }, cancelled: { label: 'Ləğv', variant: 'secondary' },
};

export default function LeavePage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [working, setWorking] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: '', type: 'annual', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const { data: requests = [], isLoading } = useQuery({ queryKey: ['leave_requests'], queryFn: () => listDocs<LeaveRequest>('leave_requests', [orderBy('createdAt', 'desc')]) });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => listDocs<Employee>('employees') });
  const ms = (t: unknown) => (t as { toMillis?: () => number })?.toMillis?.();

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (type !== ALL && r.type !== type) return false;
      if (s && !(r.employeeName?.toLowerCase().includes(s) || r.requestNumber?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [requests, search, status, type]);

  const kpis = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    days: requests.filter((r) => r.status === 'approved').reduce((a, r) => a + r.days, 0),
  }), [requests]);

  async function decide(r: LeaveRequest, s: LeaveStatus) {
    setWorking(r.id);
    try { await setLeaveStatus(r, s, actor); toast.success(s === 'approved' ? 'Təsdiqləndi' : 'Rədd edildi'); qc.invalidateQueries({ queryKey: ['leave_requests'] }); qc.invalidateQueries({ queryKey: ['employees'] }); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setWorking(''); }
  }

  async function submit() {
    if (!form.employeeId || !form.startDate || !form.endDate) { toast.error('Bütün sahələri doldurun'); return; }
    const emp = employees.find((e) => e.id === form.employeeId);
    setSaving(true);
    try {
      await createLeaveRequest({ employeeId: form.employeeId, employeeName: emp?.fullName, userId: emp?.userId ?? null, type: form.type, startDate: form.startDate, endDate: form.endDate, reason: form.reason || undefined }, actor);
      toast.success('Sorğu yaradıldı'); setOpen(false); setForm({ employeeId: '', type: 'annual', startDate: '', endDate: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['leave_requests'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Məzuniyyət" subtitle="Məzuniyyət sorğuları, təsdiq və balans" action={canManage ? <Button onClick={() => setOpen(true)}><Plus /> Yeni sorğu</Button> : undefined} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi tint="bg-amber-500/10 text-amber-600" value={String(kpis.pending)} label="Gözləyən" />
        <Kpi tint="bg-emerald-500/10 text-emerald-600" value={String(kpis.approved)} label="Təsdiqlənmiş" />
        <Kpi tint="bg-primary/10 text-primary" value={String(kpis.days)} label="Təsdiqlənmiş gün" />
      </div>

      <FilterBar
        search={search} onSearch={setSearch} searchPlaceholder="İşçi və ya sorğu №..."
        filters={[
          { key: 'status', placeholder: 'Status', value: status, onChange: setStatus, allLabel: 'Bütün statuslar', options: Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label })) },
          { key: 'type', placeholder: 'Növ', value: type, onChange: setType, allLabel: 'Bütün növlər', options: LEAVE_TYPES.map((t) => ({ value: t.value, label: t.label })) },
        ]}
        right={<ExportButton filename="mezuniyyet" rows={filtered} columns={[
          { header: '№', value: 'requestNumber' }, { header: 'İşçi', value: (r) => r.employeeName ?? '' }, { header: 'Növ', value: (r) => r.typeLabel ?? r.type },
          { header: 'Başlama', value: (r) => formatDate(ms(r.startDate)) }, { header: 'Bitmə', value: (r) => formatDate(ms(r.endDate)) }, { header: 'Gün', value: 'days' }, { header: 'Status', value: 'status' },
        ]} />}
      />

      <Card className="rounded-card">
        {isLoading ? <div className="p-6"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
          : filtered.length === 0 ? <EmptyState title="Sorğu yoxdur" description={requests.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ məzuniyyət sorğusu yoxdur'} />
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>№</TableHead><TableHead>İşçi</TableHead><TableHead>Növ</TableHead><TableHead>Tarix</TableHead><TableHead className="text-right">Gün</TableHead><TableHead>Ödəniş</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = STATUS_META[r.status] ?? STATUS_META.pending;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.requestNumber}</TableCell>
                        <TableCell className="font-medium">{r.employeeName}</TableCell>
                        <TableCell>{r.typeLabel ?? r.type}</TableCell>
                        <TableCell className="text-sm">{formatDate(ms(r.startDate))} – {formatDate(ms(r.endDate))}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{r.days}</TableCell>
                        <TableCell><span className={cn('text-xs', r.paid ? 'text-emerald-600' : 'text-muted-foreground')}>{r.paid ? 'Ödənişli' : 'Ödənişsiz'}</span></TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {r.status === 'pending' && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" disabled={working === r.id} onClick={() => decide(r, 'approved')}><Check className="h-3.5 w-3.5" /> Təsdiq</Button>
                                <Button size="sm" variant="outline" className="text-danger" disabled={working === r.id} onClick={() => decide(r, 'rejected')}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni məzuniyyət sorğusu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>İşçi *</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{employees.filter((e) => e.status !== 'terminated').map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Növ *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Başlama *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Bitmə *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Səbəb</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Ləğv</Button><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Yarat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ tint, value, label }: { tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}><Plane className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
