import { addDoc, collection, doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import type { SalesOrder, SalesReturn } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

/**
 * Satış qaytarması (08 §8.7). restockable=true olarsa hazır məhsul stoka geri qayıdır.
 * Sadəlik üçün tam qaytarma (bütün sətirlər) tətbiq olunur.
 */
export async function createSalesReturn(
  order: SalesOrder,
  params: { reason: SalesReturn['reason']; returnType: SalesReturn['returnType']; restockable: boolean },
  actor: Actor,
): Promise<string> {
  const db = getDb();
  const returnNumber = await nextNumber('RET');

  // Qaytarma "gözləyir" statusunda yaradılır — geri-stok və sifariş statusu
  // yalnız RMA tamamlananda tətbiq olunur (setReturnStatus).
  const ref = await addDoc(collection(db, 'sales_returns'), {
    returnNumber,
    originalSaleId: order.id,
    soNumber: order.soNumber ?? null,
    customerId: order.customerId,
    customerName: order.customerName ?? null,
    items: order.items.map((i) => ({ variantSku: i.variantSku, finishedGoodId: i.finishedGoodId, quantity: i.quantity, reason: params.reason })),
    reason: params.reason,
    returnType: params.returnType,
    refundAmount: order.totalAmount,
    status: 'pending',
    restockable: params.restockable,
    createdAt: serverTimestamp(),
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'SalesReturn', entityId: ref.id });
  return ref.id;
}

/**
 * RMA statusunu dəyişir (pending → approved → completed).
 * "completed"-də: restockable olarsa hazır məhsul stoka qayıdır və orijinal
 * sifariş "returned" işarələnir.
 */
export async function setReturnStatus(ret: SalesReturn, status: SalesReturn['status'], actor: Actor): Promise<void> {
  const db = getDb();

  if (status === 'completed' && ret.status !== 'completed') {
    if (ret.restockable) {
      for (const item of ret.items) {
        if (!item.finishedGoodId) continue;
        const fgRef = doc(db, 'finished_goods', item.finishedGoodId);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(fgRef);
          if (!snap.exists()) return;
          const d = snap.data() as { currentStock?: number; reservedStock?: number };
          const newStock = (d.currentStock ?? 0) + item.quantity;
          tx.update(fgRef, { currentStock: newStock, availableStock: newStock - (d.reservedStock ?? 0), updatedAt: serverTimestamp() });
        });
      }
    }
    if (ret.originalSaleId) {
      await updateDoc(doc(db, 'sales_orders', ret.originalSaleId), { status: 'returned', updatedAt: serverTimestamp() }).catch(() => {});
    }
  }

  await updateDoc(doc(db, 'sales_returns', ret.id), { status, updatedAt: serverTimestamp() });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'SalesReturn', entityId: ret.id });
}
