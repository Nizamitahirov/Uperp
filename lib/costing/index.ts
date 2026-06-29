/**
 * Costing köməkçiləri — FIFO/AVCO + Landed Cost (02 §2.4).
 * Bu fayl saf (pure) funksiyalardan ibarətdir; Firestore yazıları
 * `lib/firebase/stock.ts` daxilində transaction-larla aparılır.
 */

export interface LandedItem {
  quantity: number;
  unitPrice: number;
}

/**
 * Əlavə xərcləri (gömrük + daşıma + sığorta + digər) sətirlərə paylayır
 * və hər sətrin landed unit cost-unu qaytarır (02 §2.4.4).
 */
export function allocateLandedCost(
  items: LandedItem[],
  extraTotal: number,
  method: 'value' | 'quantity' = 'value',
): number[] {
  const denom =
    method === 'quantity'
      ? items.reduce((s, i) => s + i.quantity, 0)
      : items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return items.map((item) => {
    if (item.quantity <= 0) return item.unitPrice;
    if (denom <= 0 || extraTotal <= 0) return item.unitPrice;
    const weight = method === 'quantity' ? item.quantity : item.quantity * item.unitPrice;
    const allocated = extraTotal * (weight / denom);
    return item.unitPrice + allocated / item.quantity;
  });
}

export interface LayerLike {
  id: string;
  remainingQty: number;
  unitCost: number;
}

export interface FifoConsumption {
  layerId: string;
  qty: number;
  unitCost: number;
}

export interface FifoResult {
  totalCost: number;
  avgUnitCost: number;
  consumed: FifoConsumption[];
}

/**
 * FIFO çıxış hesablaması (02 §2.4.2). Layer-lər receivedDate ASC sırasında verilməlidir.
 * Yalnız hesablama aparır — qalıqları çağıran tərəf yeniləyir.
 */
export function fifoIssue(layers: LayerLike[], qtyNeeded: number): FifoResult {
  let remaining = qtyNeeded;
  let totalCost = 0;
  const consumed: FifoConsumption[] = [];

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(layer.remainingQty, remaining);
    if (take <= 0) continue;
    totalCost += take * layer.unitCost;
    consumed.push({ layerId: layer.id, qty: take, unitCost: layer.unitCost });
    remaining -= take;
  }

  if (remaining > 1e-9) {
    throw new Error('Kifayət qədər stok yoxdur (FIFO)');
  }

  return { totalCost, avgUnitCost: qtyNeeded > 0 ? totalCost / qtyNeeded : 0, consumed };
}

/** AVCO yeni orta maya (giriş zamanı, perpetual) — 02 §2.4.3 */
export function avcoReceive(currentStock: number, avgCost: number, qtyIn: number, unitCostIn: number): number {
  const newStock = currentStock + qtyIn;
  if (newStock <= 0) return unitCostIn;
  return (currentStock * avgCost + qtyIn * unitCostIn) / newStock;
}
