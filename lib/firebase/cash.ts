import { addDoc, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { CashRegister } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

export async function createCashRegister(params: { name: string; type: CashRegister['type']; currency: string }, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'cash_registers'), {
    ...params,
    currentBalance: 0,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'CashRegister', entityId: ref.id });
  return ref.id;
}

/** Kassa əməliyyatı əlavə edir və balansı atomik yeniləyir (08 §8.6) */
export async function addCashTransaction(
  params: {
    registerId: string;
    registerName?: string;
    type: 'in' | 'out';
    category: string;
    amount: number;
    currency: string;
    description?: string;
    referenceType?: string;
    referenceId?: string;
  },
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const regRef = doc(db, 'cash_registers', params.registerId);
  const txRef = doc(collection(db, 'cash_transactions'));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(regRef);
    if (!snap.exists()) throw new Error('Kassa tapılmadı');
    const bal = snap.data().currentBalance ?? 0;
    const newBal = params.type === 'in' ? bal + params.amount : bal - params.amount;
    tx.update(regRef, { currentBalance: newBal });
    tx.set(txRef, {
      registerId: params.registerId,
      registerName: params.registerName ?? snap.data().name,
      type: params.type,
      category: params.category,
      amount: params.amount,
      currency: params.currency,
      description: params.description ?? null,
      referenceType: params.referenceType ?? null,
      referenceId: params.referenceId ?? null,
      userId: actor.uid,
      username: actor.username,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'CashTransaction', entityId: params.registerId });
}
