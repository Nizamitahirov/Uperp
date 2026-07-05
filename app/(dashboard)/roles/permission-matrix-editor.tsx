'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RotateCcw, Save, ShieldCheck, Lock, Search } from 'lucide-react';
import { fetchRolePermissions, saveRolePermissions } from '@/lib/firebase/roles';
import {
  ROLES, ALL_ROLE_CODES, MODULE_KEYS, MODULE_LABELS,
  getDefaultPermissions, setPermissionOverrides,
  type RoleCode, type ModuleKey, type PermissionAction, type PermissionMatrix,
} from '@/lib/rbac/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const ACTIONS: PermissionAction[] = ['create', 'read', 'update', 'delete', 'approve'];
const ACTION_META: Record<PermissionAction, { label: string; short: string; on: string; off: string }> = {
  create: { label: 'Yarat', short: 'C', on: 'bg-emerald-500 text-white border-emerald-500', off: 'border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600' },
  read: { label: 'Oxu', short: 'R', on: 'bg-sky-500 text-white border-sky-500', off: 'border-border text-muted-foreground hover:border-sky-400 hover:text-sky-600' },
  update: { label: 'Redaktə', short: 'U', on: 'bg-amber-500 text-white border-amber-500', off: 'border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600' },
  delete: { label: 'Sil', short: 'D', on: 'bg-rose-500 text-white border-rose-500', off: 'border-border text-muted-foreground hover:border-rose-400 hover:text-rose-600' },
  approve: { label: 'Təsdiq', short: 'A', on: 'bg-violet-500 text-white border-violet-500', off: 'border-border text-muted-foreground hover:border-violet-400 hover:text-violet-600' },
};

type Matrix = Record<RoleCode, Record<ModuleKey, Set<PermissionAction>>>;

function buildMatrix(overrides: PermissionMatrix | null): Matrix {
  const m = {} as Matrix;
  for (const role of ALL_ROLE_CODES) {
    m[role] = {} as Record<ModuleKey, Set<PermissionAction>>;
    for (const mod of MODULE_KEYS) {
      const o = overrides?.[role]?.[mod];
      m[role][mod] = new Set(o !== undefined ? o : getDefaultPermissions(role, mod));
    }
  }
  return m;
}

export function PermissionMatrixEditor({ canManage, actor }: { canManage: boolean; actor: { uid: string; username: string } }) {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [activeRole, setActiveRole] = useState<RoleCode>('accountant');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['role-permissions'], queryFn: fetchRolePermissions });

  useEffect(() => {
    if (!isLoading) setMatrix(buildMatrix(data ?? null));
  }, [isLoading, data]);

  const locked = activeRole === 'director'; // Direktor tam səlahiyyət — kilidli
  const modules = useMemo(() => {
    const s = search.trim().toLowerCase();
    return MODULE_KEYS.filter((k) => !s || MODULE_LABELS[k].toLowerCase().includes(s) || k.includes(s));
  }, [search]);

  function mutate(fn: (m: Matrix) => void) {
    setMatrix((prev) => {
      if (!prev) return prev;
      const next = buildMatrix(null); // struktur
      for (const role of ALL_ROLE_CODES) for (const mod of MODULE_KEYS) next[role][mod] = new Set(prev[role][mod]);
      fn(next);
      return next;
    });
    setDirty(true);
  }

  function toggle(mod: ModuleKey, action: PermissionAction) {
    if (locked || !canManage) return;
    mutate((m) => {
      const set = m[activeRole][mod];
      if (set.has(action)) set.delete(action);
      else set.add(action);
    });
  }
  function setRow(mod: ModuleKey, actions: PermissionAction[]) {
    if (locked || !canManage) return;
    mutate((m) => { m[activeRole][mod] = new Set(actions); });
  }
  function resetRole() {
    if (locked || !canManage) return;
    mutate((m) => { for (const mod of MODULE_KEYS) m[activeRole][mod] = new Set(getDefaultPermissions(activeRole, mod)); });
  }

  async function save() {
    if (!matrix) return;
    setSaving(true);
    try {
      const out: PermissionMatrix = {};
      for (const role of ALL_ROLE_CODES) {
        out[role] = {};
        for (const mod of MODULE_KEYS) out[role]![mod] = ACTIONS.filter((a) => matrix[role][mod].has(a));
      }
      await saveRolePermissions(out, actor);
      setPermissionOverrides(out); // cari sessiyaya dərhal tətbiq et
      setDirty(false);
      toast.success('Səlahiyyət matrisi yadda saxlanıldı');
    } catch (e) {
      toast.error('Yadda saxlanmadı', e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  const roleModuleCount = (role: RoleCode) => (matrix ? MODULE_KEYS.filter((k) => matrix[role][k].size > 0).length : 0);

  return (
    <Card className="rounded-card">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <CardTitle className="text-base">Səlahiyyət Matrisi</CardTitle>
              <p className="text-xs text-muted-foreground">Rol seçin və modul üzrə səlahiyyətləri tənzimləyin</p>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              {dirty && <Badge variant="warning">Yadda saxlanmayıb</Badge>}
              <Button variant="outline" size="sm" onClick={resetRole} disabled={locked || saving}><RotateCcw className="h-4 w-4" /> Defolt</Button>
              <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button>
            </div>
          )}
        </div>

        {/* Rol seçici */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_ROLE_CODES.map((code) => (
            <button
              key={code}
              onClick={() => setActiveRole(code)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                activeRole === code ? 'border-primary bg-primary text-primary-foreground shadow-soft' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {code === 'director' && <Lock className="h-3 w-3" />}
              {ROLES[code].name}
              <span className={cn('rounded-full px-1.5 text-[10px]', activeRole === code ? 'bg-white/20' : 'bg-secondary')}>{roleModuleCount(code)}</span>
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Leqenda + axtarış */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
            {ACTIONS.map((a) => (
              <span key={a} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn('flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white', ACTION_META[a].on.split(' ')[0])}>{ACTION_META[a].short}</span>
                {ACTION_META[a].label}
              </span>
            ))}
          </div>
          <div className="relative w-full sm:max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-8 text-sm" placeholder="Modul axtar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {locked && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <Lock className="h-3.5 w-3.5" /> Direktor rolu tam səlahiyyətə malikdir və dəyişdirilə bilməz.
          </div>
        )}

        {isLoading || !matrix ? (
          <div className="space-y-2 py-6"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="divide-y divide-border/70 rounded-xl border border-border">
            {modules.map((mod) => {
              const set = matrix[activeRole][mod];
              return (
                <div key={mod} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{MODULE_LABELS[mod]}</span>
                    {set.size === 0 && <span className="shrink-0 text-[10px] text-muted-foreground">giriş yoxdur</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ACTIONS.map((a) => {
                      const on = set.has(a);
                      return (
                        <button
                          key={a}
                          onClick={() => toggle(mod, a)}
                          disabled={locked || !canManage}
                          title={ACTION_META[a].label}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                            on ? ACTION_META[a].on : ACTION_META[a].off,
                          )}
                        >
                          {ACTION_META[a].short}
                        </button>
                      );
                    })}
                    <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
                    <button onClick={() => setRow(mod, [])} disabled={locked || !canManage} className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50">Heç nə</button>
                    <button onClick={() => setRow(mod, ['read'])} disabled={locked || !canManage} className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50">Oxu</button>
                    <button onClick={() => setRow(mod, ['create', 'read', 'update', 'delete'])} disabled={locked || !canManage} className="rounded-md px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50">Tam</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Dəyişikliklər tətbiq daxili giriş nəzarətinə dərhal tətbiq olunur. Server tərəfli Firestore qaydaları ayrıca saxlanılır (baza təhlükəsizliyi).
        </p>
      </CardContent>
    </Card>
  );
}
