import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import type { OperationStage, ProductionOperation, ProductionOperations, ProductionOrder } from '@/types';

interface Actor { uid: string; username: string }

export const OPERATION_STAGES: { stage: OperationStage; label: string }[] = [
  { stage: 'cutting', label: 'Kəsim' },
  { stage: 'sewing', label: 'Tikiş' },
  { stage: 'washing', label: 'Yuma' },
  { stage: 'ironing', label: 'Ütü / Final' },
  { stage: 'qc', label: 'Keyfiyyət (QC)' },
  { stage: 'packing', label: 'Paketləmə' },
];

export const STAGE_LABEL: Record<OperationStage, string> = Object.fromEntries(
  OPERATION_STAGES.map((s) => [s.stage, s.label]),
) as Record<OperationStage, string>;

function defaultOperations(qty: number): ProductionOperation[] {
  return OPERATION_STAGES.map((s) => ({
    stage: s.stage, status: 'pending', targetQty: qty, completedQty: 0,
  }));
}

/** İstehsal sifarişi üçün mərhələləri (shop-floor) yaradır */
export async function initOperations(order: ProductionOrder, actor: Actor): Promise<void> {
  const ref = doc(getDb(), 'production_operations', order.id);
  await setDoc(ref, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalQuantity: order.totalQuantity,
    operations: defaultOperations(order.totalQuantity),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'ProductionOrder', entityId: `ops:${order.orderNumber}` });
}

export async function fetchOperations(orderId: string): Promise<ProductionOperations | null> {
  const snap = await getDoc(doc(getDb(), 'production_operations', orderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ProductionOperations, 'id'>) };
}

/** İstehsal sifarişi tamamlananda bütün mərhələləri "bitdi" işarələyir */
export async function completeAllOperations(orderId: string, actor: Actor): Promise<void> {
  const current = await fetchOperations(orderId);
  if (!current) return; // mərhələlər heç başladılmayıbsa toxunma
  const operations = current.operations.map((op) =>
    op.status === 'done'
      ? op
      : { ...op, status: 'done' as const, completedQty: op.completedQty || op.targetQty, completedAt: serverTimestamp() as unknown as ProductionOperation['completedAt'] },
  );
  await setDoc(doc(getDb(), 'production_operations', orderId), { operations, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'ProductionOrder', entityId: `ops:${current.orderNumber ?? orderId}` });
}

/** Bir mərhələni yeniləyir (status/say/operator/qeyd) */
export async function updateOperation(
  current: ProductionOperations,
  stage: OperationStage,
  patch: Partial<ProductionOperation>,
  actor: Actor,
): Promise<void> {
  const operations = current.operations.map((op) => {
    if (op.stage !== stage) return op;
    const next: ProductionOperation = { ...op, ...patch };
    if (patch.status === 'in_progress' && !op.startedAt) next.startedAt = serverTimestamp() as unknown as ProductionOperation['startedAt'];
    if (patch.status === 'done') {
      next.completedAt = serverTimestamp() as unknown as ProductionOperation['completedAt'];
      if (patch.completedQty === undefined && next.completedQty === 0) next.completedQty = next.targetQty;
    }
    return next;
  });
  await setDoc(doc(getDb(), 'production_operations', current.id), { operations, updatedAt: serverTimestamp() }, { merge: true });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'ProductionOrder', entityId: `ops:${current.orderNumber ?? current.id}` });
}
