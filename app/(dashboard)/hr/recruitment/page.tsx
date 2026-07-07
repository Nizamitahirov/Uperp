'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Briefcase, Plus, Loader2, UserPlus, ChevronRight, X } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import {
  createOpening, setOpeningStatus, createCandidate, moveCandidate, hireCandidate,
  OPENING_STATUS_LABELS, CANDIDATE_STAGES, CANDIDATE_STAGE_MAP,
} from '@/lib/firebase/recruitment';
import { useAuth } from '@/components/providers/auth-provider';
import type { Candidate, CandidateStage, Department, JobOpening, Position } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
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

const OPENING_VARIANT: Record<JobOpening['status'], 'success' | 'warning' | 'secondary'> = { open: 'success', on_hold: 'warning', closed: 'secondary' };
const STAGE_TINT: Record<CandidateStage, string> = {
  applied: 'bg-slate-500/10 text-slate-600', screening: 'bg-sky-500/10 text-sky-600', interview: 'bg-amber-500/10 text-amber-600',
  offer: 'bg-violet-500/10 text-violet-600', hired: 'bg-emerald-500/10 text-emerald-600', rejected: 'bg-rose-500/10 text-rose-600',
};
const c = (n: number) => formatCurrency(n, 'AZN');
const CONTRACT_TYPES = [['permanent', 'Daimi'], ['fixed_term', 'Müddətli'], ['part_time', 'Yarımştat'], ['intern', 'Təcrübəçi']] as const;

export default function RecruitmentPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'update');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const [openingFilter, setOpeningFilter] = useState(ALL);
  const [stageFilter, setStageFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');

  const [openOpen, setOpenOpen] = useState(false);
  const [oForm, setOForm] = useState({ title: '', departmentId: '', headcount: '1', description: '' });
  const [candOpen, setCandOpen] = useState(false);
  const [cForm, setCForm] = useState({ openingId: '', fullName: '', email: '', phone: '', expectedSalary: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const [hireFor, setHireFor] = useState<Candidate | null>(null);
  const [hForm, setHForm] = useState({ firstName: '', lastName: '', hireDate: new Date().toISOString().slice(0, 10), contractType: 'permanent', payType: 'monthly', baseSalary: '', positionId: '', annualLeaveEntitlement: '21' });
  const [hiring, setHiring] = useState(false);

  const { data: openings = [], isLoading } = useQuery({ queryKey: ['job_openings'], queryFn: () => listDocs<JobOpening>('job_openings', [orderBy('createdAt', 'desc')]) });
  const { data: candidates = [] } = useQuery({ queryKey: ['candidates'], queryFn: () => listDocs<Candidate>('candidates', [orderBy('createdAt', 'desc')]) });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => listDocs<Department>('departments') });
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => listDocs<Position>('positions') });

  const kpis = useMemo(() => ({
    open: openings.filter((o) => o.status === 'open').length,
    active: candidates.filter((c) => c.stage !== 'hired' && c.stage !== 'rejected').length,
    hired: candidates.filter((c) => c.stage === 'hired').length,
  }), [openings, candidates]);

  const filteredCandidates = useMemo(() => {
    const s = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (openingFilter !== ALL && c.openingId !== openingFilter) return false;
      if (stageFilter !== ALL && c.stage !== stageFilter) return false;
      if (s && !(c.fullName.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [candidates, openingFilter, stageFilter, search]);

  async function submitOpening() {
    if (!oForm.title.trim()) { toast.error('Vəzifə adı tələb olunur'); return; }
    const dep = departments.find((d) => d.id === oForm.departmentId);
    setSaving(true);
    try {
      await createOpening({ title: oForm.title, departmentId: oForm.departmentId || undefined, departmentName: dep?.name, headcount: Math.max(1, +oForm.headcount || 1), description: oForm.description || undefined }, actor);
      toast.success('Vakansiya yaradıldı'); setOpenOpen(false); setOForm({ title: '', departmentId: '', headcount: '1', description: '' });
      qc.invalidateQueries({ queryKey: ['job_openings'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  async function submitCandidate() {
    if (!cForm.openingId || !cForm.fullName.trim()) { toast.error('Vakansiya və ad tələb olunur'); return; }
    const op = openings.find((o) => o.id === cForm.openingId);
    setSaving(true);
    try {
      await createCandidate({ openingId: cForm.openingId, openingTitle: op?.title, fullName: cForm.fullName, email: cForm.email || undefined, phone: cForm.phone || undefined, expectedSalary: cForm.expectedSalary ? +cForm.expectedSalary : undefined, notes: cForm.notes || undefined }, actor);
      toast.success('Namizəd əlavə edildi'); setCandOpen(false); setCForm({ openingId: '', fullName: '', email: '', phone: '', expectedSalary: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['candidates'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  async function move(cand: Candidate, stage: CandidateStage) {
    if (stage === 'hired') { openHire(cand); return; }
    setBusy(cand.id);
    try { await moveCandidate(cand, stage, actor, stage === 'rejected' ? 'Uyğun deyil' : undefined); qc.invalidateQueries({ queryKey: ['candidates'] }); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setBusy(''); }
  }

  function openHire(cand: Candidate) {
    const parts = cand.fullName.trim().split(/\s+/);
    setHireFor(cand);
    setHForm({ firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), hireDate: new Date().toISOString().slice(0, 10), contractType: 'permanent', payType: 'monthly', baseSalary: cand.expectedSalary ? String(cand.expectedSalary) : '', positionId: '', annualLeaveEntitlement: '21' });
  }
  async function confirmHire() {
    if (!hireFor || !hForm.firstName.trim() || !hForm.baseSalary) { toast.error('Ad və maaş tələb olunur'); return; }
    const op = openings.find((o) => o.id === hireFor.openingId);
    const pos = positions.find((p) => p.id === hForm.positionId);
    setHiring(true);
    try {
      await hireCandidate(hireFor, op, {
        firstName: hForm.firstName, lastName: hForm.lastName, hireDate: hForm.hireDate,
        contractType: hForm.contractType as 'permanent' | 'fixed_term' | 'part_time' | 'intern',
        payType: hForm.payType as 'monthly' | 'daily' | 'hourly' | 'piece_rate', baseSalary: +hForm.baseSalary,
        positionId: hForm.positionId || null, positionTitle: pos?.title,
        annualLeaveEntitlement: +hForm.annualLeaveEntitlement || 0,
      }, actor);
      toast.success('Namizəd işçi kartına çevrildi'); setHireFor(null);
      qc.invalidateQueries({ queryKey: ['candidates'] }); qc.invalidateQueries({ queryKey: ['job_openings'] }); qc.invalidateQueries({ queryKey: ['employees'] });
    } catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setHiring(false); }
  }

  const nextStage: Partial<Record<CandidateStage, CandidateStage>> = { applied: 'screening', screening: 'interview', interview: 'offer', offer: 'hired' };

  return (
    <div>
      <PageHeader title="İşə qəbul" subtitle="Vakansiyalar və namizəd pipeline-ı" action={canManage ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCandOpen(true)}><UserPlus className="h-4 w-4" /> Namizəd</Button>
          <Button onClick={() => setOpenOpen(true)}><Plus /> Vakansiya</Button>
        </div>
      ) : undefined} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi tint="bg-emerald-500/10 text-emerald-600" value={String(kpis.open)} label="Açıq vakansiya" />
        <Kpi tint="bg-sky-500/10 text-sky-600" value={String(kpis.active)} label="Aktiv namizəd" />
        <Kpi tint="bg-primary/10 text-primary" value={String(kpis.hired)} label="İşə götürülüb" />
      </div>

      {/* Vakansiyalar */}
      <Card className="rounded-card mb-6">
        <div className="border-b border-border p-4"><p className="font-semibold">Vakansiyalar</p></div>
        {isLoading ? <div className="p-6"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
          : openings.length === 0 ? <EmptyState title="Vakansiya yoxdur" description="İşə qəbula başlamaq üçün vakansiya açın" />
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>№</TableHead><TableHead>Vəzifə</TableHead><TableHead>Şöbə</TableHead><TableHead className="text-right">Açıq yer</TableHead><TableHead>Namizəd</TableHead><TableHead>Status</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {openings.map((o) => {
                    const cnt = candidates.filter((c) => c.openingId === o.id).length;
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.number}</TableCell>
                        <TableCell className="font-medium">{o.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.departmentName ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{o.headcount}</TableCell>
                        <TableCell className="tabular-nums">{cnt}</TableCell>
                        <TableCell><Badge variant={OPENING_VARIANT[o.status]}>{OPENING_STATUS_LABELS[o.status]}</Badge></TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Select value={o.status} onValueChange={async (v) => { setBusy(o.id); try { await setOpeningStatus(o.id, v as JobOpening['status'], actor); qc.invalidateQueries({ queryKey: ['job_openings'] }); } finally { setBusy(''); } }}>
                              <SelectTrigger className="h-8 w-32" disabled={busy === o.id}><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(OPENING_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                            </Select>
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

      {/* Namizədlər */}
      <FilterBar
        search={search} onSearch={setSearch} searchPlaceholder="Namizəd adı və ya e-poçt..."
        filters={[
          { key: 'opening', placeholder: 'Vakansiya', value: openingFilter, onChange: setOpeningFilter, allLabel: 'Bütün vakansiyalar', options: openings.map((o) => ({ value: o.id, label: o.title })) },
          { key: 'stage', placeholder: 'Mərhələ', value: stageFilter, onChange: setStageFilter, allLabel: 'Bütün mərhələlər', options: CANDIDATE_STAGES.map((s) => ({ value: s.value, label: s.label })) },
        ]}
      />

      <Card className="rounded-card">
        {filteredCandidates.length === 0 ? <EmptyState title="Namizəd yoxdur" description={candidates.length ? 'Filtrə uyğun nəticə yoxdur' : 'Hələ namizəd əlavə edilməyib'} />
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Namizəd</TableHead><TableHead>Vakansiya</TableHead><TableHead>Əlaqə</TableHead><TableHead className="text-right">Gözlənilən maaş</TableHead><TableHead>Mərhələ</TableHead>{canManage && <TableHead className="text-right">Əməliyyat</TableHead>}</TableRow></TableHeader>
                <TableBody>
                  {filteredCandidates.map((cand) => {
                    const next = nextStage[cand.stage];
                    const done = cand.stage === 'hired' || cand.stage === 'rejected';
                    return (
                      <TableRow key={cand.id}>
                        <TableCell className="font-medium">{cand.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{cand.openingTitle ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{cand.email ?? cand.phone ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{cand.expectedSalary ? c(cand.expectedSalary) : '—'}</TableCell>
                        <TableCell><span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STAGE_TINT[cand.stage])}>{CANDIDATE_STAGE_MAP.get(cand.stage)}</span></TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {!done && (
                              <div className="flex justify-end gap-1">
                                {next && next !== 'hired' && <Button size="sm" variant="outline" disabled={busy === cand.id} onClick={() => move(cand, next)}>{CANDIDATE_STAGE_MAP.get(next)} <ChevronRight className="h-3.5 w-3.5" /></Button>}
                                {(cand.stage === 'offer' || cand.stage === 'interview') && <Button size="sm" disabled={busy === cand.id} onClick={() => openHire(cand)}><UserPlus className="h-3.5 w-3.5" /> İşə götür</Button>}
                                <Button size="sm" variant="outline" className="text-danger" disabled={busy === cand.id} onClick={() => move(cand, 'rejected')}><X className="h-3.5 w-3.5" /></Button>
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

      {/* Vakansiya dialoqu */}
      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni vakansiya</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Vəzifə adı *</Label><Input value={oForm.title} onChange={(e) => setOForm({ ...oForm, title: e.target.value })} placeholder="məs. Tikişçi" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Şöbə</Label>
                <Select value={oForm.departmentId} onValueChange={(v) => setOForm({ ...oForm, departmentId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Açıq yer</Label><Input type="number" min="1" value={oForm.headcount} onChange={(e) => setOForm({ ...oForm, headcount: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Təsvir</Label><Input value={oForm.description} onChange={(e) => setOForm({ ...oForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpenOpen(false)}>Ləğv</Button><Button onClick={submitOpening} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Yarat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Namizəd dialoqu */}
      <Dialog open={candOpen} onOpenChange={setCandOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Yeni namizəd</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Vakansiya *</Label>
              <Select value={cForm.openingId} onValueChange={(v) => setCForm({ ...cForm, openingId: v })}>
                <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{openings.filter((o) => o.status === 'open').map((o) => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Ad Soyad *</Label><Input value={cForm.fullName} onChange={(e) => setCForm({ ...cForm, fullName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>E-poçt</Label><Input type="email" value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Telefon</Label><Input value={cForm.phone} onChange={(e) => setCForm({ ...cForm, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Gözlənilən maaş (₼)</Label><Input type="number" step="any" value={cForm.expectedSalary} onChange={(e) => setCForm({ ...cForm, expectedSalary: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Qeyd</Label><Input value={cForm.notes} onChange={(e) => setCForm({ ...cForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCandOpen(false)}>Ləğv</Button><Button onClick={submitCandidate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Əlavə et</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İşə götürmə dialoqu */}
      <Dialog open={!!hireFor} onOpenChange={(v) => !v && setHireFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>İşçi kartına çevir</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{hireFor?.fullName} — {hireFor?.openingTitle}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Ad *</Label><Input value={hForm.firstName} onChange={(e) => setHForm({ ...hForm, firstName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Soyad</Label><Input value={hForm.lastName} onChange={(e) => setHForm({ ...hForm, lastName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>İşə başlama *</Label><Input type="date" value={hForm.hireDate} onChange={(e) => setHForm({ ...hForm, hireDate: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Müqavilə</Label>
              <Select value={hForm.contractType} onValueChange={(v) => setHForm({ ...hForm, contractType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTRACT_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Vəzifə</Label>
              <Select value={hForm.positionId} onValueChange={(v) => setHForm({ ...hForm, positionId: v })}>
                <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Ödəniş tipi</Label>
              <Select value={hForm.payType} onValueChange={(v) => setHForm({ ...hForm, payType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Aylıq</SelectItem><SelectItem value="daily">Günlük</SelectItem><SelectItem value="hourly">Saatlıq</SelectItem><SelectItem value="piece_rate">Ədədi</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Maaş / dərəcə (₼) *</Label><Input type="number" step="any" value={hForm.baseSalary} onChange={(e) => setHForm({ ...hForm, baseSalary: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>İllik məzuniyyət (gün)</Label><Input type="number" value={hForm.annualLeaveEntitlement} onChange={(e) => setHForm({ ...hForm, annualLeaveEntitlement: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setHireFor(null)}>Ləğv</Button><Button onClick={confirmHire} disabled={hiring}>{hiring && <Loader2 className="h-4 w-4 animate-spin" />} İşçi yarat</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ tint, value, label }: { tint: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tint)}><Briefcase className="h-5 w-5" /></span>
      <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
