import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import { VAT_RATE } from '@/lib/constants';
import type { SalesOrder, SalesOrderItem } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

export function computeSalesTotals(items: { quantity: number; unitPrice: number; discount: number }[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = items.reduce((s, i) => s + i.quantity * i.unitPrice * ((i.discount || 0) / 100), 0);
  const net = subtotal - discountAmount;
  const vatAmount = net * (VAT_RATE / 100);
  const totalAmount = net + vatAmount;
  return { subtotal, discountAmount, vatAmount, totalAmount };
}

/** Satış sifarişi yaradır (status: new) — 08 §8.3 */
export async function createSalesOrder(
  params: {
    customerId: string;
    customerName: string;
    channel: SalesOrder['channel'];
    items: SalesOrderItem[];
    paymentMethod: SalesOrder['paymentMethod'];
    deliveryAddress?: string;
  },
  actor: Actor,
): Promise<string> {
  const soNumber = await nextNumber('SO');
  const totals = computeSalesTotals(params.items);
  const data = {
    soNumber,
    customerId: params.customerId,
    customerName: params.customerName,
    channel: params.channel,
    date: serverTimestamp(),
    items: params.items,
    ...totals,
    deliveryAddress: params.deliveryAddress ?? null,
    paymentMethod: params.paymentMethod,
    paymentStatus: 'unpaid' as const,
    paidAmount: 0,
    status: 'new' as const,
    reserved: false,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(getDb(), 'sales_orders'), data);
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'SalesOrder', entityId: ref.id });
  await createNotification({
    type: 'NEW_ORDER',
    severity: 'info',
    title: { az: `Yeni sifariş ${soNumber}`, en: `New order ${soNumber}` },
    message: { az: `${params.customerName} yeni sifariş verdi.`, en: `${params.customerName} placed a new order.` },
    recipientRoles: ['sales', 'director'],
    entityType: 'SalesOrder',
    entityId: ref.id,
    actionUrl: `/sales/${ref.id}`,
  });
  return ref.id;
}

/** Sifarişi təsdiqlə → hazır məhsul rezerv et (07 §7.2) */
export async function confirmSalesOrder(order: SalesOrder, actor: Actor): Promise<void> {
  if (order.reserved) return;
  const db = getDb();
  for (const item of order.items) {
    const fgRef = doc(db, 'finished_goods', item.finishedGoodId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(fgRef);
      if (!snap.exists()) throw new Error(`Variant tapılmadı: ${item.variantSku}`);
      const d = snap.data() as { currentStock?: number; reservedStock?: number };
      const reserved = (d.reservedStock ?? 0) + item.quantity;
      tx.update(fgRef, {
        reservedStock: reserved,
        availableStock: (d.currentStock ?? 0) - reserved,
        updatedAt: serverTimestamp(),
      });
    });
  }
  await updateDoc(doc(db, 'sales_orders', order.id), { status: 'confirmed', reserved: true, updatedAt: serverTimestamp() });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'SalesOrder', entityId: order.id });
}

/** Sifarişi ləğv et → rezervi aç */
export async function cancelSalesOrder(order: SalesOrder, actor: Actor): Promise<void> {
  const db = getDb();
  if (order.reserved) {
    for (const item of order.items) {
      const fgRef = doc(db, 'finished_goods', item.finishedGoodId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(fgRef);
        if (!snap.exists()) return;
        const d = snap.data() as { currentStock?: number; reservedStock?: number };
        const reserved = Math.max(0, (d.reservedStock ?? 0) - item.quantity);
        tx.update(fgRef, { reservedStock: reserved, availableStock: (d.currentStock ?? 0) - reserved, updatedAt: serverTimestamp() });
      });
    }
  }
  await updateDoc(doc(db, 'sales_orders', order.id), { status: 'cancelled', reserved: false, updatedAt: serverTimestamp() });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'SalesOrder', entityId: order.id });
}

/**
 * Çatdırılma → stok çıxır (currentStock & reserved azalır), faktura + debitor (AR)
 * yaranır, müştəri balansı artır (08 §8.3, 09 §9.1).
 */
export async function deliverSalesOrder(order: SalesOrder, actor: Actor): Promise<void> {
  const db = getDb();

  for (const item of order.items) {
    const fgRef = doc(db, 'finished_goods', item.finishedGoodId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(fgRef);
      if (!snap.exists()) throw new Error(`Variant tapılmadı: ${item.variantSku}`);
      const d = snap.data() as { currentStock?: number; reservedStock?: number };
      const newStock = (d.currentStock ?? 0) - item.quantity;
      const newReserved = Math.max(0, (d.reservedStock ?? 0) - item.quantity);
      tx.update(fgRef, { currentStock: newStock, reservedStock: newReserved, availableStock: newStock - newReserved, updatedAt: serverTimestamp() });
    });
  }

  // Faktura
  const invoiceNumber = await nextNumber('INV');
  const dueDate = Timestamp.fromMillis(Date.now() + 30 * 24 * 3600 * 1000);
  const invoiceRef = await addDoc(collection(db, 'invoices'), {
    invoiceNumber,
    type: 'sales',
    customerId: order.customerId,
    customerName: order.customerName,
    salesOrderId: order.id,
    subtotal: order.subtotal,
    vatAmount: order.vatAmount,
    totalAmount: order.totalAmount,
    paidAmount: 0,
    status: 'unpaid',
    dueDate,
    createdAt: serverTimestamp(),
  });

  // Debitor (AR)
  await addDoc(collection(db, 'receivables'), {
    customerId: order.customerId,
    customerName: order.customerName,
    invoiceId: invoiceRef.id,
    invoiceNumber,
    amount: order.totalAmount,
    paidAmount: 0,
    balance: order.totalAmount,
    dueDate,
    status: 'open',
    createdAt: serverTimestamp(),
  });

  // Müştəri balansı (denormalized)
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, 'customers', order.customerId);
    const snap = await tx.get(cRef);
    if (snap.exists()) {
      const bal = (snap.data().currentBalance ?? 0) + order.totalAmount;
      tx.update(cRef, { currentBalance: bal, updatedAt: serverTimestamp() });
    }
  });

  await updateDoc(doc(db, 'sales_orders', order.id), {
    status: 'delivered',
    invoiceId: invoiceRef.id,
    deliveryDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'SalesOrder', entityId: order.id });
}
