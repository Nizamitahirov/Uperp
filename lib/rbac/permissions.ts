/**
 * RBAC — Rol və Səlahiyyət Matrisi (01_AUTH_RBAC.md §1.2-1.3)
 *
 * Bu fayl built-in rolları, modulları və CRUD səlahiyyət matrisini müəyyən edir.
 * Firestore Security Rules ilə uyğun saxlanmalıdır (firestore.rules).
 */

export type RoleCode =
  | 'director'
  | 'accountant'
  | 'warehouse'
  | 'production'
  | 'sales'
  | 'cashier'
  | 'supply'
  | 'hr_manager'
  | 'customer';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve';

export type ModuleKey =
  | 'dashboard'
  | 'users'
  | 'roles'
  | 'raw_materials'
  | 'bom'
  | 'suppliers'
  | 'customers'
  | 'purchase_orders'
  | 'grn'
  | 'production_orders'
  | 'washing'
  | 'quality_control'
  | 'finished_goods'
  | 'products'
  | 'sales_orders'
  | 'pos'
  | 'cash'
  | 'invoices'
  | 'receivables'
  | 'payables'
  | 'finance'
  | 'reports'
  | 'notifications'
  | 'ai'
  | 'hr'
  | 'settings';

export interface RoleDefinition {
  code: RoleCode;
  name: string; // AZ
  level: number;
  description: string;
}

/** Built-in rollar (01 §1.2.1) */
export const ROLES: Record<RoleCode, RoleDefinition> = {
  director: { code: 'director', name: 'Direktor', level: 10, description: 'Tam idarəetmə, bütün modullar' },
  accountant: { code: 'accountant', name: 'Mühasib', level: 8, description: 'Maliyyə, mühasibatlıq, hesabatlar' },
  warehouse: { code: 'warehouse', name: 'Anbardar', level: 7, description: 'Material qəbulu, stok, inventarizasiya' },
  production: { code: 'production', name: 'İstehsalat Meneceri', level: 7, description: 'İstehsal, BOM, yuyulma, QC' },
  sales: { code: 'sales', name: 'Satış Meneceri', level: 7, description: 'Müştəri, sifariş, qiymət' },
  cashier: { code: 'cashier', name: 'Satıcı/Kassir', level: 4, description: 'POS, kassa, məhdud müştəri' },
  supply: { code: 'supply', name: 'Təchizat Meneceri', level: 7, description: 'Supplier, PO, GRN' },
  hr_manager: { code: 'hr_manager', name: 'HR Meneceri', level: 8, description: 'İşçilər, davamiyyət, məzuniyyət, əmək haqqı' },
  customer: { code: 'customer', name: 'Müştəri (B2B)', level: 1, description: 'Yalnız kataloq + öz sifarişləri' },
};

export const ALL_ROLE_CODES = Object.keys(ROLES) as RoleCode[];

type ActionSet = Set<PermissionAction>;

// Qısaltma helper-ləri
const C: PermissionAction[] = ['create'];
const R: PermissionAction[] = ['read'];
const CR: PermissionAction[] = ['create', 'read'];
const CRU: PermissionAction[] = ['create', 'read', 'update'];
const CRUD: PermissionAction[] = ['create', 'read', 'update', 'delete'];
const CRUDA: PermissionAction[] = ['create', 'read', 'update', 'delete', 'approve'];

/**
 * Səlahiyyət matrisi (01 §1.3.1).
 * `read(self)` kimi məhdud hallar UI səviyyəsində ['read'] kimi modelləşdirilir,
 * data filtrasiyası Firestore Rules-da tətbiq olunur.
 */
const MATRIX: Record<ModuleKey, Partial<Record<RoleCode, PermissionAction[]>>> = {
  dashboard: { director: CRUD, accountant: R, warehouse: R, production: R, sales: R, supply: R, hr_manager: R },
  users: { director: CRUD },
  roles: { director: CRUD },
  raw_materials: { director: CRUD, accountant: R, warehouse: CRUD, production: R, supply: CRUD },
  bom: { director: CRUD, accountant: R, warehouse: R, production: CRUD },
  suppliers: { director: CRUD, accountant: R, warehouse: R, supply: CRUD },
  customers: { director: CRUD, accountant: R, sales: CRUD, cashier: R, customer: R },
  purchase_orders: { director: CRUDA, accountant: R, warehouse: R, supply: CRUD },
  grn: { director: CRUD, accountant: R, warehouse: CRUD, production: R, supply: R },
  production_orders: { director: CRUD, accountant: R, warehouse: R, production: CRUD },
  washing: { director: CRUD, accountant: R, warehouse: R, production: CRUD },
  quality_control: { director: CRUD, accountant: R, warehouse: R, production: CRUD },
  finished_goods: { director: CRUD, accountant: R, warehouse: CRUD, production: CR, sales: R, cashier: R, customer: R },
  products: { director: CRUD, accountant: R, warehouse: R, production: CRU, sales: R, cashier: R, customer: R },
  sales_orders: { director: CRUD, accountant: R, sales: CRUD, cashier: CR, customer: CR },
  pos: { director: CRUD, accountant: R, sales: R, cashier: CRUD },
  cash: { director: CRUD, accountant: CRUD, cashier: CR },
  invoices: { director: CRUD, accountant: CRUD, sales: R, cashier: R, customer: R },
  receivables: { director: CRUD, accountant: CRUD, sales: R },
  payables: { director: CRUD, accountant: CRUD, supply: R },
  finance: { director: CRUD, accountant: CRUD },
  reports: { director: CRUD, accountant: CRUD, warehouse: R, production: R, sales: R, supply: R },
  notifications: { director: CRUD, accountant: R, warehouse: R, production: R, sales: R, cashier: R, supply: R },
  ai: { director: CRUD, accountant: R, warehouse: R, production: R, sales: R, cashier: R, supply: R, customer: R, hr_manager: R },
  hr: { director: CRUDA, accountant: R, hr_manager: CRUDA },
  settings: { director: CRUD, hr_manager: R },
};

/** Modul açarları (matris sırası ilə) */
export const MODULE_KEYS = Object.keys(MATRIX) as ModuleKey[];

/** Modul etiketləri (AZ) — Role Management görünüşü üçün */
export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'İdarə paneli',
  users: 'İstifadəçi idarəetməsi',
  roles: 'Rol idarəetməsi',
  raw_materials: 'Xam material',
  bom: 'BOM',
  suppliers: 'Təchizatçılar',
  customers: 'Müştərilər / CRM',
  purchase_orders: 'Satınalma (PO)',
  grn: 'GRN',
  production_orders: 'İstehsal sifarişləri',
  washing: 'Yuyulma',
  quality_control: 'Keyfiyyət nəzarəti',
  finished_goods: 'Hazır məhsul',
  products: 'Məhsul kataloqu',
  sales_orders: 'Satış sifarişləri',
  pos: 'POS',
  cash: 'Kassa',
  invoices: 'Fakturalar',
  receivables: 'Debitor (AR)',
  payables: 'Kreditor (AP)',
  finance: 'Maliyyə',
  reports: 'Hesabatlar',
  notifications: 'Bildirişlər',
  ai: 'AI Assistant',
  hr: 'İnsan Resursları (HR)',
  settings: 'Tənzimləmələr',
};

/**
 * Redaktə edilə bilən səlahiyyət matrisi (Firestore: settings/role_permissions).
 * Rol İdarəetməsi səhifəsindən dəyişdirilir; `setPermissionOverrides` ilə tətbiq olunur.
 * Boş massiv ([]) = "aşkar səlahiyyət yoxdur" (default-u ləğv edir).
 */
export type PermissionMatrix = Partial<Record<RoleCode, Partial<Record<ModuleKey, PermissionAction[]>>>>;

let OVERRIDES: PermissionMatrix | null = null;

/** AuthProvider və Rol İdarəetməsi tərəfindən çağırılır — cari sessiyaya override tətbiq edir */
export function setPermissionOverrides(overrides: PermissionMatrix | null): void {
  OVERRIDES = overrides;
  matrixCache.clear();
}

/** Default (kod daxilindəki) matris — reset üçün */
export function getDefaultPermissions(role: RoleCode, module: ModuleKey): PermissionAction[] {
  return MATRIX[module]?.[role] ?? [];
}

function resolveActions(role: RoleCode, module: ModuleKey): PermissionAction[] {
  const o = OVERRIDES?.[role]?.[module];
  if (o !== undefined) return o;
  return MATRIX[module]?.[role] ?? [];
}

/** Verilmiş rol üçün modula aid effektiv əməliyyat siyahısı (override + default) */
export function getPermissions(role: RoleCode, module: ModuleKey): PermissionAction[] {
  return resolveActions(role, module);
}

const matrixCache = new Map<string, ActionSet>();

function getActionSet(role: RoleCode, module: ModuleKey): ActionSet {
  const key = `${role}:${module}`;
  let set = matrixCache.get(key);
  if (!set) {
    set = new Set(resolveActions(role, module));
    matrixCache.set(key, set);
  }
  return set;
}

/** İstifadəçinin modul üzərində konkret əməliyyat səlahiyyətini yoxlayır */
export function can(role: RoleCode | undefined, module: ModuleKey, action: PermissionAction): boolean {
  if (!role) return false;
  return getActionSet(role, module).has(action);
}

/** İstifadəçinin modula ümumiyyətlə girişi varmı (ən azı read) */
export function canAccessModule(role: RoleCode | undefined, module: ModuleKey): boolean {
  if (!role) return false;
  return getActionSet(role, module).size > 0;
}

export function getRoleName(role: RoleCode | undefined): string {
  if (!role) return '—';
  return ROLES[role]?.name ?? role;
}
