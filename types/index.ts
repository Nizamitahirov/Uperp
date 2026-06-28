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

// ── Stok hərəkətləri (02 §2.3) ──────────────────────────────
export type MovementType =
  | 'IN_GRN'
  | 'OUT_PRODUCTION'
  | 'IN_RETURN_PROD'
  | 'OUT_RETURN_SUP'
  | 'ADJ_INVENTORY'
  | 'TRF_WAREHOUSE'
  | 'OUT_DISPOSAL'
  | 'OUT_SAMPLE';

export interface StockMovement {
  id: string;
  materialId: string;
  materialName?: string;
  type: MovementType;
  quantity: number; // + giriş, − çıxış
  unitCost: number;
  totalCost: number;
  balanceAfter: number;
  referenceType: 'PO' | 'GRN' | 'ProductionOrder' | 'Inventory' | 'Transfer' | 'Disposal';
  referenceId: string;
  warehouseId: string;
  batchNumber?: string;
  userId: string;
  username?: string;
  notes?: string;
  createdAt?: Timestamp | null;
}

/** raw_materials/{id}/cost_layers/{id} — FIFO təbəqəsi (02 §2.4.2) */
export interface CostLayer {
  id: string;
  materialId: string;
  grnId: string;
  receivedDate?: Timestamp | null;
  originalQty: number;
  remainingQty: number;
  unitCost: number; // landed cost
  isExhausted: boolean;
  createdAt?: Timestamp | null;
}

// ── Satınalma (05) ──────────────────────────────────────────
export type PoStatus =
  | 'draft'
  | 'approved'
  | 'sent_to_supplier'
  | 'confirmed'
  | 'shipped'
  | 'partially_received'
  | 'completed'
  | 'cancelled';

export interface POItem {
  materialId: string;
  materialName: string;
  materialCode?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // faiz
  lineTotal: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string;
  orderDate?: Timestamp | null;
  expectedDeliveryDate?: Timestamp | null;
  items: POItem[];
  subtotal: number;
  customsFee: number;
  shippingFee: number;
  insuranceFee: number;
  otherFees: number;
  currency: string;
  exchangeRate: number;
  totalAmount: number;
  totalAZN: number;
  landedCostAllocation: 'value' | 'quantity';
  incoterms?: string;
  notes?: string;
  status: PoStatus;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type GRNQualityStatus = 'approved' | 'partial' | 'rejected';

export interface GRNItem {
  materialId: string;
  materialName: string;
  unit: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unitPrice: number; // PO qiyməti
  landedUnitCost: number; // paylanmış xərclərlə
  batchNumber?: string;
  warehouseLocation?: string;
  defectNotes?: string;
}

export interface GRN {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber?: string;
  supplierId: string;
  supplierName?: string;
  receiptDate?: Timestamp | null;
  trackingNumber?: string;
  containerNumber?: string;
  carrier?: string;
  items: GRNItem[];
  qualityStatus: GRNQualityStatus;
  notes?: string;
  receivedBy?: string;
  posted: boolean; // stoka daxil edilibmi
  createdAt?: Timestamp | null;
}

// ── Bildirişlər (13 §13.2) ──────────────────────────────────
export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success' | 'action';

export interface AppNotification {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: { az: string; en: string };
  message: { az: string; en: string };
  recipientRoles: string[];
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  readBy: string[];
  createdAt?: Timestamp | null;
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
