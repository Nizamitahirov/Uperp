import type { RawMaterial, StockStatus } from '@/types';

/** Stok statusunu hesablayır (15.7) */
export function getStockStatus(m: Pick<RawMaterial, 'currentStock' | 'minStock' | 'reorderPoint'>): StockStatus {
  const stock = m.currentStock ?? 0;
  const min = m.minStock ?? 0;
  const reorder = m.reorderPoint ?? min;
  if (stock <= 0) return 'out';
  if (stock <= min) return 'critical';
  if (stock <= reorder) return 'low';
  return 'ok';
}

export const STOCK_STATUS_META: Record<StockStatus, { label: string; className: string; dot: string }> = {
  ok: { label: 'Normal', className: 'bg-green-100 text-green-700', dot: '🟢' },
  low: { label: 'Aşağı', className: 'bg-yellow-100 text-yellow-700', dot: '🟡' },
  critical: { label: 'Kritik', className: 'bg-red-100 text-red-700', dot: '🔴' },
  out: { label: 'Bitib', className: 'bg-gray-200 text-gray-700', dot: '⚫' },
};
