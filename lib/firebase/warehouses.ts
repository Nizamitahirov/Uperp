import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDb } from './config';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import type { RawMaterial, Warehouse } from '@/types';

interface Actor { uid: string; username: string }

export async function createWarehouse(data: Omit<Warehouse, 'id' | 'createdAt'>, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), 'warehouses'), { ...data, createdAt: serverTimestamp() });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'CREATE', entityType: 'Warehouse', entityId: ref.id });
  return ref.id;
}

export async function updateWarehouse(id: string, data: Partial<Warehouse>, actor: Actor): Promise<void> {
  await updateDoc(doc(getDb(), 'warehouses', id), { ...data });
  await logAudit({ userId: actor.uid, username: actor.username, action: 'UPDATE', entityType: 'Warehouse', entityId: id });
}

export async function deleteWarehouse(id: string, actor: Actor): Promise<void> {
  await deleteDoc(doc(getDb(), 'warehouses', id));
  await logAudit({ userId: actor.uid, username: actor.username, action: 'DELETE', entityType: 'Warehouse', entityId: id });
}

/**
 * Anbarlararası transfer (02 §2.5). Ümumi stok dəyişmir — fiziki yerdəyişməni
 * sənədləşdirir və iki stok hərəkəti (TRF_WAREHOUSE çıxış/giriş) yazır.
 */
export async function createTransfer(
  params: { fromWarehouseId: string; fromWarehouseName?: string; toWarehouseId: string; toWarehouseName?: string; materialId: string; quantity: number; note?: string },
  actor: Actor,
): Promise<string> {
  if (params.fromWarehouseId === params.toWarehouseId) throw new Error('Mənbə və hədəf anbar eyni ola bilməz');
  if (params.quantity <= 0) throw new Error('Miqdar müsbət olmalıdır');

  const db = getDb();
  const matSnap = await getDoc(doc(db, 'raw_materials', params.materialId));
  const mat = matSnap.exists() ? (matSnap.data() as RawMaterial) : null;
  const unitCost = mat?.avgCost ?? 0;
  const balance = mat?.currentStock ?? 0;
  const number = await nextNumber('TRF');

  const ref = await addDoc(collection(db, 'stock_transfers'), {
    number,
    fromWarehouseId: params.fromWarehouseId,
    fromWarehouseName: params.fromWarehouseName ?? null,
    toWarehouseId: params.toWarehouseId,
    toWarehouseName: params.toWarehouseName ?? null,
    materialId: params.materialId,
    materialName: mat?.name ?? null,
    unit: mat?.unit ?? null,
    quantity: params.quantity,
    note: params.note ?? null,
    status: 'completed',
    createdBy: actor.uid,
    createdByName: actor.username,
    createdAt: serverTimestamp(),
  });

  // Audit üçün stok hərəkətləri (ümumi qalıq dəyişmir)
  const base = {
    materialId: params.materialId, materialName: mat?.name ?? '', type: 'TRF_WAREHOUSE' as const,
    unitCost, referenceType: 'Transfer' as const, referenceId: ref.id, userId: actor.uid, username: actor.username,
    notes: params.note ?? null, createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'stock_movements'), { ...base, quantity: -params.quantity, totalCost: -params.quantity * unitCost, balanceAfter: balance, warehouseId: params.fromWarehouseId });
  await addDoc(collection(db, 'stock_movements'), { ...base, quantity: params.quantity, totalCost: params.quantity * unitCost, balanceAfter: balance, warehouseId: params.toWarehouseId });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'STOCK_MOVE', entityType: 'RawMaterial', entityId: `transfer:${number}` });
  return ref.id;
}
