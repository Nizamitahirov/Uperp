'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, ClipboardList, ExternalLink, Loader2, Stamp, X } from 'lucide-react';
import { listApprovals, listTasks, decideApproval, cancelApproval, completeTask, isMine, type ApprovalRequest, type WorkflowTask } from '@/lib/firebase/approvals';
import { useAuth } from '@/components/providers/auth-provider';
import { ROLES } from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { profile, firebaseUser, role } = useAuth();
  const uid = firebaseUser?.uid;
  const actor = { uid: uid ?? '', username: profile?.username ?? '' };
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const { data: approvals = [], isLoading: la } = useQuery({ queryKey: ['approvals'], queryFn: listApprovals });
  const { data: tasks = [], isLoading: lt } = useQuery({ queryKey: ['tasks'], queryFn: listTasks });

  const myApprovals = useMemo(
    () => approvals.filter((a) => a.status === 'pending' && (showAll || isMine(a, uid, role))),
    [approvals, uid, role, showAll],
  );
  const myTasks = useMemo(
    () => tasks.filter((t) => t.status === 'open' && (showAll || isMine(t, uid, role))),
    [tasks, uid, role, showAll],
  );
  const historyApprovals = useMemo(() => approvals.filter((a) => a.status !== 'pending').slice(0, 30), [approvals]);

  async function decide(a: ApprovalRequest, status: 'approved' | 'rejected') {
    setBusy(a.id);
    try {
      await decideApproval(a.id, status, actor);
      toast.success(status === 'approved' ? 'Təsdiq edildi' : 'Rədd edildi');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    } catch { toast.error('Alınmadı'); } finally { setBusy(null); }
  }
  async function cancel(a: ApprovalRequest) {
    setBusy(a.id);
    try {
      await cancelApproval(a.id, actor);
      toast.success('Təsdiq tələbi ləğv edildi');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    } catch { toast.error('Alınmadı'); } finally { setBusy(null); }
  }
  async function done(t: WorkflowTask) {
    setBusy(t.id);
    try {
      await completeTask(t.id);
      toast.success('Tapşırıq tamamlandı');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch { toast.error('Alınmadı'); } finally { setBusy(null); }
  }

  const roleName = (r?: string | null) => (r ? ROLES[r as keyof typeof ROLES]?.name ?? r : '');

  return (
    <div>
      <PageHeader
        title="Təsdiqlər və Tapşırıqlar"
        subtitle="Workflow avtomatlaşdırmasından gələn təsdiq tələbləri və tapşırıqlar"
        action={
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Yalnız mənimkilər' : 'Hamısını göstər'}
          </Button>
        }
      />

      <Tabs defaultValue="approvals">
        <TabsList>
          <TabsTrigger value="approvals">Təsdiqlər {myApprovals.length > 0 && <Badge variant="destructive" className="ml-1.5">{myApprovals.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="tasks">Tapşırıqlar {myTasks.length > 0 && <Badge variant="secondary" className="ml-1.5">{myTasks.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="history">Tarixçə</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals">
          {la ? <Skel /> : myApprovals.length === 0 ? (
            <Card className="rounded-card"><EmptyState title="Gözləyən təsdiq yoxdur" description="Sizə yönəlmiş təsdiq tələbləri burada görünəcək." /></Card>
          ) : (
            <div className="space-y-3">
              {myApprovals.map((a) => (
                <Card key={a.id} className="rounded-card">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-primary/10 text-primary"><Stamp className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{a.entityLabel}</p>
                        <Badge variant="outline">{a.workflowName}</Badge>
                        {a.level > 1 && <Badge variant="secondary">Səviyyə {a.level}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.message || 'Təsdiq tələb olunur'}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Təyinat: {a.assigneeType === 'user' ? a.assigneeUserName : roleName(a.assigneeRole)}
                        {a.requestedBy?.username ? ` · ${a.requestedBy.username} tərəfindən` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.actionUrl && a.actionUrl !== '/approvals' && <Button variant="ghost" size="icon" asChild><Link href={a.actionUrl}><ExternalLink className="h-4 w-4" /></Link></Button>}
                      {(role === 'director' || a.requestedBy?.uid === uid) && <Button variant="ghost" size="sm" onClick={() => cancel(a)} disabled={busy === a.id}>Ləğv et</Button>}
                      <Button variant="outline" size="sm" className="text-danger" onClick={() => decide(a, 'rejected')} disabled={busy === a.id}><X className="h-4 w-4" /> Rədd et</Button>
                      <Button size="sm" onClick={() => decide(a, 'approved')} disabled={busy === a.id}>{busy === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Təsdiqlə</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          {lt ? <Skel /> : myTasks.length === 0 ? (
            <Card className="rounded-card"><EmptyState title="Açıq tapşırıq yoxdur" description="Sizə təyin olunmuş tapşırıqlar burada görünəcək." /></Card>
          ) : (
            <div className="space-y-3">
              {myTasks.map((t) => (
                <Card key={t.id} className="rounded-card">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-success/10 text-success"><ClipboardList className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.entityLabel} · {t.workflowName} · {t.assigneeType === 'user' ? t.assigneeUserName : roleName(t.assigneeRole)}</p>
                    </div>
                    {t.actionUrl && t.actionUrl !== '/approvals' && <Button variant="ghost" size="icon" asChild><Link href={t.actionUrl}><ExternalLink className="h-4 w-4" /></Link></Button>}
                    <Button size="sm" onClick={() => done(t)} disabled={busy === t.id}>{busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Tamamla</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {historyApprovals.length === 0 ? (
            <Card className="rounded-card"><EmptyState title="Tarixçə boşdur" /></Card>
          ) : (
            <div className="space-y-2">
              {historyApprovals.map((a) => (
                <Card key={a.id} className="rounded-card">
                  <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{a.entityLabel}</p><p className="text-xs text-muted-foreground">{a.workflowName} · {a.decidedBy?.username ?? ''}</p></div>
                    <Badge variant={a.status === 'approved' ? 'success' : a.status === 'cancelled' ? 'secondary' : 'destructive'}>{a.status === 'approved' ? 'Təsdiqlənib' : a.status === 'cancelled' ? 'Ləğv edilib' : 'Rədd edilib'}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Skel() {
  return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-card" />)}</div>;
}
