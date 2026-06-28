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

import type {
  MovementType, WashType, ProductFit, ProductionStatus, WashingStatus, BOMStatus,
  CustomerSegment, CustomerType, SalesOrderStatus, ExpenseCategory, ARAPStatus,
} from '@/types';

/** ƏDV dərəcəsi (09 §9.8, 14.6) */
export const VAT_RATE = 18;

export const CUSTOMER_TYPES: Record<CustomerType, string> = {
  wholesale: 'Topdan (B2B)',
  retail: 'Pərakəndə',
  distributor: 'Distribyutor',
};

export const CUSTOMER_SEGMENTS: Record<CustomerSegment, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  VIP: { label: 'VIP', variant: 'success' },
  new: { label: 'Yeni', variant: 'default' },
  high_volume: { label: 'Yüksək həcm', variant: 'default' },
  problem: { label: 'Problemli', variant: 'destructive' },
  regular: { label: 'Adi', variant: 'secondary' },
};

export const SALES_ORDER_STATUS_META: Record<SalesOrderStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  new: { label: 'Yeni', variant: 'secondary' },
  confirmed: { label: 'Təsdiqlənib (rezerv)', variant: 'default' },
  preparing: { label: 'Hazırlanır', variant: 'warning' },
  shipped: { label: 'Göndərilib', variant: 'warning' },
  delivered: { label: 'Çatdırılıb', variant: 'success' },
  cancelled: { label: 'Ləğv', variant: 'destructive' },
  returned: { label: 'Qaytarılıb', variant: 'destructive' },
};

export const ARAP_STATUS_META: Record<ARAPStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  open: { label: 'Açıq', variant: 'secondary' },
  partial: { label: 'Qismən', variant: 'warning' },
  paid: { label: 'Ödənilib', variant: 'success' },
  overdue: { label: 'Gecikib', variant: 'destructive' },
};

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  raw_material: 'Xam material',
  production: 'İstehsal',
  washing: 'Yuyulma',
  packaging: 'Qablaşdırma',
  salary: 'Əmək haqqı',
  rent: 'İcarə',
  utilities: 'Kommunal',
  transport: 'Nəqliyyat',
  marketing: 'Marketinq',
  bank_fees: 'Bank xərcləri',
  taxes: 'Vergilər',
  other: 'Digər',
};

export const CASH_IN_CATEGORIES = ['Müştəri ödənişi', 'Nağd satış (POS)', 'Bank köçürməsi', 'Digər gəlir'];
export const CASH_OUT_CATEGORIES = ['Supplier ödənişi', 'Əmək haqqı', 'Kommunal', 'Nəqliyyat', 'Yuyulma', 'Ofis xərcləri', 'Vergilər', 'Digər'];

/** Topdan endirim cədvəli (08 §8.3) — miqdara görə % */
export function tieredDiscount(qty: number): number {
  if (qty >= 200) return 15;
  if (qty >= 100) return 10;
  if (qty >= 50) return 5;
  return 0;
}


/** Yuyulma növləri + maksimal normal itki % (06 §6.4.1, 14.6 washTypeMaxLoss) */
export const WASH_TYPES: Record<WashType, { label: string; maxLoss: number }> = {
  rinse: { label: 'Rinse (minimal)', maxLoss: 3 },
  enzyme: { label: 'Enzyme (yumşaq fade)', maxLoss: 5 },
  stone: { label: 'Stone (vintage)', maxLoss: 7 },
  bleach: { label: 'Bleach (açıq)', maxLoss: 6 },
  acid: { label: 'Acid (mərmər)', maxLoss: 6 },
  heavy_stone: { label: 'Heavy Stone (çox köhnə)', maxLoss: 12 },
};

export const PRODUCT_FITS: Record<ProductFit, string> = {
  regular: 'Regular',
  slim: 'Slim',
  skinny: 'Skinny',
  loose: 'Loose',
};

export const PRODUCT_CATEGORIES = [
  { value: 'men', label: 'Kişi' },
  { value: 'women', label: 'Qadın' },
  { value: 'kids', label: 'Uşaq' },
] as const;

/** Tipik ölçü aralıqları (waist) */
export const SIZE_RANGES = ['28-30', '30-32', '32-34', '34-36', '36-38', '40-42'] as const;

export const PRODUCTION_STATUS_META: Record<ProductionStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  planned: { label: 'Planlaşdırılıb', variant: 'secondary' },
  material_check: { label: 'Material yoxlaması', variant: 'warning' },
  in_progress: { label: 'İstehsalda', variant: 'default' },
  in_washing: { label: 'Yuyulmada', variant: 'warning' },
  in_qc: { label: 'QC-də', variant: 'warning' },
  completed: { label: 'Tamamlanıb', variant: 'success' },
  cancelled: { label: 'Ləğv edilib', variant: 'destructive' },
};

export const WASHING_STATUS_META: Record<WashingStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' }> = {
  sent: { label: 'Göndərilib', variant: 'warning' },
  in_process: { label: 'Prosesdə', variant: 'warning' },
  returned: { label: 'Qayıdıb', variant: 'default' },
  closed: { label: 'Bağlanıb', variant: 'success' },
};

export const BOM_STATUS_META: Record<BOMStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' }> = {
  draft: { label: 'Qaralama', variant: 'secondary' },
  active: { label: 'Aktiv', variant: 'success' },
  archived: { label: 'Arxivlənib', variant: 'secondary' },
  obsolete: { label: 'Köhnəlib', variant: 'destructive' },
};

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
