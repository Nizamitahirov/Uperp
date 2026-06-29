import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { issueStock } from './stock';
import { createNotification } from './notifications';
import type { BOM, Product, ProductionOrder, RawMaterial } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

export interface MaterialRequirement {
  materialId: string;
  materialName: string;
  unit: string;
  needed: number;
  available: number;
  unitCost: number;
  shortage: number;
}

/** BOM + ölçü paylanmasına görə material tələbini hesablayır (03 §3.6) */
export function computeRequirements(bom: BOM, sizeDistribution: Record<string, number>): Map<string, { needed: number; name: string; unit: string; unitCost: number }> {
  const req = new Map<string, { needed: number; name: string; unit: string; unitCost: number }>();
  for (const [size, qty] of Object.entries(sizeDistribution)) {
    const items = bom.sizeBasedItems[size] ?? [];
    for (const item of items) {
      const needed = qty * item.totalQuantity;
      const existing = req.get(item.materialId);
      if (existing) {
        existing.needed += needed;
      } else {
        req.set(item.materialId, { needed, name: item.materialName, unit: item.unit, unitCost: item.unitCost });
      }
    }
  }
  return req;
}

/** Tələbi cari stokla müqayisə edir */
export function checkAvailability(
  bom: BOM,
  sizeDistribution: Record<string, number>,
  materials: RawMaterial[],
): MaterialRequirement[] {
  const req = computeRequirements(bom, sizeDistribution);
  const byId = new Map(materials.map((m) => [m.id, m]));
  return Array.from(req.entries()).map(([materialId, r]) => {
    const available = byId.get(materialId)?.currentStock ?? 0;
    return {
      materialId,
      materialName: r.name,
      unit: r.unit,
      needed: r.needed,
      available,
      unitCost: r.unitCost,
      shortage: Math.max(0, r.needed - available),
    };
  });
}

/** İstehsal sifarişi yaradır (06 §6.2) */
export async function createProductionOrder(
  params: {
    product: Product;
    bom: BOM;
    sizeDistribution: Record<string, number>;
    plannedStartDate?: string;
    plannedEndDate?: string;
    priority: 'low' | 'normal' | 'high';
  },
  actor: Actor,
): Promise<string> {
  const orderNumber = await nextNumber('PRD-ORD', 'PRODORD');
  const totalQuantity = Object.values(params.sizeDistribution).reduce((a, b) => a + b, 0);
  const standardCost = params.bom.totalCost * totalQuantity;

  const data = {
    orderNumber,
    productId: params.product.id,
    productName: params.product.name?.az ?? '',
    productSku: params.product.sku,
    bomId: params.bom.id,
    sizeDistribution: params.sizeDistribution,
    totalQuantity,
    plannedStartDate: params.plannedStartDate ? Timestamp.fromDate(new Date(params.plannedStartDate)) : null,
    plannedEndDate: params.plannedEndDate ? Timestamp.fromDate(new Date(params.plannedEndDate)) : null,
    priority: params.priority,
    status: 'planned' as const,
    standardCost,
    actualMaterialCost: 0,
    actualLaborCost: 0,
    washingCost: 0,
    totalActualCost: 0,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(getDb(), 'production_orders'), data);
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'ProductionOrder', entityId: ref.id });
  return ref.id;
}

/**
 * İstehsalı başladır (03 §3.6): BOM əsasında bütün materialları FIFO/AVCO ilə
 * stokdan çıxarır (issueStock), faktiki material mayasını toplayır, status → in_progress.
 * Geri qaytarılmazdır.
 */
export async function startProduction(order: ProductionOrder, bom: BOM, actor: Actor): Promise<void> {
  const req = computeRequirements(bom, order.sizeDistribution);
  let actualMaterialCost = 0;

  for (const [materialId, r] of req.entries()) {
    if (r.needed <= 0) continue;
    const { cogs } = await issueStock(
      materialId,
      r.needed,
      { type: 'OUT_PRODUCTION', referenceType: 'ProductionOrder', referenceId: order.id, notes: order.orderNumber },
      actor,
    );
    actualMaterialCost += cogs;
  }

  const actualLaborCost = (bom.laborCost ?? 0) * order.totalQuantity;
  const totalActualCost = actualMaterialCost + actualLaborCost;

  await updateDoc(doc(getDb(), 'production_orders', order.id), {
    status: 'in_progress',
    actualMaterialCost,
    actualLaborCost,
    totalActualCost,
    updatedAt: serverTimestamp(),
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'STOCK_MOVE', entityType: 'ProductionOrder', entityId: order.id });
}

/**
 * İstehsalı tamamlayır (06 §6.6): qəbul edilmiş məhsulları hazır məhsul
 * anbarına variant (ölçü+grade) səviyyəsində əlavə edir, final per-unit maya hesablanır.
 */
export async function completeProduction(
  order: ProductionOrder,
  producedBySize: Record<string, number>,
  grade: 'A' | 'B',
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const totalProduced = Object.values(producedBySize).reduce((a, b) => a + b, 0);
  if (totalProduced <= 0) throw new Error('İstehsal miqdarı sıfırdır');

  const washingCost = order.washingCost ?? 0;
  const totalCost = (order.actualMaterialCost ?? 0) + (order.actualLaborCost ?? 0) + washingCost;
  const unitCost = totalCost / totalProduced;

  for (const [size, qty] of Object.entries(producedBySize)) {
    if (qty <= 0) continue;
    const variantSku = `${order.productSku ?? order.productId}-${size}-${grade}`;
    const fgQuery = await getDocs(query(collection(db, 'finished_goods'), where('variantSku', '==', variantSku)));
    const existingRef = fgQuery.docs[0]?.ref;

    if (existingRef) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(existingRef);
        const d = snap.data() as { currentStock?: number; reservedStock?: number };
        const newStock = (d.currentStock ?? 0) + qty;
        tx.update(existingRef, {
          currentStock: newStock,
          availableStock: newStock - (d.reservedStock ?? 0),
          unitCost,
          updatedAt: serverTimestamp(),
        });
      });
    } else {
      await addDoc(collection(db, 'finished_goods'), {
        productId: order.productId,
        productName: order.productName,
        variantSku,
        size,
        grade,
        currentStock: qty,
        reservedStock: 0,
        availableStock: qty,
        minStock: 0,
        maxStock: 0,
        reorderPoint: 0,
        unitCost,
        wholesalePrice: 0,
        retailPrice: 0,
        warehouseId: 'finished',
        updatedAt: serverTimestamp(),
      });
    }
  }

  await updateDoc(doc(db, 'production_orders', order.id), {
    status: 'completed',
    producedQuantity: totalProduced,
    totalActualCost: totalCost,
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    type: 'PRODUCTION_COMPLETED',
    severity: 'success',
    title: { az: `İstehsal tamamlandı (${order.orderNumber})`, en: `Production completed (${order.orderNumber})` },
    message: {
      az: `${order.productName} — ${totalProduced} ədəd hazır məhsul anbarına daxil edildi.`,
      en: `${order.productName} — ${totalProduced} units added to finished goods.`,
    },
    recipientRoles: ['director', 'sales'],
    entityType: 'ProductionOrder',
    entityId: order.id,
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'ProductionOrder', entityId: order.id });
}

/** Status dəyişmə köməkçisi (washing/qc keçidləri üçün) */
export async function setProductionStatus(orderId: string, status: ProductionOrder['status'], actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), 'production_orders', orderId), { status, updatedAt: serverTimestamp() });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'ProductionOrder', entityId: orderId });
}
