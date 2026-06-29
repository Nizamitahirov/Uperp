'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pause, Pencil, Play, Plus, Trash2, Workflow as WorkflowIcon, Zap } from 'lucide-react';
import { listDocs } from '@/lib/firebase/firestore';
import { setWorkflowStatus, deleteWorkflow } from '@/lib/firebase/workflows';
import { useAuth } from '@/components/providers/auth-provider';
import type { Workflow } from '@/types';
import { TRIGGER_MAP, ACTION_MAP } from '@/lib/workflow/catalog';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import { WorkflowBuilder } from './workflow-builder';

const STATUS_META: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' }> = {
  active: { label: 'Aktiv', variant: 'success' },
  draft: { label: 'Qaralama', variant: 'secondary' },
  paused: { label: 'Dayandırılıb', variant: 'warning' },
};

export default function WorkflowsPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = can('settings', 'update');

  const { data: workflows = [], isLoading } = useQuery({ queryKey: ['workflows'], queryFn: () => listDocs<Workflow>('workflows', []) });
  const { data: users = [] } = useQuery({
    queryKey: ['users-simple'],
    queryFn: async () => {
      const list = await listDocs<{ id: string; fullName?: string; username?: string; role?: string }>('users', []);
      return list.map((u) => ({ id: u.id, name: u.fullName || u.username || u.id, role: u.role }));
    },
    enabled: canManage,
  });

  async function toggle(w: Workflow) {
    const next = w.status === 'active' ? 'paused' : 'active';
    try {
      await setWorkflowStatus(w.id, next);
      toast.success(next === 'active' ? 'Workflow aktivləşdi' : 'Workflow dayandırıldı');
      qc.invalidateQueries({ queryKey: ['workflows'] });
    } catch { toast.error('Status dəyişmədi'); }
  }
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkflow(deleteTarget.id);
      toast.success('Workflow silindi');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['workflows'] });
    } catch { toast.error('Silinmədi'); } finally { setDeleting(false); }
  }

  return (
    <div>
      <Link href="/settings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Tənzimləmələr</Link>
      <PageHeader
        title="Workflow Management"
        subtitle="Avtomatlaşdırma — trigger, əməliyyat, təsdiq və təyinatlar (Power Automate üslubu)"
        action={canManage && <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}><Plus /> Yeni workflow</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-card" />)}</div>
      ) : workflows.length === 0 ? (
        <Card className="rounded-card">
          <EmptyState
            title="Hələ workflow yoxdur"
            description="Sistemdə baş verən hadisələrə (sifariş, təsdiq, stok və s.) avtomatik reaksiyalar qurun."
            action={canManage ? <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}><Plus /> İlk workflow-u yarat</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {workflows.map((w) => {
            const trig = TRIGGER_MAP.get(w.trigger);
            const meta = STATUS_META[w.status] ?? STATUS_META.draft;
            return (
              <Card key={w.id} className={cn('rounded-card transition-shadow hover:shadow-soft-lg', w.status === 'active' && 'ring-1 ring-primary/20')}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-button bg-primary/10 text-primary"><WorkflowIcon className="h-5 w-5" /></span>
                      <div>
                        <p className="font-semibold leading-tight">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.steps.length} addım · {w.runCount ?? 0} dəfə işləyib</p>
                      </div>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>

                  {w.description && <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>}

                  {/* Mini axın */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-button bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning"><Zap className="h-3 w-3" /> {trig?.label ?? w.trigger}</span>
                    {w.steps.slice(0, 4).map((s) => {
                      const d = ACTION_MAP.get(s.type);
                      if (!d) return null;
                      return <span key={s.id} className="inline-flex items-center gap-1 rounded-button bg-secondary px-2 py-1 text-[11px] font-medium text-foreground"><d.icon className="h-3 w-3" /> {d.label}</span>;
                    })}
                    {w.steps.length > 4 && <span className="text-[11px] text-muted-foreground">+{w.steps.length - 4}</span>}
                  </div>

                  {canManage && (
                    <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                      <Button variant={w.status === 'active' ? 'outline' : 'default'} size="sm" onClick={() => toggle(w)}>
                        {w.status === 'active' ? <><Pause className="h-4 w-4" /> Dayandır</> : <><Play className="h-4 w-4" /> Aktivləşdir</>}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(w); setBuilderOpen(true); }}><Pencil className="h-4 w-4" /> Düzəlt</Button>
                      <Button variant="ghost" size="icon" className="ml-auto text-danger" onClick={() => setDeleteTarget(w)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <WorkflowBuilder open={builderOpen} onOpenChange={setBuilderOpen} initial={editing} users={users} onSaved={() => qc.invalidateQueries({ queryKey: ['workflows'] })} />
      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Workflow sil" description={`"${deleteTarget?.name}" silinsin?`} onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
