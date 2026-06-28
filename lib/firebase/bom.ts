import {
  addDoc,
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import { listDocs } from './firestore';
import type { BOM, BOMItem } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

/** BOM matris sətri (form state) */
export interface BomRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  unitCost: number;
  wastagePercentage: number;
  qtyBySize: Record<string, number>;
}

export interface BomCostInputs {
  rows: BomRow[];
  sizes: string[];
  laborCost: number;
  overheadPercentage: number;
  packagingCost: number;
}

/** Ölçü üzrə BOMItem siyahısı qurur */
export function buildSizeBasedItems(rows: BomRow[], sizes: string[]): Record<string, BOMItem[]> {
  const out: Record<string, BOMItem[]> = {};
  for (const size of sizes) {
    out[size] = rows.map((r) => {
      const quantity = r.qtyBySize[size] ?? 0;
      const totalQuantity = quantity * (1 + (r.wastagePercentage || 0) / 100);
      return {
        materialId: r.materialId,
        materialCode: r.materialCode,
        materialName: r.materialName,
        quantity,
        unit: r.unit,
        wastagePercentage: r.wastagePercentage || 0,
        totalQuantity,
        unitCost: r.unitCost,
        lineCost: totalQuantity * r.unitCost,
      };
    });
  }
  return out;
}

/** Maya dəyəri hesablaması (03 §3.4). materialCost = ölçülər üzrə orta. */
export function computeBomCost(inputs: BomCostInputs) {
  const { rows, sizes, laborCost, overheadPercentage, packagingCost } = inputs;
  const perSizeMaterial = sizes.map((size) =>
    rows.reduce((s, r) => {
      const qty = r.qtyBySize[size] ?? 0;
      const total = qty * (1 + (r.wastagePercentage || 0) / 100);
      return s + total * r.unitCost;
    }, 0),
  );
  const materialCost = perSizeMaterial.length ? perSizeMaterial.reduce((a, b) => a + b, 0) / perSizeMaterial.length : 0;
  const overhead = (materialCost + laborCost) * ((overheadPercentage || 0) / 100);
  const totalCost = materialCost + laborCost + overhead + (packagingCost || 0);
  return { materialCost, overhead, totalCost, perSizeMaterial };
}

/** Yeni BOM yaradır və məhsula bağlayır (cost + bomId) */
export async function createBOM(
  params: {
    productId: string;
    productName: string;
    sizes: string[];
    rows: BomRow[];
    laborCost: number;
    laborMinutes: number;
    overheadPercentage: number;
    packagingCost: number;
    status: 'draft' | 'active';
    notes?: string;
  },
  actor: Actor,
): Promise<string> {
  const db = getDb();
  const bomNumber = await nextNumber('BOM');
  const { materialCost, totalCost } = computeBomCost({
    rows: params.rows,
    sizes: params.sizes,
    laborCost: params.laborCost,
    overheadPercentage: params.overheadPercentage,
    packagingCost: params.packagingCost,
  });

  const data = {
    bomNumber,
    productId: params.productId,
    productName: params.productName,
    version: '1.0',
    status: params.status,
    sizeBasedItems: buildSizeBasedItems(params.rows, params.sizes),
    laborCost: params.laborCost,
    laborMinutes: params.laborMinutes,
    overheadPercentage: params.overheadPercentage,
    packagingCost: params.packagingCost,
    materialCost,
    totalCost,
    notes: params.notes || null,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'boms'), data);

  // Məhsula bağla (aktiv BOM-dursa cost yenilə)
  await updateDoc(doc(db, 'products', params.productId), {
    bomId: ref.id,
    cost: totalCost,
    updatedAt: serverTimestamp(),
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'BOM', entityId: ref.id });
  return ref.id;
}

/** Məhsulun aktiv BOM-unu gətirir */
export async function getActiveBOM(productId: string): Promise<BOM | null> {
  const boms = await listDocs<BOM>('boms', [
    where('productId', '==', productId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    limit(1),
  ]);
  return boms[0] ?? null;
}
