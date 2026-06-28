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
