'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orderBy } from 'firebase/firestore';
import { Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { createCustomRole, deleteCustomRole } from '@/lib/firebase/roles';
import { useAuth } from '@/components/providers/auth-provider';
import {
  ROLES,
  ALL_ROLE_CODES,
  MODULE_KEYS,
  MODULE_LABELS,
  getPermissions,
  type ModuleKey,
  type PermissionAction,
} from '@/lib/rbac/permissions';
import type { CustomRole } from '@/types';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const ACTION_SHORT: Record<PermissionAction, string> = { create: 'C', read: 'R', update: 'U', delete: 'D', approve: 'A' };
const ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'approve'];

export default function RolesPage() {
  const qc = useQueryClient();
  const { profile, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [level, setLevel] = useState(5);
  const [perms, setPerms] = useState<Record<string, Set<PermissionAction>>>({});

  const canManage = can('roles', 'create');
  const { data: customRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => listDocs<CustomRole>('roles', [orderBy('createdAt', 'desc')]),
  });

  const actor = { uid: profile?.uid ?? '', username: profile?.username ?? '' };

  function toggle(module: ModuleKey, action: PermissionAction) {
    setPerms((prev) => {
      const set = new Set(prev[module] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      return { ...prev, [module]: set };
    });
  }

  async function save() {
    if (!name.trim()) { toast.error('Rol adı daxil edin'); return; }
    const permissions = Object.fromEntries(
      Object.entries(perms).filter(([, s]) => s.size > 0).map(([m, s]) => [m, Array.from(s)]),
    ) as Record<ModuleKey, PermissionAction[]>;
    if (Object.keys(permissions).length === 0) { toast.error('Ən azı bir səlahiyyət seçin'); return; }
    setSubmitting(true);
    try {
      await createCustomRole({ name: name.trim(), level, permissions }, actor);
      toast.success('Custom rol yaradıldı');
      setOpen(false); setName(''); setLevel(5); setPerms({});
      qc.invalidateQueries({ queryKey: ['roles'] });
    } catch { toast.error('Yaradılmadı'); } finally { setSubmitting(false); }
  }

  async function remove(r: CustomRole) {
    if (!confirm(`"${r.name}" rolu silinsin?`)) return;
    await deleteCustomRole(r.id, actor);
    qc.invalidateQueries({ queryKey: ['roles'] });
    toast.success('Rol silindi');
  }

  return (
    <div>
      <PageHeader
        title="Rol İdarəetməsi"
        subtitle="Built-in rollar, custom rollar və CRUD səlahiyyət matrisi"
        action={canManage && <Button onClick={() => setOpen(true)}><Plus /> Custom rol</Button>}
      />

      {/* Built-in rol kartları */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_ROLE_CODES.map((code) => {
          const r = ROLES[code];
          return (
            <Card key={code} className="rounded-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <Badge variant="secondary">Səviyyə {r.level}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{r.description}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">{r.code}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom rollar */}
      {customRoles.length > 0 && (
        <Card className="mb-6 rounded-card">
          <CardHeader><CardTitle className="text-base">Custom rollar</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Ad</TableHead><TableHead>Səviyyə</TableHead><TableHead>Modullar</TableHead>{canManage && <TableHead />}</TableRow></TableHeader>
              <TableBody>
                {customRoles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.level}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{Object.keys(r.permissions ?? {}).length} modul</TableCell>
                    {canManage && <TableCell className="text-right"><Button variant="ghost" size="icon" className="text-danger" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Səlahiyyət matrisi */}
      <Card className="rounded-card">
        <CardHeader>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><CardTitle className="text-base">Səlahiyyət Matrisi</CardTitle></div>
          <p className="text-xs text-muted-foreground">C=Create · R=Read · U=Update · D=Delete · A=Approve · —=Yoxdur</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Modul</TableHead>
                {ALL_ROLE_CODES.map((code) => <TableHead key={code} className="text-center whitespace-nowrap">{ROLES[code].name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULE_KEYS.map((module) => (
                <TableRow key={module}>
                  <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">{MODULE_LABELS[module]}</TableCell>
                  {ALL_ROLE_CODES.map((code) => {
                    const actions = getPermissions(code, module);
                    const text = actions.length === 0 ? '—' : actions.map((a) => ACTION_SHORT[a]).join('');
                    return <TableCell key={code} className={`text-center font-mono text-xs ${actions.length === 0 ? 'text-muted-foreground' : 'font-semibold'}`}>{text}</TableCell>;
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Custom rol yaratma dialoqu */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Yeni custom rol</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Rol adı</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="İstehsalat Nəzarətçisi" /></div>
            <div className="space-y-1.5"><Label>Səviyyə (1-10)</Label><Input type="number" min={1} max={10} value={level} onChange={(e) => setLevel(+e.target.value)} /></div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-card border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modul</TableHead>
                  {ACTIONS.map((a) => <TableHead key={a} className="text-center w-12">{ACTION_SHORT[a]}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {MODULE_KEYS.map((module) => (
                  <TableRow key={module}>
                    <TableCell className="text-sm">{MODULE_LABELS[module]}</TableCell>
                    {ACTIONS.map((a) => (
                      <TableCell key={a} className="text-center">
                        <input type="checkbox" checked={perms[module]?.has(a) ?? false} onChange={() => toggle(module, a)} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Ləğv</Button>
            <Button onClick={save} disabled={submitting}>{submitting && <Loader2 className="animate-spin" />} Yarat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
