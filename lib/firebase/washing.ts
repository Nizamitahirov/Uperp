import { addDoc, collection, doc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { createNotification } from './notifications';
import { setProductionStatus } from './production';
import { WASH_TYPES } from '@/lib/constants';
import type { ProductionOrder, WashingOrder, WashType } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

/** Yuyulma sifarişi yaradır və istehsalı "yuyulmada" statusuna keçirir (06 §6.4) */
export async function createWashingOrder(
  order: ProductionOrder,
  params: {
    washType: WashType;
    isOutsourced: boolean;
    laundryName?: string;
    pricePerPiece?: number;
    sentQuantity: number;
    expectedReturnDate?: string;
  },
  actor: Actor,
): Promise<string> {
  const washNumber = await nextNumber('WSH');
  const cost = params.isOutsourced ? (params.pricePerPiece ?? 0) * params.sentQuantity : 0;

  const data = {
    washNumber,
    productionOrderId: order.id,
    productionOrderNumber: order.orderNumber,
    washType: params.washType,
    isOutsourced: params.isOutsourced,
    laundryName: params.laundryName ?? null,
    pricePerPiece: params.pricePerPiece ?? 0,
    sentQuantity: params.sentQuantity,
    sentDate: serverTimestamp(),
    expectedReturnDate: params.expectedReturnDate ? Timestamp.fromDate(new Date(params.expectedReturnDate)) : null,
    status: 'sent' as const,
    cost,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(getDb(), 'washing_orders'), data);
  await setProductionStatus(order.id, 'in_washing', actor);
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'WashingOrder', entityId: ref.id });
  return ref.id;
}

/**
 * Yuyulmadan qayıdışı qeyd edir, itki faizini hesablayır (06 §6.4.4) və
 * normadan çoxdursa xəbərdarlıq yaradır. İstehsala washingCost/itki yazılır.
 */
export async function returnWashing(
  wash: WashingOrder,
  order: ProductionOrder,
  params: { returnedQuantity: number; damagedQuantity: number; shrinkageMeasured?: number },
  actor: Actor,
): Promise<{ lossPercentage: number; high: boolean }> {
  const loss = wash.sentQuantity - params.returnedQuantity;
  const lossPercentage = wash.sentQuantity > 0 ? (loss / wash.sentQuantity) * 100 : 0;
  const maxLoss = WASH_TYPES[wash.washType]?.maxLoss ?? 100;
  const high = lossPercentage > maxLoss;

  await updateDoc(doc(getDb(), 'washing_orders', wash.id), {
    returnedQuantity: params.returnedQuantity,
    damagedQuantity: params.damagedQuantity,
    lossQuantity: loss,
    lossPercentage,
    shrinkageMeasured: params.shrinkageMeasured ?? null,
    returnDate: serverTimestamp(),
    status: 'returned',
  });

  await updateDoc(doc(getDb(), 'production_orders', order.id), {
    washingCost: (order.washingCost ?? 0) + (wash.cost ?? 0),
    washingLossQuantity: (order.washingLossQuantity ?? 0) + loss,
    status: 'in_qc',
    updatedAt: serverTimestamp(),
  });

  if (high) {
    await createNotification({
      type: 'HIGH_WASHING_LOSS',
      severity: 'warning',
      title: { az: `Yüksək yuyulma itkisi (${wash.washNumber})`, en: `High washing loss (${wash.washNumber})` },
      message: {
        az: `İtki ${lossPercentage.toFixed(1)}% — norma ${maxLoss}%-i keçib (${WASH_TYPES[wash.washType]?.label}).`,
        en: `Loss ${lossPercentage.toFixed(1)}% exceeds the ${maxLoss}% norm.`,
      },
      recipientRoles: ['production', 'director'],
      entityType: 'WashingOrder',
      entityId: wash.id,
    });
  }

  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'WashingOrder', entityId: wash.id });
  return { lossPercentage, high };
}
