/**
 * Workflow icra mühərriki (client-side).
 * Domain hadisəsindən sonra çağırılır → aktiv workflow-ları tapır, şərti
 * qiymətləndirir, addımları ardıcıl icra edir (təsdiq, bildiriş, tapşırıq,
 * status dəyişmə, AI mesaj, webhook). Heç vaxt çağıran əməliyyatı bloklamır.
 */
import { serverTimestamp } from 'firebase/firestore';
import { createDoc, listDocs, updateDocById } from '@/lib/firebase/firestore';
import { createNotification } from '@/lib/firebase/notifications';
import type { Workflow, WorkflowCondition, WorkflowStep, WorkflowTriggerType } from '@/types';

export interface DispatchContext {
  /** Status dəyişmək üçün entity-nin Firestore kolleksiyası */
  collection?: string;
  entityType: string;
  entityId?: string;
  entityLabel: string;
  actionUrl?: string;
  actor: { uid: string; username: string };
}

let cache: { at: number; data: Workflow[] } | null = null;
const TTL = 30_000;

async function activeWorkflows(): Promise<Workflow[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const all = await listDocs<Workflow>('workflows', []);
  const data = all.filter((w) => w.status === 'active');
  cache = { at: Date.now(), data };
  return data;
}

/** Kəşi təmizlə (workflow dəyişdikdə UI çağıra bilər) */
export function invalidateWorkflowCache() {
  cache = null;
}

function evalCondition(cond: WorkflowCondition | null | undefined, entity: Record<string, unknown>): boolean {
  if (!cond?.field) return true;
  const raw = entity[cond.field];
  const a = typeof raw === 'number' ? raw : Number(raw);
  const b = Number(cond.value);
  const numeric = !Number.isNaN(a) && !Number.isNaN(b);
  switch (cond.op) {
    case 'eq': return String(raw) === String(cond.value);
    case 'neq': return String(raw) !== String(cond.value);
    case 'gt': return numeric && a > b;
    case 'gte': return numeric && a >= b;
    case 'lt': return numeric && a < b;
    case 'lte': return numeric && a <= b;
    case 'contains': return String(raw ?? '').toLowerCase().includes(String(cond.value).toLowerCase());
    default: return true;
  }
}

const rolesFor = (step: WorkflowStep): string[] => {
  if (step.assigneeType === 'role' && step.assigneeRole) return [step.assigneeRole];
  return ['director'];
};

async function aiText(prompt: string): Promise<string> {
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'custom', prompt }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data.result as string) ?? '';
  } catch { return ''; }
}

async function runStep(step: WorkflowStep, wf: Workflow, entity: Record<string, unknown>, ctx: DispatchContext): Promise<string> {
  if (step.condition?.field && !evalCondition(step.condition, entity)) return 'skipped (şərt)';

  switch (step.type) {
    case 'approval': {
      await createDoc('approval_requests', {
        workflowId: wf.id, workflowName: wf.name, stepId: step.id,
        entityType: ctx.entityType, entityId: ctx.entityId ?? null, entityLabel: ctx.entityLabel,
        actionUrl: ctx.actionUrl ?? null,
        assigneeType: step.assigneeType ?? 'role', assigneeRole: step.assigneeRole ?? null,
        assigneeUserId: step.assigneeUserId ?? null, assigneeUserName: step.assigneeUserName ?? null,
        level: step.approvalLevel ?? 1, message: step.message ?? null,
        status: 'pending', requestedBy: ctx.actor,
      });
      await createNotification({
        type: 'APPROVAL_REQUEST', severity: 'action',
        title: { az: `Təsdiq tələbi: ${ctx.entityLabel}`, en: `Approval required: ${ctx.entityLabel}` },
        message: { az: step.message || `${wf.name} üzrə təsdiq lazımdır.`, en: step.message || `Approval needed for ${wf.name}.` },
        recipientRoles: rolesFor(step), entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: '/approvals',
      });
      return 'təsdiq tələbi yaradıldı';
    }
    case 'assign':
    case 'create_task': {
      await createDoc('tasks', {
        workflowId: wf.id, workflowName: wf.name,
        title: step.message || `${wf.name}: ${ctx.entityLabel}`,
        entityType: ctx.entityType, entityId: ctx.entityId ?? null, entityLabel: ctx.entityLabel,
        actionUrl: ctx.actionUrl ?? null,
        assigneeType: step.assigneeType ?? 'role', assigneeRole: step.assigneeRole ?? null,
        assigneeUserId: step.assigneeUserId ?? null, assigneeUserName: step.assigneeUserName ?? null,
        status: 'open', createdBy: ctx.actor,
      });
      await createNotification({
        type: 'TASK_ASSIGNED', severity: 'action',
        title: { az: `Yeni tapşırıq: ${ctx.entityLabel}`, en: `New task: ${ctx.entityLabel}` },
        message: { az: step.message || wf.name, en: step.message || wf.name },
        recipientRoles: rolesFor(step), entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: '/approvals',
      });
      return 'tapşırıq yaradıldı';
    }
    case 'notify': {
      const msg = step.message || wf.name;
      await createNotification({
        type: 'WORKFLOW_NOTIFY', severity: 'info',
        title: { az: `${wf.name}`, en: `${wf.name}` },
        message: { az: msg, en: msg },
        recipientRoles: step.assigneeType === 'role' && step.assigneeRole ? [step.assigneeRole] : ['director'],
        entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: ctx.actionUrl,
      });
      return 'bildiriş göndərildi';
    }
    case 'update_status': {
      if (ctx.collection && ctx.entityId && step.newStatus) {
        await updateDocById(ctx.collection, ctx.entityId, { status: step.newStatus });
        return `status → ${step.newStatus}`;
      }
      return 'status dəyişmədi (məlumat yox)';
    }
    case 'ai_summary': {
      const prompt = step.message || `Bu ERP hadisəsi üçün qısa idarəetmə xülasəsi yaz (Azərbaycan): ${ctx.entityLabel}. Məlumat: ${JSON.stringify(entity).slice(0, 800)}`;
      const text = await aiText(prompt);
      await createNotification({
        type: 'AI_INSIGHT', severity: 'info',
        title: { az: `AI: ${wf.name}`, en: `AI: ${wf.name}` },
        message: { az: text || 'AI mətn yaradıla bilmədi', en: text || 'AI text unavailable' },
        recipientRoles: step.assigneeType === 'role' && step.assigneeRole ? [step.assigneeRole] : ['director'],
        entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: ctx.actionUrl,
      });
      return 'AI xülasə yaradıldı';
    }
    case 'webhook': {
      if (!step.webhookUrl) return 'webhook URL yox';
      try {
        await fetch('/api/workflow/webhook', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: step.webhookUrl, payload: { workflow: wf.name, entity: ctx.entityType, id: ctx.entityId, label: ctx.entityLabel } }),
        });
        return 'webhook çağırıldı';
      } catch { return 'webhook xətası'; }
    }
    case 'delay':
      return `delay ${step.delayHours ?? 0}s qeyd edildi`;
    default:
      return 'naməlum addım';
  }
}

/** Əsas giriş nöqtəsi — domain hadisəsindən sonra çağırılır */
export async function dispatchWorkflow(
  trigger: WorkflowTriggerType,
  entity: Record<string, unknown>,
  ctx: DispatchContext,
): Promise<void> {
  // Server (Cloud Functions) workflow icrası aktivdirsə, client dispatch-i söndür
  // ki, ikiqat icra olmasın. Functions deploy olunandan sonra Vercel-də
  // NEXT_PUBLIC_SERVER_WORKFLOWS=1 təyin edilir.
  if (process.env.NEXT_PUBLIC_SERVER_WORKFLOWS === '1') return;
  try {
    const matched = (await activeWorkflows()).filter((w) => w.trigger === trigger);
    for (const wf of matched) {
      if (!evalCondition(wf.triggerCondition, entity)) continue;
      const results: { step: string; result: string }[] = [];
      for (const step of wf.steps) {
        try {
          const r = await runStep(step, wf, entity, ctx);
          results.push({ step: step.type, result: r });
        } catch (e) {
          results.push({ step: step.type, result: 'xəta: ' + (e instanceof Error ? e.message : String(e)) });
        }
      }
      await updateDocById('workflows', wf.id, { runCount: (wf.runCount ?? 0) + 1, lastRunAt: serverTimestamp() });
      await createDoc('workflow_runs', {
        workflowId: wf.id, workflowName: wf.name, trigger,
        entityType: ctx.entityType, entityId: ctx.entityId ?? null, entityLabel: ctx.entityLabel,
        triggeredBy: ctx.actor, results,
      });
      cache = null; // runCount dəyişdi
    }
  } catch (e) {
    console.error('Workflow dispatch xətası:', e);
  }
}
