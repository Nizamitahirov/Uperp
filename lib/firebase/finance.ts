import { addDoc, collection, doc, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { addCashTransaction } from './cash';
import type { Payable, Receivable } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

function statusFor(balance: number, paid: number): 'open' | 'partial' | 'paid' {
  if (balance <= 0.001) return 'paid';
  if (paid > 0) return 'partial';
  return 'open';
}

/** Müştəri ödənişini qeyd edir, debitoru azaldır, qəbz yaradır (09 §9.1) */
export async function recordCustomerPayment(
  receivable: Receivable,
  params: { amount: number; method: 'cash' | 'transfer' | 'card'; registerId?: string; registerName?: string },
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const amount = Math.min(params.amount, receivable.balance);
  const newPaid = (receivable.paidAmount ?? 0) + amount;
  const newBalance = receivable.amount - newPaid;
  const status = statusFor(newBalance, newPaid);

  await updateDoc(doc(db, 'receivables', receivable.id), { paidAmount: newPaid, balance: newBalance, status });
  if (receivable.invoiceId) {
    await runTransaction(db, async (tx) => {
      const invRef = doc(db, 'invoices', receivable.invoiceId);
      const snap = await tx.get(invRef);
      if (!snap.exists()) return;
      const inv = snap.data();
      const paid = (inv.paidAmount ?? 0) + amount;
      tx.update(invRef, { paidAmount: paid, status: statusFor(inv.totalAmount - paid, paid) });
    });
  }

  // Müştəri balansı
  await runTransaction(db, async (tx) => {
    const cRef = doc(db, 'customers', receivable.customerId);
    const snap = await tx.get(cRef);
    if (snap.exists()) tx.update(cRef, { currentBalance: Math.max(0, (snap.data().currentBalance ?? 0) - amount) });
  });

  const receiptNumber = await nextNumber('PAY');
  await addDoc(collection(db, 'payment_receipts'), {
    receiptNumber,
    customerId: receivable.customerId,
    customerName: receivable.customerName ?? null,
    amount,
    method: params.method,
    appliedInvoices: [{ invoiceId: receivable.invoiceId, amount }],
    createdAt: serverTimestamp(),
  });

  if (params.registerId) {
    await addCashTransaction(
      { registerId: params.registerId, registerName: params.registerName, type: 'in', category: 'Müştəri ödənişi', amount, currency: 'AZN', description: `Ödəniş ${receiptNumber}`, referenceType: 'Receivable', referenceId: receivable.id },
      actor,
    );
  }

  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Receivable', entityId: receivable.id });
}

/** GRN-dən kreditor (AP) yaradır (09 §9.2) */
export async function createPayableFromGRN(params: {
  supplierId: string;
  supplierName?: string;
  purchaseOrderId: string;
  grnId: string;
  amount: number;
  dueDays?: number;
}): Promise<void> {
  const dueDate = Timestamp.fromMillis(Date.now() + (params.dueDays ?? 30) * 24 * 3600 * 1000);
  await addDoc(collection(getDb(), 'payables'), {
    supplierId: params.supplierId,
    supplierName: params.supplierName ?? null,
    purchaseOrderId: params.purchaseOrderId,
    grnId: params.grnId,
    amount: params.amount,
    paidAmount: 0,
    balance: params.amount,
    dueDate,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

/** Kreditora ödəniş (AP) */
export async function payPayable(
  payable: Payable,
  params: { amount: number; registerId?: string; registerName?: string },
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const amount = Math.min(params.amount, payable.balance);
  const newPaid = (payable.paidAmount ?? 0) + amount;
  const newBalance = payable.amount - newPaid;
  await updateDoc(doc(db, 'payables', payable.id), { paidAmount: newPaid, balance: newBalance, status: statusFor(newBalance, newPaid) });
  if (params.registerId) {
    await addCashTransaction(
      { registerId: params.registerId, registerName: params.registerName, type: 'out', category: 'Supplier ödənişi', amount, currency: 'AZN', description: `AP ödəniş ${payable.purchaseOrderId}`, referenceType: 'Payable', referenceId: payable.id },
      actor,
    );
  }
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Payable', entityId: payable.id });
}
