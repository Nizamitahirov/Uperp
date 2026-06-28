import type { Timestamp } from 'firebase/firestore';
import type { RoleCode } from '@/lib/rbac/permissions';

export type { RoleCode };

export type UserStatus = 'active' | 'inactive' | 'pending';

/** users/{uid} — 14.2 */
export interface AppUser {
  uid: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: RoleCode;
  avatarUrl?: string;
  isActive: boolean;
  status?: UserStatus;
  lastLogin?: Timestamp | null;
  createdAt?: Timestamp | null;
  notificationPrefs?: { channels: string[]; types: string[] };
}

/** Xam material kateqoriyaları (02_RAW_MATERIAL.md — 14 kateqoriya) */
export const MATERIAL_CATEGORIES = [
  'denim_fabric', // Denim parça
  'lining', // Astar
  'thread', // Sap
  'zipper', // Zəncir/zamok
  'button', // Düymə
  'rivet', // Rivet
  'label', // Etiket/jakron
  'pocket_fabric', // Cib parçası
  'interlining', // Tərsüz
  'elastic', // Rezin
  'packaging', // Qablaşdırma
  'chemical', // Yuyulma kimyəviləri
  'hardware', // Aksesuar
  'other', // Digər
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export type CostingMethod = 'FIFO' | 'AVCO';
export type StockStatus = 'ok' | 'low' | 'critical' | 'out';

/** raw_materials/{id} — 14.2 */
export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  subCategory?: string;
  attributes?: Record<string, string | number>;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock?: number;
  reorderPoint?: number;
  moq?: number;
  costingMethod: CostingMethod;
  avgCost: number;
  lastPurchasePrice?: number;
  currency: string;
  stockValue: number;
  primarySupplierId?: string;
  alternativeSupplierIds?: string[];
  leadTimeDays?: number;
  barcode?: string;
  imageUrls?: string[];
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type ContactType = 'company' | 'individual';

/** suppliers/{id} — 04_CONTACTS_CRM.md */
export interface Supplier {
  id: string;
  code: string;
  name: string;
  type: ContactType;
  taxNumber?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  paymentTerms?: string;
  currency: string;
  rating?: number;
  currentBalance?: number;
  isActive: boolean;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

/** audit_logs/{id} — 01 §1.5 */
export interface AuditLog {
  id: string;
  timestamp: Timestamp;
  userId: string;
  username: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'STOCK_MOVE';
  entityType: string;
  entityId: string;
  changes?: { before: unknown; after: unknown };
  ipAddress?: string;
  userAgent?: string;
}
