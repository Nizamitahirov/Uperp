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

// ── Məhsul kataloqu (10 §10.1) ──────────────────────────────
export type ProductFit = 'regular' | 'slim' | 'skinny' | 'loose';
export type ProductStatus = 'active' | 'draft' | 'archived';
export type WashType = 'rinse' | 'enzyme' | 'stone' | 'bleach' | 'acid' | 'heavy_stone';

export interface ProductImage {
  url: string;
  type: 'main' | 'back' | 'side' | 'detail' | 'model' | 'flat_lay';
  isPrimary: boolean;
}

export interface Product {
  id: string;
  sku: string;
  modelCode: string;
  name: { az: string; en: string };
  category: 'men' | 'women' | 'kids';
  subCategory?: string;
  colorCode?: string;
  colorName?: string;
  washEffect?: WashType;
  materialType?: string;
  weight?: string;
  stretch?: boolean;
  fit?: ProductFit;
  rise?: 'low' | 'mid' | 'high';
  season?: string;
  collection?: string;
  sizes?: string[]; // ölçü aralıqları, məs ["28-30","32-34"]
  wholesalePrice: number;
  retailPrice: number;
  cost: number; // BOM-dan
  images?: ProductImage[];
  description?: { az: string; en: string };
  features?: string[];
  tags?: string[];
  bomId?: string;
  status: ProductStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// ── BOM (03 §3.2) ───────────────────────────────────────────
export interface BOMItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercentage: number;
  totalQuantity: number; // quantity * (1 + wastage/100)
  unitCost: number; // snapshot
  lineCost: number;
}

export type BOMStatus = 'draft' | 'active' | 'archived' | 'obsolete';

export interface BOM {
  id: string;
  bomNumber: string;
  productId: string;
  productName?: string;
  version: string;
  status: BOMStatus;
  sizeBasedItems: Record<string, BOMItem[]>; // "28-30": [...]
  laborCost: number;
  laborMinutes: number;
  overheadPercentage: number;
  packagingCost: number;
  materialCost: number; // orta (ölçülər üzrə)
  totalCost: number;
  notes?: string;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// ── İstehsal (06 §6.2) ──────────────────────────────────────
export type ProductionStatus =
  | 'planned'
  | 'material_check'
  | 'in_progress'
  | 'in_washing'
  | 'in_qc'
  | 'completed'
  | 'cancelled';

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  productName?: string;
  productSku?: string;
  bomId: string;
  sizeDistribution: Record<string, number>; // "28-30": 40
  totalQuantity: number;
  plannedStartDate?: Timestamp | null;
  plannedEndDate?: Timestamp | null;
  priority: 'low' | 'normal' | 'high';
  status: ProductionStatus;
  standardCost: number;
  actualMaterialCost: number;
  actualLaborCost: number;
  washingCost: number;
  totalActualCost: number;
  producedQuantity?: number;
  defectQuantity?: number;
  washingLossQuantity?: number;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// ── Yuyulma (06 §6.4) ───────────────────────────────────────
export type WashingStatus = 'sent' | 'in_process' | 'returned' | 'closed';

export interface WashingOrder {
  id: string;
  washNumber: string;
  productionOrderId: string;
  productionOrderNumber?: string;
  washType: WashType;
  isOutsourced: boolean;
  laundryId?: string;
  laundryName?: string;
  pricePerPiece?: number;
  sentQuantity: number;
  sentDate?: Timestamp | null;
  expectedReturnDate?: Timestamp | null;
  returnedQuantity?: number;
  damagedQuantity?: number;
  returnDate?: Timestamp | null;
  lossQuantity?: number;
  lossPercentage?: number;
  shrinkageMeasured?: number;
  status: WashingStatus;
  cost: number;
  notes?: string;
  createdAt?: Timestamp | null;
}

// ── QC (06 §6.5) ────────────────────────────────────────────
export interface QCInspection {
  id: string;
  productionOrderId: string;
  productionOrderNumber?: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  defectQuantity: number;
  defects?: { type: string; count: number }[];
  grade: 'A' | 'B' | 'reject';
  inspector?: string;
  createdAt?: Timestamp | null;
}

// ── Hazır məhsul stoku (07 §7.1) ────────────────────────────
export interface FinishedGoodStock {
  id: string;
  productId: string;
  productName?: string;
  variantSku: string;
  size: string;
  color?: string;
  grade: 'A' | 'B';
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  unitCost: number;
  wholesalePrice: number;
  retailPrice: number;
  warehouseId?: string;
  locationCode?: string;
  updatedAt?: Timestamp | null;
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
