import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createSalesOrder, computeSalesTotals } from './sales';
import type { Quotation, SalesOrderItem } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

/** Qiymət təklifi yaradır (08 §8.2) */
export async function createQuotation(
  params: { customerId: string; customerName: string; items: SalesOrderItem[]; validDays?: number },
  actor: Actor,
): Promise<string> {
  const quoteNumber = await nextNumber('QT');
  const totals = computeSalesTotals(params.items);
  const ref = await addDoc(collection(getDb(), 'quotations'), {
    quoteNumber,
    customerId: params.customerId,
    customerName: params.customerName,
    items: params.items,
    ...totals,
    validUntil: Timestamp.fromMillis(Date.now() + (params.validDays ?? 14) * 24 * 3600 * 1000),
    status: 'sent' as const,
    createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Quotation', entityId: ref.id });
  return ref.id;
}

/** Təklifi qəbul et → satış sifarişinə çevir */
export async function acceptQuotation(quote: Quotation, actor: Actor): Promise<string> {
  const orderId = await createSalesOrder(
    { customerId: quote.customerId, customerName: quote.customerName ?? '', channel: 'wholesale', items: quote.items, paymentMethod: 'credit' },
    actor,
  );
  await updateDoc(doc(getDb(), 'quotations', quote.id), { status: 'accepted', convertedOrderId: orderId });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Quotation', entityId: quote.id });
  return orderId;
}

export async function rejectQuotation(quoteId: string, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), 'quotations', quoteId), { status: 'rejected' });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Quotation', entityId: quoteId });
}
