import type { MaterialCategory } from '@/types';

/** Material kateqoriya etiketləri (AZ) — 02_RAW_MATERIAL.md (14 kateqoriya) */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  denim_fabric: 'Denim parça',
  lining: 'Astar',
  thread: 'Sap',
  zipper: 'Zəncir / Zamok',
  button: 'Düymə',
  rivet: 'Rivet',
  label: 'Etiket / Jakron',
  pocket_fabric: 'Cib parçası',
  interlining: 'Tərsüz (interlining)',
  elastic: 'Rezin',
  packaging: 'Qablaşdırma',
  chemical: 'Kimyəvi (yuyulma)',
  hardware: 'Aksesuar',
  other: 'Digər',
};

/** Ümumi ölçü vahidləri */
export const UNITS = ['metr', 'ədəd', 'kq', 'rulon', 'qutu', 'paket', 'litr', 'cüt'] as const;

import type { PoStatus } from '@/types';

/** PO status etiketləri və badge variantları (05 §5.3) */
export const PO_STATUS_META: Record<PoStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' }> = {
  draft: { label: 'Qaralama', variant: 'secondary' },
  approved: { label: 'Təsdiqlənib', variant: 'default' },
  sent_to_supplier: { label: 'Göndərilib', variant: 'default' },
  confirmed: { label: 'Təsdiqlənib (supplier)', variant: 'default' },
  shipped: { label: 'Yoldadır', variant: 'warning' },
  partially_received: { label: 'Qismən qəbul', variant: 'warning' },
  completed: { label: 'Tamamlanıb', variant: 'success' },
  cancelled: { label: 'Ləğv edilib', variant: 'destructive' },
};

/** Valyutalar */
export const CURRENCIES = ['AZN', 'USD', 'EUR', 'TRY', 'CNY'] as const;

import type { MovementType } from '@/types';

/** Stok hərəkət növü etiketləri (02 §2.3.1) */
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN_GRN: 'Qəbul (GRN)',
  OUT_PRODUCTION: 'İstehsala buraxılış',
  IN_RETURN_PROD: 'İstehsaldan qaytarma',
  OUT_RETURN_SUP: 'Təchizatçıya qaytarma',
  ADJ_INVENTORY: 'İnventarizasiya düzəlişi',
  TRF_WAREHOUSE: 'Anbar transferi',
  OUT_DISPOSAL: 'İmha / zay',
  OUT_SAMPLE: 'Nümunə',
};
