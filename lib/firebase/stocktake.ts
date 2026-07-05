import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';
import { adjustInventory } from './stock';
import { nextNumber } from './counters';
import { logAudit } from './audit';
import type { StocktakeLine } from '@/types';

interface Actor {
  uid: string;
  username: string;
}

export interface StocktakeResult {
  id: string;
  number: string;
  adjusted: number;
  varianceValue: number;
}

/**
 * İnventarizasiyanı tətbiq edir (02 §2.6):
 * sayılmış hər sətir üçün faktiki miqdara uyğun stok düzəlişi (adjustInventory),
 * sonra tarixçə üçün stocktake sənədi yazır.
 */
export async function applyStocktake(
  lines: StocktakeLine[],
  opts: { note?: string; warehouseId?: string },
  actor: Actor,
): Promise<StocktakeResult> {
  const counted = lines.filter((l) => l.countedQty !== null && l.countedQty !== undefined);
  if (counted.length === 0) throw new Error('Ən azı bir material sayılmalıdır');

  let adjusted = 0;
  let varianceQtyAbs = 0;
  let varianceValue = 0;

  for (const l of counted) {
    const delta = (l.countedQty as number) - l.expectedQty;
    if (Math.abs(delta) < 1e-9) continue;
    await adjustInventory(l.materialId, l.countedQty as number, opts.note || 'İnventarizasiya düzəlişi', actor);
    adjusted += 1;
    varianceQtyAbs += Math.abs(delta);
    varianceValue += delta * (l.unitCost ?? 0);
  }

  const number = await nextNumber('STK');
  const ref = await addDoc(collection(getDb(), 'stocktakes'), {
    number,
    status: 'completed',
    warehouseId: opts.warehouseId ?? 'main',
    note: opts.note ?? null,
    lines: counted.map((l) => ({ ...l })),
    countedLines: counted.length,
    varianceQtyAbs: +varianceQtyAbs.toFixed(3),
    varianceValue: +varianceValue.toFixed(2),
    createdBy: actor.uid,
    createdByName: actor.username,
    createdAt: serverTimestamp(),
  });

  await logAudit({ userId: actor.uid, username: actor.username, action: 'STOCK_MOVE', entityType: 'RawMaterial', entityId: `stocktake:${number}` });

  return { id: ref.id, number, adjusted, varianceValue: +varianceValue.toFixed(2) };
}
