/**
 * Server tərəfi Workflow icra mühərriki (Cloud Functions v2).
 * Firestore hadisələri ilə tetiklenir → aktiv workflow-ları icra edir.
 * Client engine ilə eyni semantikadır; delay addımı server-də real işləyir
 * (workflow_continuations + scheduler ilə davam etdirilir).
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const db = getFirestore();
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

type Dict = Record<string, any>;
interface Ctx { collection?: string; entityType: string; entityId?: string; entityLabel: string; actionUrl?: string; actor: { uid: string; username: string }; }

function evalCondition(cond: Dict | null | undefined, entity: Dict): boolean {
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

const rolesFor = (s: Dict): string[] => (s.assigneeType === 'role' && s.assigneeRole ? [s.assigneeRole] : ['director']);

async function notify(input: Dict): Promise<void> {
  await db.collection('notifications').add({ ...input, isRead: false, readBy: [], createdAt: FieldValue.serverTimestamp() });
}

async function aiText(prompt: string): Promise<string> {
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ''}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 500 }),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as Dict;
    return data.choices?.[0]?.message?.content ?? '';
  } catch { return ''; }
}

async function runAction(step: Dict, w: Dict, wfId: string, entity: Dict, ctx: Ctx): Promise<void> {
  switch (step.type) {
    case 'approval':
      await db.collection('approval_requests').add({
        workflowId: wfId, workflowName: w.name, stepId: step.id,
        entityType: ctx.entityType, entityId: ctx.entityId ?? null, entityLabel: ctx.entityLabel, actionUrl: ctx.actionUrl ?? null,
        assigneeType: step.assigneeType ?? 'role', assigneeRole: step.assigneeRole ?? null,
        assigneeUserId: step.assigneeUserId ?? null, assigneeUserName: step.assigneeUserName ?? null,
        level: step.approvalLevel ?? 1, message: step.message ?? null, status: 'pending', requestedBy: ctx.actor,
        createdAt: FieldValue.serverTimestamp(),
      });
      await notify({ type: 'APPROVAL_REQUEST', severity: 'action', title: { az: `Təsdiq tələbi: ${ctx.entityLabel}`, en: `Approval: ${ctx.entityLabel}` }, message: { az: step.message || w.name, en: step.message || w.name }, recipientRoles: rolesFor(step), entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: '/approvals' });
      return;
    case 'assign':
    case 'create_task':
      await db.collection('tasks').add({
        workflowId: wfId, workflowName: w.name, title: step.message || `${w.name}: ${ctx.entityLabel}`,
        entityType: ctx.entityType, entityId: ctx.entityId ?? null, entityLabel: ctx.entityLabel, actionUrl: ctx.actionUrl ?? null,
        assigneeType: step.assigneeType ?? 'role', assigneeRole: step.assigneeRole ?? null,
        assigneeUserId: step.assigneeUserId ?? null, assigneeUserName: step.assigneeUserName ?? null,
        status: 'open', createdBy: ctx.actor, createdAt: FieldValue.serverTimestamp(),
      });
      await notify({ type: 'TASK_ASSIGNED', severity: 'action', title: { az: `Yeni tapşırıq: ${ctx.entityLabel}`, en: `Task: ${ctx.entityLabel}` }, message: { az: step.message || w.name, en: step.message || w.name }, recipientRoles: rolesFor(step), entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: '/approvals' });
      return;
    case 'notify': {
      const msg = step.message || w.name;
      await notify({ type: 'WORKFLOW_NOTIFY', severity: 'info', title: { az: w.name, en: w.name }, message: { az: msg, en: msg }, recipientRoles: rolesFor(step), entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: ctx.actionUrl });
      return;
    }
    case 'update_status':
      if (ctx.collection && ctx.entityId && step.newStatus) {
        await db.collection(ctx.collection).doc(ctx.entityId).update({ status: step.newStatus, updatedAt: FieldValue.serverTimestamp() });
      }
      return;
    case 'ai_summary': {
      const prompt = step.message || `Bu ERP hadisəsi üçün qısa idarəetmə xülasəsi yaz (Azərbaycan): ${ctx.entityLabel}. Data: ${JSON.stringify(entity).slice(0, 800)}`;
      const text = await aiText(prompt);
      await notify({ type: 'AI_INSIGHT', severity: 'info', title: { az: `AI: ${w.name}`, en: `AI: ${w.name}` }, message: { az: text || 'AI mətn yox', en: text || 'AI text unavailable' }, recipientRoles: rolesFor(step), entityType: ctx.entityType, entityId: ctx.entityId, actionUrl: ctx.actionUrl });
      return;
    }
    case 'webhook':
      if (step.webhookUrl) {
        try { await fetch(step.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflow: w.name, entity: ctx.entityType, id: ctx.entityId, label: ctx.entityLabel }) }); } catch { /* ignore */ }
      }
      return;
    default:
      return;
  }
}

async function runSteps(w: Dict, wfId: string, entity: Dict, ctx: Ctx, startIndex: number): Promise<void> {
  for (let i = startIndex; i < (w.steps?.length ?? 0); i++) {
    const step = w.steps[i];
    if (step.condition?.field && !evalCondition(step.condition, entity)) continue;
    if (step.type === 'delay') {
      const runAt = Date.now() + (step.delayHours ?? 0) * 3600 * 1000;
      await db.collection('workflow_continuations').add({ workflowId: wfId, workflow: w, entity, ctx, nextIndex: i + 1, runAt, createdAt: FieldValue.serverTimestamp() });
      return;
    }
    await runAction(step, w, wfId, entity, ctx);
  }
}

async function runWorkflows(trigger: string, entity: Dict, ctx: Ctx): Promise<void> {
  const snap = await db.collection('workflows').where('trigger', '==', trigger).get();
  for (const wfDoc of snap.docs) {
    const w = wfDoc.data();
    if (w.status !== 'active') continue;
    if (!evalCondition(w.triggerCondition, entity)) continue;
    const results: Dict[] = [];
    try {
      await runSteps(w, wfDoc.id, entity, ctx, 0);
      results.push({ ok: true });
    } catch (e) { results.push({ error: String(e) }); }
    await wfDoc.ref.update({ runCount: (w.runCount ?? 0) + 1, lastRunAt: FieldValue.serverTimestamp() });
    await db.collection('workflow_runs').add({ workflowId: wfDoc.id, workflowName: w.name, trigger, entityType: ctx.entityType, entityId: ctx.entityId ?? null, entityLabel: ctx.entityLabel, source: 'server', triggeredBy: ctx.actor, results, createdAt: FieldValue.serverTimestamp() });
  }
}

const actor = (d: Dict) => ({ uid: d?.createdBy ?? 'system', username: 'system' });
const opts = (document: string) => ({ document });

// ── Firestore create/update triggerləri ──────────────────────
export const wfSalesCreated = onDocumentCreated(opts('sales_orders/{id}'), (e) => {
  const d = e.data?.data(); if (!d) return;
  return runWorkflows('sales_order.created', d, { collection: 'sales_orders', entityType: 'SalesOrder', entityId: e.params.id, entityLabel: `Sifariş ${d.soNumber ?? ''}`, actionUrl: `/sales/${e.params.id}`, actor: actor(d) });
});
export const wfSalesStatus = onDocumentUpdated(opts('sales_orders/{id}'), (e) => {
  const before = e.data?.before.data(); const after = e.data?.after.data(); if (!after || before?.status === after?.status) return;
  return runWorkflows('sales_order.status_changed', after, { collection: 'sales_orders', entityType: 'SalesOrder', entityId: e.params.id, entityLabel: `Sifariş ${after.soNumber ?? ''}`, actionUrl: `/sales/${e.params.id}`, actor: actor(after) });
});
export const wfPOCreated = onDocumentCreated(opts('purchase_orders/{id}'), (e) => {
  const d = e.data?.data(); if (!d) return;
  return runWorkflows('purchase_order.created', d, { collection: 'purchase_orders', entityType: 'PurchaseOrder', entityId: e.params.id, entityLabel: `PO ${d.poNumber ?? ''}`, actionUrl: `/procurement/${e.params.id}`, actor: actor(d) });
});
export const wfExpenseCreated = onDocumentCreated(opts('expenses/{id}'), (e) => {
  const d = e.data?.data(); if (!d) return;
  return runWorkflows('expense.submitted', d, { collection: 'expenses', entityType: 'Expense', entityId: e.params.id, entityLabel: `Xərc ${d.expenseNumber ?? ''}`, actionUrl: '/finance', actor: actor(d) });
});
export const wfGrnCreated = onDocumentCreated(opts('grns/{id}'), (e) => {
  const d = e.data?.data(); if (!d) return;
  return runWorkflows('grn.received', d, { entityType: 'GRN', entityId: e.params.id, entityLabel: `GRN ${d.grnNumber ?? ''}`, actionUrl: '/procurement/grn', actor: actor(d) });
});
export const wfProductionCreated = onDocumentCreated(opts('production_orders/{id}'), (e) => {
  const d = e.data?.data(); if (!d) return;
  return runWorkflows('production_order.created', d, { collection: 'production_orders', entityType: 'ProductionOrder', entityId: e.params.id, entityLabel: `İstehsal ${d.orderNumber ?? ''}`, actionUrl: `/production/${e.params.id}`, actor: actor(d) });
});
export const wfCustomerCreated = onDocumentCreated(opts('customers/{id}'), (e) => {
  const d = e.data?.data(); if (!d) return;
  return runWorkflows('customer.created', d, { collection: 'customers', entityType: 'Customer', entityId: e.params.id, entityLabel: d.name ?? 'Müştəri', actionUrl: `/customers/${e.params.id}`, actor: actor(d) });
});
export const wfCatalogPublished = onDocumentUpdated(opts('catalogs/{id}'), (e) => {
  const before = e.data?.before.data(); const after = e.data?.after.data();
  if (!after || before?.status === after?.status || after?.status !== 'published') return;
  return runWorkflows('catalog.published', after, { collection: 'catalogs', entityType: 'Catalog', entityId: e.params.id, entityLabel: after.title?.az ?? 'Kataloq', actionUrl: '/catalog', actor: actor(after) });
});

// ── Delay davam etdirici (hər 10 dəqiqə) ─────────────────────
export const wfProcessDelays = onSchedule({ schedule: 'every 10 minutes' }, async () => {
  const now = Date.now();
  const snap = await db.collection('workflow_continuations').where('runAt', '<=', now).get();
  for (const c of snap.docs) {
    const x = c.data();
    try { await runSteps(x.workflow, x.workflowId, x.entity, x.ctx, x.nextIndex ?? 0); } catch (err) { console.error('delay resume', err); }
    await c.ref.delete();
  }
});

// ── Stok kritik səviyyə (gündəlik 07:30) ─────────────────────
export const wfStockScan = onSchedule({ schedule: 'every day 07:30' }, async () => {
  const snap = await db.collection('raw_materials').where('isActive', '==', true).get();
  for (const m of snap.docs) {
    const d = m.data();
    const reorder = d.reorderPoint ?? d.minStock ?? 0;
    if (reorder > 0 && (d.currentStock ?? 0) <= reorder) {
      await runWorkflows('stock.below_reorder', d, { collection: 'raw_materials', entityType: 'RawMaterial', entityId: m.id, entityLabel: d.name ?? 'Material', actionUrl: `/materials/${m.id}`, actor: { uid: 'system', username: 'system' } });
    }
  }
});

/** arReminders daxilindən çağırmaq üçün — overdue faktura workflow-u */
export async function dispatchOverdueInvoice(docId: string, d: Dict): Promise<void> {
  await runWorkflows('invoice.overdue', d, { collection: 'receivables', entityType: 'Receivable', entityId: docId, entityLabel: `Faktura ${d.invoiceNumber ?? ''}`, actionUrl: '/finance', actor: { uid: 'system', username: 'system' } });
}
