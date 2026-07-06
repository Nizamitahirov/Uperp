'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Building2, Plus, Pencil, Trash2, Loader2, Briefcase } from 'lucide-react';
import { listDocs, createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore';
import { useAuth } from '@/components/providers/auth-provider';
import type { Department, Position } from '@/types';
import { formatCurrency } from '@/lib/utils/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

export default function OrgPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const canManage = can('hr', 'create');
  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  const { data: departments = [], isLoading: loadDep } = useQuery({ queryKey: ['departments'], queryFn: () => listDocs<Department>('departments', [orderBy('name')]) });
  const { data: positions = [], isLoading: loadPos } = useQuery({ queryKey: ['positions'], queryFn: () => listDocs<Position>('positions', [orderBy('title')]) });

  // Department dialog
  const [depOpen, setDepOpen] = useState(false);
  const [depEdit, setDepEdit] = useState<Department | null>(null);
  const [dep, setDep] = useState({ code: '', name: '', parentId: '' });
  const [depDel, setDepDel] = useState<Department | null>(null);

  // Position dialog
  const [posOpen, setPosOpen] = useState(false);
  const [posEdit, setPosEdit] = useState<Position | null>(null);
  const [pos, setPos] = useState({ title: '', departmentId: '', level: 1, baseSalaryMin: 0, baseSalaryMax: 0 });
  const [posDel, setPosDel] = useState<Position | null>(null);
  const [saving, setSaving] = useState(false);

  function openDep(d?: Department) {
    if (d) { setDepEdit(d); setDep({ code: d.code, name: d.name, parentId: d.parentId ?? '' }); }
    else { setDepEdit(null); setDep({ code: '', name: '', parentId: '' }); }
    setDepOpen(true);
  }
  async function saveDep() {
    if (!dep.name.trim()) { toast.error('Ad daxil edin'); return; }
    setSaving(true);
    try {
      const payload = { code: dep.code || dep.name.slice(0, 3).toUpperCase(), name: dep.name, parentId: dep.parentId || null };
      if (depEdit) await updateDocById('departments', depEdit.id, payload);
      else await createDoc('departments', payload);
      toast.success('Yadda saxlanıldı'); setDepOpen(false); qc.invalidateQueries({ queryKey: ['departments'] });
    } catch { toast.error('Alınmadı'); } finally { setSaving(false); }
  }
  async function delDep() { if (!depDel) return; setSaving(true); try { await deleteDocById('departments', depDel.id); toast.success('Silindi'); setDepDel(null); qc.invalidateQueries({ queryKey: ['departments'] }); } catch { toast.error('Silinmədi'); } finally { setSaving(false); } }

  function openPos(p?: Position) {
    if (p) { setPosEdit(p); setPos({ title: p.title, departmentId: p.departmentId ?? '', level: p.level ?? 1, baseSalaryMin: p.baseSalaryMin ?? 0, baseSalaryMax: p.baseSalaryMax ?? 0 }); }
    else { setPosEdit(null); setPos({ title: '', departmentId: '', level: 1, baseSalaryMin: 0, baseSalaryMax: 0 }); }
    setPosOpen(true);
  }
  async function savePos() {
    if (!pos.title.trim()) { toast.error('Vəzifə adı daxil edin'); return; }
    setSaving(true);
    try {
      const depName = departments.find((d) => d.id === pos.departmentId)?.name ?? null;
      const payload = { ...pos, departmentId: pos.departmentId || null, departmentName: depName };
      if (posEdit) await updateDocById('positions', posEdit.id, payload);
      else await createDoc('positions', payload);
      toast.success('Yadda saxlanıldı'); setPosOpen(false); qc.invalidateQueries({ queryKey: ['positions'] });
    } catch { toast.error('Alınmadı'); } finally { setSaving(false); }
  }
  async function delPos() { if (!posDel) return; setSaving(true); try { await deleteDocById('positions', posDel.id); toast.success('Silindi'); setPosDel(null); qc.invalidateQueries({ queryKey: ['positions'] }); } catch { toast.error('Silinmədi'); } finally { setSaving(false); } }

  return (
    <div>
      <PageHeader title="Təşkilati struktur" subtitle="Departamentlər və vəzifələr" />

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments"><Building2 className="mr-1.5 h-4 w-4" /> Departamentlər</TabsTrigger>
          <TabsTrigger value="positions"><Briefcase className="mr-1.5 h-4 w-4" /> Vəzifələr</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          {canManage && <div className="mb-3 flex justify-end"><Button onClick={() => openDep()}><Plus /> Yeni departament</Button></div>}
          <Card className="rounded-card">
            {loadDep ? <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
              : departments.length === 0 ? <EmptyState title="Departament yoxdur" description="İlk departamenti əlavə edin" action={canManage ? <Button onClick={() => openDep()}><Plus /> Yeni</Button> : undefined} />
              : (
                <Table>
                  <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Ana departament</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
                  <TableBody>
                    {departments.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.code}</TableCell>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="text-muted-foreground">{departments.find((x) => x.id === d.parentId)?.name ?? '—'}</TableCell>
                        {canManage && <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openDep(d)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => setDepDel(d)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </Card>
        </TabsContent>

        <TabsContent value="positions">
          {canManage && <div className="mb-3 flex justify-end"><Button onClick={() => openPos()}><Plus /> Yeni vəzifə</Button></div>}
          <Card className="rounded-card">
            {loadPos ? <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
              : positions.length === 0 ? <EmptyState title="Vəzifə yoxdur" description="İlk vəzifəni əlavə edin" action={canManage ? <Button onClick={() => openPos()}><Plus /> Yeni</Button> : undefined} />
              : (
                <Table>
                  <TableHeader><TableRow><TableHead>Vəzifə</TableHead><TableHead>Departament</TableHead><TableHead className="text-right">Səviyyə</TableHead><TableHead className="text-right">Maaş aralığı</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
                  <TableBody>
                    {positions.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell className="text-muted-foreground">{p.departmentName ?? '—'}</TableCell>
                        <TableCell className="text-right">{p.level ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{p.baseSalaryMin || p.baseSalaryMax ? `${formatCurrency(p.baseSalaryMin ?? 0, 'AZN')} – ${formatCurrency(p.baseSalaryMax ?? 0, 'AZN')}` : '—'}</TableCell>
                        {canManage && <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openPos(p)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-danger" onClick={() => setPosDel(p)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department dialog */}
      <Dialog open={depOpen} onOpenChange={setDepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{depEdit ? 'Departamenti düzəlt' : 'Yeni departament'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Kod</Label><Input value={dep.code} onChange={(e) => setDep({ ...dep, code: e.target.value })} placeholder="PRD" /></div>
              <div className="col-span-2 space-y-1.5"><Label>Ad *</Label><Input value={dep.name} onChange={(e) => setDep({ ...dep, name: e.target.value })} placeholder="İstehsalat" /></div>
            </div>
            <div className="space-y-1.5"><Label>Ana departament</Label>
              <Select value={dep.parentId || '__none'} onValueChange={(v) => setDep({ ...dep, parentId: v === '__none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Yoxdur" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">— yoxdur —</SelectItem>{departments.filter((d) => d.id !== depEdit?.id).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDepOpen(false)}>Ləğv</Button><Button onClick={saveDep} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position dialog */}
      <Dialog open={posOpen} onOpenChange={setPosOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{posEdit ? 'Vəzifəni düzəlt' : 'Yeni vəzifə'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Vəzifə adı *</Label><Input value={pos.title} onChange={(e) => setPos({ ...pos, title: e.target.value })} placeholder="Tikişçi" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Departament</Label>
                <Select value={pos.departmentId || '__none'} onValueChange={(v) => setPos({ ...pos, departmentId: v === '__none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Yoxdur" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">— yoxdur —</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Səviyyə</Label><Input type="number" min={1} value={pos.level} onChange={(e) => setPos({ ...pos, level: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Min maaş (₼)</Label><Input type="number" step="any" value={pos.baseSalaryMin} onChange={(e) => setPos({ ...pos, baseSalaryMin: +e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Maks maaş (₼)</Label><Input type="number" step="any" value={pos.baseSalaryMax} onChange={(e) => setPos({ ...pos, baseSalaryMax: +e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPosOpen(false)}>Ləğv</Button><Button onClick={savePos} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Yadda saxla</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!depDel} onOpenChange={(o) => !o && setDepDel(null)} title="Departamenti sil" description={`"${depDel?.name}" silinsin?`} onConfirm={delDep} loading={saving} />
      <ConfirmDialog open={!!posDel} onOpenChange={(o) => !o && setPosDel(null)} title="Vəzifəni sil" description={`"${posDel?.title}" silinsin?`} onConfirm={delPos} loading={saving} />
    </div>
  );
}
