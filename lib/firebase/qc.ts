import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import { logAudit } from './audit';
import { setProductionStatus } from './production';
import { createNotification } from './notifications';
import type { ProductionOrder } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

/** QC yoxlaması yaradır (06 §6.5) */
export async function createQCInspection(
  order: ProductionOrder,
  params: {
    inspectedQuantity: number;
    acceptedQuantity: number;
    defectQuantity: number;
    grade: 'A' | 'B' | 'reject';
    defects?: { type: string; count: number }[];
  },
  actor: Actor,
): Promise<string> {
  const data = {
    productionOrderId: order.id,
    productionOrderNumber: order.orderNumber,
    inspectedQuantity: params.inspectedQuantity,
    acceptedQuantity: params.acceptedQuantity,
    defectQuantity: params.defectQuantity,
    defects: params.defects ?? [],
    grade: params.grade,
    inspector: actor.username,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(getDb(), 'qc_inspections'), data);
  await setProductionStatus(order.id, 'in_qc', actor);

  const defectRate = params.inspectedQuantity > 0 ? (params.defectQuantity / params.inspectedQuantity) * 100 : 0;
  if (defectRate > 10) {
    await createNotification({
      type: 'HIGH_DEFECT',
      severity: 'warning',
      title: { az: `Yüksək qüsur (${order.orderNumber})`, en: `High defect rate (${order.orderNumber})` },
      message: {
        az: `Qüsur faizi ${defectRate.toFixed(1)}% — yoxlama tələb olunur.`,
        en: `Defect rate ${defectRate.toFixed(1)}% — review required.`,
      },
      recipientRoles: ['production', 'director'],
      entityType: 'ProductionOrder',
      entityId: order.id,
    });
  }

  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'QCInspection', entityId: ref.id });
  return ref.id;
}
