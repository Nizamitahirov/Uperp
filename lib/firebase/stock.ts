import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { getDb } from './config';
import { avcoReceive, fifoIssue, type LayerLike } from '@/lib/costing';
import { checkStockLevel, createNotification } from './notifications';
import { logAudit } from './audit';
import type { GRN, MovementType, RawMaterial } from '@/types';

const DEFAULT_WAREHOUSE = 'main';

interface Actor {
  uid: string;
  username: string;
}

/**
 * GRN-i stoka daxil edir (05 §5.4 pipeline, client-side transaction):
 * hər qəbul edilmiş material üçün → cost layer + stok artımı + IN_GRN movement.
 * AVCO materiallarda moving average yenilənir.
 */
export async function postGRN(grn: GRN, actor: Actor): Promise<void> {
  const db = getDb();

  for (const item of grn.items) {
    const qty = item.acceptedQuantity;
    if (!qty || qty <= 0) continue;

    const matRef = doc(db, 'raw_materials', item.materialId);
    const layerRef = doc(collection(db, `raw_materials/${item.materialId}/cost_layers`));
    const moveRef = doc(collection(db, 'stock_movements'));

    await runTransaction(db, async (tx) => {
      const matSnap = await tx.get(matRef);
      if (!matSnap.exists()) throw new Error(`Material tapılmadı: ${item.materialId}`);
      const m = matSnap.data() as RawMaterial;

      const oldStock = m.currentStock ?? 0;
      const oldValue = m.stockValue ?? oldStock * (m.avgCost ?? 0);
      const newStock = oldStock + qty;
      const newValue = oldValue + qty * item.landedUnitCost;

      const newAvg =
        m.costingMethod === 'AVCO'
          ? avcoReceive(oldStock, m.avgCost ?? 0, qty, item.landedUnitCost)
          : newStock > 0
            ? newValue / newStock
            : item.landedUnitCost;

      // FIFO cost layer (AVCO-da da audit üçün saxlanır)
      tx.set(layerRef, {
        materialId: item.materialId,
        grnId: grn.id,
        originalQty: qty,
        remainingQty: qty,
        unitCost: item.landedUnitCost,
        isExhausted: false,
        receivedDate: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      tx.update(matRef, {
        currentStock: newStock,
        avgCost: newAvg,
        lastPurchasePrice: item.unitPrice,
        stockValue: newStock * newAvg,
        updatedAt: serverTimestamp(),
      });

      tx.set(moveRef, {
        materialId: item.materialId,
        materialName: m.name,
        type: 'IN_GRN' as MovementType,
        quantity: qty,
        unitCost: item.landedUnitCost,
        totalCost: qty * item.landedUnitCost,
        balanceAfter: newStock,
        referenceType: 'GRN',
        referenceId: grn.id,
        warehouseId: DEFAULT_WAREHOUSE,
        batchNumber: item.batchNumber ?? null,
        userId: actor.uid,
        username: actor.username,
        createdAt: serverTimestamp(),
      });
    });
  }

  await logAudit({
    userId: actor.uid,
    username: actor.username,
    action: 'STOCK_MOVE',
    entityType: 'GRN',
    entityId: grn.id,
  });

  // GRN qəbul bildirişi (13.1)
  await createNotification({
    type: 'GRN_RECEIVED',
    severity: 'success',
    title: { az: `Material qəbul edildi (${grn.grnNumber})`, en: `Goods received (${grn.grnNumber})` },
    message: {
      az: `${grn.poNumber ?? ''} üzrə material anbara daxil edildi.`,
      en: `Materials for ${grn.poNumber ?? ''} have been received into stock.`,
    },
    recipientRoles: ['accountant', 'production', 'director'],
    entityType: 'GRN',
    entityId: grn.id,
  });
}

/**
 * Stokdan material buraxır (FIFO/AVCO). İstehsal, imha, nümunə və s. üçün.
 * FIFO-da köhnə layer-lərdən tükəndirir; AVCO-da cari orta maya istifadə olunur.
 */
export async function issueStock(
  materialId: string,
  qty: number,
  opts: { type?: MovementType; referenceType?: string; referenceId?: string; notes?: string },
  actor: Actor,
): Promise<{ cogs: number }> {
  if (qty <= 0) throw new Error('Miqdar müsbət olmalıdır');
  const db = getDb();
  const matRef = doc(db, 'raw_materials', materialId);

  // FIFO üçün aktiv layer-ləri əvvəlcədən sıralayıb gətiririk (tx query dəstəkləmir)
  const layersCol = collection(db, `raw_materials/${materialId}/cost_layers`);
  const layerSnap = await getDocs(
    query(layersCol, where('isExhausted', '==', false), orderBy('createdAt', 'asc')),
  );
  const layerRefs = layerSnap.docs.map((d) => doc(db, `raw_materials/${materialId}/cost_layers`, d.id));
  const moveRef = doc(collection(db, 'stock_movements'));

  const result = await runTransaction(db, async (tx) => {
    const matSnap = await tx.get(matRef);
    if (!matSnap.exists()) throw new Error('Material tapılmadı');
    const m = matSnap.data() as RawMaterial;
    const oldStock = m.currentStock ?? 0;
    if (oldStock < qty) throw new Error('Kifayət qədər stok yoxdur');

    let cogs: number;
    let unitCost: number;

    if (m.costingMethod === 'FIFO') {
      const liveLayers: LayerLike[] = [];
      const refById = new Map<string, ReturnType<typeof doc>>();
      for (const ref of layerRefs) {
        const ls = await tx.get(ref);
        if (!ls.exists()) continue;
        const data = ls.data();
        if (data.isExhausted || (data.remainingQty ?? 0) <= 0) continue;
        liveLayers.push({ id: ref.id, remainingQty: data.remainingQty, unitCost: data.unitCost });
        refById.set(ref.id, ref);
      }
      const fifo = fifoIssue(liveLayers, qty);
      cogs = fifo.totalCost;
      unitCost = fifo.avgUnitCost;
      // layer qalıqlarını yenilə
      for (const c of fifo.consumed) {
        const ref = refById.get(c.layerId)!;
        const layer = liveLayers.find((l) => l.id === c.layerId)!;
        const remaining = layer.remainingQty - c.qty;
        tx.update(ref, { remainingQty: remaining, isExhausted: remaining <= 1e-9 });
      }
    } else {
      unitCost = m.avgCost ?? 0;
      cogs = qty * unitCost;
    }

    const newStock = oldStock - qty;
    const newValue = Math.max(0, (m.stockValue ?? 0) - cogs);
    tx.update(matRef, {
      currentStock: newStock,
      stockValue: newValue,
      updatedAt: serverTimestamp(),
    });

    tx.set(moveRef, {
      materialId,
      materialName: m.name,
      type: opts.type ?? 'OUT_PRODUCTION',
      quantity: -qty,
      unitCost,
      totalCost: cogs,
      balanceAfter: newStock,
      referenceType: opts.referenceType ?? 'ProductionOrder',
      referenceId: opts.referenceId ?? '',
      warehouseId: DEFAULT_WAREHOUSE,
      userId: actor.uid,
      username: actor.username,
      notes: opts.notes ?? null,
      createdAt: serverTimestamp(),
    });

    return { cogs, newStock, name: m.name, minStock: m.minStock ?? 0, reorderPoint: m.reorderPoint };
  });

  await logAudit({
    userId: actor.uid,
    username: actor.username,
    action: 'STOCK_MOVE',
    entityType: 'RawMaterial',
    entityId: materialId,
  });

  // Çıxışdan sonra stok səviyyəsini yoxla (low/out bildirişi)
  await checkStockLevel({
    id: materialId,
    name: result.name,
    currentStock: result.newStock,
    minStock: result.minStock,
    reorderPoint: result.reorderPoint,
  });

  return { cogs: result.cogs };
}

/**
 * İnventarizasiya düzəlişi (02 §2.6): faktiki sayım nəticəsinə uyğunlaşdırma.
 * Müsbət fərq cari orta maya ilə layer kimi əlavə olunur, mənfi fərq issue edilir.
 */
export async function adjustInventory(
  materialId: string,
  countedQty: number,
  reason: string,
  actor: Actor,
): Promise<void> {
  const db = getDb();
  const matRef = doc(db, 'raw_materials', materialId);
  const moveRef = doc(collection(db, 'stock_movements'));

  await runTransaction(db, async (tx) => {
    const matSnap = await tx.get(matRef);
    if (!matSnap.exists()) throw new Error('Material tapılmadı');
    const m = matSnap.data() as RawMaterial;
    const oldStock = m.currentStock ?? 0;
    const delta = countedQty - oldStock;
    if (Math.abs(delta) < 1e-9) return;

    const unitCost = m.avgCost ?? 0;
    tx.update(matRef, {
      currentStock: countedQty,
      stockValue: countedQty * unitCost,
      updatedAt: serverTimestamp(),
    });
    tx.set(moveRef, {
      materialId,
      materialName: m.name,
      type: 'ADJ_INVENTORY' as MovementType,
      quantity: delta,
      unitCost,
      totalCost: delta * unitCost,
      balanceAfter: countedQty,
      referenceType: 'Inventory',
      referenceId: '',
      warehouseId: DEFAULT_WAREHOUSE,
      userId: actor.uid,
      username: actor.username,
      notes: reason,
      createdAt: serverTimestamp(),
    });
  });

  await logAudit({
    userId: actor.uid,
    username: actor.username,
    action: 'STOCK_MOVE',
    entityType: 'RawMaterial',
    entityId: materialId,
  });
}
