/**
 * Cloud Functions giriş nöqtəsi (spec 16.3).
 *
 * Tətbiqin əsas məntiqi (FIFO/AVCO, stok, faktura) client tərəfdə Firestore
 * transaction-ları ilə işləyir. Bu funksiyalar server-only tələbləri əhatə edir:
 *  - AI proxy (Groq açarını qoruyur)
 *  - Scheduled işlər (overstock, AR xatırlatmaları) — client-də scheduler yoxdur
 *  - (Opsional) denormalizasiya trigger-ləri
 *
 * Deploy:  cd functions && npm install && npm run deploy
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();

// ── Workflow icra mühərriki (Firestore triggerləri + scheduler) ──
export {
  wfSalesCreated, wfSalesStatus, wfPOCreated, wfExpenseCreated, wfGrnCreated,
  wfProductionCreated, wfCustomerCreated, wfCatalogPublished, wfProcessDelays, wfStockScan,
  processMailQueue,
} from './workflow.js';
import { dispatchOverdueInvoice } from './workflow.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// ── AI Proxy (12 §12.4) ──────────────────────────────────────
export const aiAssistant = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Giriş tələb olunur');
  const { prompt, useCase = 'chatbot', language = 'az', contextData } = req.data ?? {};
  if (!prompt) throw new HttpsError('invalid-argument', 'prompt tələb olunur');

  const systemPrompts: Record<string, string> = {
    summary: `Sən maliyyə analitikisən. ${language === 'az' ? 'Azərbaycan' : 'İngilis'} dilində qısa xülasə yaz.`,
    description: 'Sən moda kopirayterisən. Cəlbedici məhsul təsviri yaz (AZ + EN).',
    email: 'Sən peşəkar biznes yazışması mütəxəssisisən.',
    chatbot: 'Sən cins şalvar ERP köməkçisisən. Yalnız verilən data əsasında dəqiq cavab ver.',
  };

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ''}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompts[useCase] ?? systemPrompts.chatbot },
        { role: 'user', content: contextData ? `Kontekst: ${JSON.stringify(contextData)}\n\nSual: ${prompt}` : prompt },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new HttpsError('internal', `Groq xətası: ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { response: data.choices?.[0]?.message?.content ?? '' };
});

// ── Scheduled: Overstock yoxlaması (07 §7.4, gündəlik 08:00) ──
export const checkOverstock = onSchedule('every day 08:00', async () => {
  const snap = await db.collection('finished_goods').get();
  for (const doc of snap.docs) {
    const d = doc.data();
    if ((d.maxStock ?? 0) > 0 && (d.currentStock ?? 0) > d.maxStock) {
      await db.collection('notifications').add({
        type: 'OVERSTOCK',
        severity: 'info',
        title: { az: `${d.variantSku} overstock`, en: `${d.variantSku} overstock` },
        message: {
          az: `Cari: ${d.currentStock}, Max: ${d.maxStock}. Endirim tövsiyə olunur.`,
          en: `Current: ${d.currentStock}, Max: ${d.maxStock}. Markdown recommended.`,
        },
        recipientRoles: ['director', 'sales'],
        entityType: 'FinishedGood',
        entityId: doc.id,
        isRead: false,
        readBy: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
});

// ── Scheduled: Vaxtı keçən debitor xatırlatması (09 §9.1) ─────
export const arReminders = onSchedule('every day 09:00', async () => {
  const now = Date.now();
  const snap = await db.collection('receivables').where('status', 'in', ['open', 'partial']).get();
  for (const doc of snap.docs) {
    const d = doc.data();
    const due = d.dueDate?.toMillis?.() ?? 0;
    if (due && due < now) {
      await doc.ref.update({ status: 'overdue' });
      await db.collection('notifications').add({
        type: 'OVERDUE_AR',
        severity: 'warning',
        title: { az: `Gecikən borc: ${d.customerName ?? ''}`, en: `Overdue: ${d.customerName ?? ''}` },
        message: {
          az: `${d.invoiceNumber ?? ''} faktura üzrə ${d.balance} AZN gecikib.`,
          en: `Invoice ${d.invoiceNumber ?? ''} of ${d.balance} AZN is overdue.`,
        },
        recipientRoles: ['accountant', 'sales'],
        entityType: 'Receivable',
        entityId: doc.id,
        isRead: false,
        readBy: [],
        createdAt: FieldValue.serverTimestamp(),
      });
      // invoice.overdue workflow-larını işə sal
      await dispatchOverdueInvoice(doc.id, { ...d, status: 'overdue' });
    }
  }
});
