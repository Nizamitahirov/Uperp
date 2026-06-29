import { addDoc, collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { addCashTransaction } from './cash';
import { logAudit } from './audit';
import type { POSItem } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

/**
 * POS satışını tamamlayır (08 §8.5): hər variant üçün hazır məhsul stokunu
 * azaldır, pos_sales yazır, nağd/kart isə kassaya mədaxil edir, qəbz qaytarır.
 */
export async function completePOSSale(
  params: {
    items: POSItem[];
    discount: number;
    vat: number;
    subtotal: number;
    total: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
    amountReceived: number;
    change: number;
    registerId?: string;
    registerName?: string;
    customerId?: string;
  },
  actor: Actor,
): Promise<string> {
  const db = getDb();
  const receiptNumber = await nextNumber('RCP');

  // Stok azaltma (variant başına transaction)
  for (const item of params.items) {
    const fgRef = doc(db, 'finished_goods', item.finishedGoodId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(fgRef);
      if (!snap.exists()) throw new Error(`Variant tapılmadı: ${item.variantSku}`);
      const d = snap.data() as { currentStock?: number; reservedStock?: number };
      const newStock = (d.currentStock ?? 0) - item.quantity;
      if (newStock < 0) throw new Error(`Kifayət qədər stok yoxdur: ${item.variantSku}`);
      tx.update(fgRef, { currentStock: newStock, availableStock: newStock - (d.reservedStock ?? 0), updatedAt: serverTimestamp() });
    });
  }

  const saleRef = await addDoc(collection(db, 'pos_sales'), {
    receiptNumber,
    cashierId: actor.uid,
    cashierName: actor.username,
    customerId: params.customerId ?? null,
    items: params.items,
    subtotal: params.subtotal,
    discount: params.discount,
    vat: params.vat,
    total: params.total,
    paymentMethod: params.paymentMethod,
    amountReceived: params.amountReceived,
    change: params.change,
    registerId: params.registerId ?? null,
    createdAt: serverTimestamp(),
  });

  // Kassaya mədaxil
  if (params.registerId) {
    await addCashTransaction(
      {
        registerId: params.registerId,
        registerName: params.registerName,
        type: 'in',
        category: 'Nağd satış (POS)',
        amount: params.total,
        currency: 'AZN',
        description: `POS satış ${receiptNumber}`,
        referenceType: 'POSSale',
        referenceId: saleRef.id,
      },
      actor,
    );
  }

  await logAudit({ userId: actor.uid, username: actor.username, action: 'STOCK_MOVE', entityType: 'POSSale', entityId: saleRef.id });
  return receiptNumber;
}
