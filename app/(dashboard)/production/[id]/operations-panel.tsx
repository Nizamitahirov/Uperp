'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Scissors, Play, Check, RotateCcw, Loader2, Factory, User } from 'lucide-react';
import { fetchOperations, initOperations, updateOperation, OPERATION_STAGES, STAGE_LABEL } from '@/lib/firebase/operations';
import type { OperationStage, ProductionOperation, ProductionOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';

const STATUS_META: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  pending: { label: 'Gözləyir', variant: 'secondary' },
  in_progress: { label: 'İcrada', variant: 'warning' },
  done: { label: 'Bitdi', variant: 'success' },
};

export function OperationsPanel({ order, canRun, actor }: { order: ProductionOrder; canRun: boolean; actor: { uid: string; username: string } }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState('');
  const [local, setLocal] = useState<Record<string, { completedQty: string; operator: string }>>({});

  const { data: ops, isLoading } = useQuery({
    queryKey: ['production_operations', order.id],
    queryFn: () => fetchOperations(order.id),
  });

  useEffect(() => {
    if (ops) {
      const m: Record<string, { completedQty: string; operator: string }> = {};
      for (const op of ops.operations) m[op.stage] = { completedQty: String(op.completedQty ?? 0), operator: op.operator ?? '' };
      setLocal(m);
    }
  }, [ops]);

  function invalidate() { qc.invalidateQueries({ queryKey: ['production_operations', order.id] }); }

  async function init() {
    setBusy('init');
    try { await initOperations(order, actor); toast.success('Mərhələlər yaradıldı'); invalidate(); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); } finally { setBusy(''); }
  }

  async function apply(stage: OperationStage, patch: Partial<ProductionOperation>) {
    if (!ops) return;
    setBusy(stage);
    try {
      const l = local[stage];
      const merged: Partial<ProductionOperation> = {
        completedQty: l ? Number(l.completedQty) || 0 : undefined,
        operator: l ? l.operator : undefined,
        ...patch,
      };
      await updateOperation(ops, stage, merged, actor);
      invalidate();
    } catch (e) { toast.error('Yenilənmədi', e instanceof Error ? e.message : undefined); } finally { setBusy(''); }
  }

  if (isLoading) return null;

  if (!ops) {
    return (
      <Card className="rounded-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4 text-primary" /> İstehsal mərhələləri (shop-floor)</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">Kəsim → Tikiş → Yuma → Ütü → QC → Paketləmə mərhələlərini izləyin.</p>
          {canRun && <Button onClick={init} disabled={busy === 'init'}>{busy === 'init' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />} Mərhələləri başlat</Button>}
        </CardContent>
      </Card>
    );
  }

  const doneCount = ops.operations.filter((o) => o.status === 'done').length;
  const pct = Math.round((doneCount / ops.operations.length) * 100);

  return (
    <Card className="rounded-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4 text-primary" /> İstehsal mərhələləri</CardTitle>
          <span className="text-sm font-semibold text-primary">{doneCount}/{ops.operations.length} · {pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-to-r from-[#5B5BF5] to-[#8b3df0] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {OPERATION_STAGES.map(({ stage }, idx) => {
          const op = ops.operations.find((o) => o.stage === stage);
          if (!op) return null;
          const st = STATUS_META[op.status];
          const l = local[stage] ?? { completedQty: String(op.completedQty), operator: op.operator ?? '' };
          return (
            <div key={stage} className={cn('rounded-xl border p-3', op.status === 'done' ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : op.status === 'in_progress' ? 'border-amber-500/40 bg-amber-500/[0.05]' : 'border-border')}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold', op.status === 'done' ? 'bg-emerald-500 text-white' : op.status === 'in_progress' ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground')}>{idx + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{STAGE_LABEL[stage]}</p>
                  <Badge variant={st.variant} className="mt-0.5">{st.label}</Badge>
                </div>
                {canRun && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1">
                      <Input type="number" className="h-8 w-20 text-right text-sm" value={l.completedQty} onChange={(e) => setLocal((p) => ({ ...p, [stage]: { ...l, completedQty: e.target.value } }))} onBlur={() => apply(stage, {})} />
                      <span className="text-xs text-muted-foreground">/ {op.targetQty}</span>
                    </div>
                    <div className="relative">
                      <User className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input className="h-8 w-32 pl-7 text-sm" placeholder="Operator/briqada" value={l.operator} onChange={(e) => setLocal((p) => ({ ...p, [stage]: { ...l, operator: e.target.value } }))} onBlur={() => apply(stage, {})} />
                    </div>
                    {op.status === 'pending' && <Button size="sm" variant="outline" disabled={busy === stage} onClick={() => apply(stage, { status: 'in_progress' })}><Play className="h-3.5 w-3.5" /> Başlat</Button>}
                    {op.status === 'in_progress' && <Button size="sm" disabled={busy === stage} onClick={() => apply(stage, { status: 'done' })}><Check className="h-3.5 w-3.5" /> Bitir</Button>}
                    {op.status === 'done' && <Button size="sm" variant="ghost" disabled={busy === stage} onClick={() => apply(stage, { status: 'in_progress' })}><RotateCcw className="h-3.5 w-3.5" /></Button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
