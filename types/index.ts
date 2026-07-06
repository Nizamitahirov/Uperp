import type { Timestamp } from 'firebase/firestore';
import type { RoleCode } from '@/lib/rbac/permissions';

export type { RoleCode };

export type UserStatus = 'active' | 'inactive' | 'pending';

/** Dinamik (custom) rol — roles/{id} (01 §1.2.2) */
export interface CustomRole {
  id: string;
  name: string;
  level: number;
  permissions: Record<string, string[]>; // module: actions
  customLimits?: { maxApprovalAmount?: number; canApproveDiscount?: boolean };
  isCustom: true;
  createdAt?: Timestamp | null;
}

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
  /** Anbar (warehouse doc id) → yerləşdirilmiş miqdar. Cəmi currentStock-dan az
   *  olan hissə "təyin edilməmiş" hovuzda sayılır (transfer ilə yerləşdirilir). */
  stockByWarehouse?: Record<string, number>;
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

/** İnventarizasiya (fiziki sayım) — 02 §2.6 */
export interface StocktakeLine {
  materialId: string;
  materialName: string;
  code?: string;
  unit: string;
  expectedQty: number;
  countedQty: number | null;
  unitCost: number;
}

export interface Stocktake {
  id: string;
  number: string;
  status: 'completed' | 'cancelled';
  scope?: 'raw' | 'finished';
  warehouseId?: string;
  note?: string;
  lines: StocktakeLine[];
  countedLines: number;
  varianceQtyAbs: number;
  varianceValue: number;
  createdBy: string;
  createdByName?: string;
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
export type PRStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'converted_to_po';

export interface PRItem {
  materialId: string;
  materialName: string;
  materialCode?: string;
  unit: string;
  quantity: number;
  estimatedPrice: number;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  requestedDate?: Timestamp | null;
  requiredDate?: Timestamp | null;
  priority: 'normal' | 'high' | 'urgent';
  reason: 'low_stock' | 'production_plan' | 'new_product' | 'manual';
  suggestedSupplierId?: string;
  suggestedSupplierName?: string;
  items: PRItem[];
  totalEstimated: number;
  status: PRStatus;
  convertedPoId?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

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

// ── Workflow / Avtomatlaşdırma (Power Automate üslubu) ──────
export type WorkflowTriggerType =
  | 'manual'
  | 'sales_order.created'
  | 'sales_order.status_changed'
  | 'purchase_order.created'
  | 'purchase_order.pending_approval'
  | 'expense.submitted'
  | 'grn.received'
  | 'production_order.created'
  | 'production_order.completed'
  | 'stock.issued'
  | 'stock.below_reorder'
  | 'cash.payment_out'
  | 'customer.created'
  | 'invoice.overdue'
  | 'catalog.published';

export type WorkflowActionType =
  | 'approval'
  | 'notify'
  | 'email'
  | 'assign'
  | 'update_status'
  | 'create_task'
  | 'ai_summary'
  | 'webhook'
  | 'delay';

export type WorkflowConditionOp = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';

export interface WorkflowCondition {
  field: string;
  op: WorkflowConditionOp;
  value: string;
}

export interface WorkflowStep {
  id: string;
  type: WorkflowActionType;
  assigneeType?: 'role' | 'user';
  assigneeRole?: string;
  assigneeUserId?: string;
  assigneeUserName?: string;
  message?: string;
  approvalLevel?: number;
  newStatus?: string;
  delayHours?: number;
  webhookUrl?: string;
  // email action
  emailTo?: string;        // konkret ünvan(lar), vergüllə
  emailToRole?: string;    // rol üzrə alıcı
  emailSubject?: string;
  condition?: WorkflowCondition | null;
}

export type WorkflowStatus = 'active' | 'draft' | 'paused';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger: WorkflowTriggerType;
  triggerCondition?: WorkflowCondition | null;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  /** Təsdiq rejimi — paralel (hamısı eyni anda) və ya ardıcıl */
  approvalMode?: 'parallel' | 'sequential';
  channels?: ('app' | 'email')[];
  runCount?: number;
  lastRunAt?: Timestamp | null;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// ── Katalog / Moda Jurnalı ──────────────────────────────────
export type CatalogStatus = 'draft' | 'published' | 'archived';

export interface Catalog {
  id: string;
  title: { az: string; en: string };
  subtitle?: string;
  season?: string;        // Mövsüm — məs. "Yaz-Yay 2026"
  collectionName?: string; // Kolleksiya adı
  issueNumber?: string;    // Buraxılış № — məs. "01"
  coverProductId?: string; // Üz qabığı modeli (boşdursa ilk məhsul)
  productIds: string[];    // Jurnaldakı məhsullar — sıralı
  status: CatalogStatus;
  publishedAt?: Timestamp | null;
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

// ── Anbarlar + anbarlararası transfer ───────────────────────
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: 'raw' | 'finished' | 'general';
  address?: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
}

export interface StockTransfer {
  id: string;
  number: string;
  fromWarehouseId: string;
  fromWarehouseName?: string;
  toWarehouseId: string;
  toWarehouseName?: string;
  materialId: string;
  materialName?: string;
  unit?: string;
  quantity: number;
  note?: string;
  status: 'completed';
  createdBy: string;
  createdByName?: string;
  createdAt?: Timestamp | null;
}

// ── Shop-floor əməliyyatları (istehsal mərhələləri) ─────────
export type OperationStage = 'cutting' | 'sewing' | 'washing' | 'ironing' | 'qc' | 'packing';
export type OperationStatus = 'pending' | 'in_progress' | 'done';

export interface ProductionOperation {
  stage: OperationStage;
  status: OperationStatus;
  targetQty: number;
  completedQty: number;
  operator?: string;
  note?: string;
  startedAt?: Timestamp | null;
  completedAt?: Timestamp | null;
}

export interface ProductionOperations {
  id: string; // = productionOrderId
  orderId: string;
  orderNumber?: string;
  totalQuantity: number;
  operations: ProductionOperation[];
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

// ── Müştəri + CRM (04) ──────────────────────────────────────
export type CustomerType = 'wholesale' | 'retail' | 'distributor';
export type CustomerSegment = 'VIP' | 'new' | 'high_volume' | 'problem' | 'regular';
export type CustomerStatus = 'active' | 'passive' | 'blacklist';

export interface Customer {
  id: string;
  code: string;
  type: CustomerType;
  name: string;
  companyName?: string;
  taxNumber?: string;
  authUid?: string;
  email?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  creditLimit: number;
  paymentTermDays: number;
  discountRate: number; // %
  currentBalance: number; // AR
  segment: CustomerSegment;
  tags?: string[];
  status: CustomerStatus;
  notes?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type DealStage = 'lead' | 'contacted' | 'quotation' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  id: string;
  customerId: string;
  customerName?: string;
  title: string;
  stage: DealStage;
  estimatedValue: number;
  probability: number;
  expectedCloseDate?: Timestamp | null;
  assignedTo?: string;
  notes?: string;
  createdAt?: Timestamp | null;
}

// ── Satış (08) ──────────────────────────────────────────────
export type SalesChannel = 'wholesale' | 'retail' | 'online';
export type SalesOrderStatus = 'new' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'credit';

export interface SalesOrderItem {
  variantSku: string;
  finishedGoodId: string;
  productName: string;
  size: string;
  grade?: string;
  quantity: number;
  unitPrice: number;
  discount: number; // %
  lineTotal: number;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  customerName?: string;
  channel: SalesChannel;
  date?: Timestamp | null;
  items: SalesOrderItem[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;
  deliveryAddress?: string;
  deliveryDate?: Timestamp | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  status: SalesOrderStatus;
  invoiceId?: string;
  reserved?: boolean;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type QuotationStatus = 'sent' | 'accepted' | 'rejected' | 'expired';

export interface Quotation {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName?: string;
  items: SalesOrderItem[];
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;
  validUntil?: Timestamp | null;
  status: QuotationStatus;
  convertedOrderId?: string;
  notes?: string;
  createdAt?: Timestamp | null;
}

export type DeliveryStatus = 'preparing' | 'in_transit' | 'delivered' | 'returned';

export interface Delivery {
  id: string;
  deliveryNumber: string;
  salesOrderId: string;
  soNumber?: string;
  customerName?: string;
  date?: Timestamp | null;
  courier?: string;
  packagesCount?: number;
  status: DeliveryStatus;
  createdAt?: Timestamp | null;
}

export interface POSItem {
  variantSku: string;
  finishedGoodId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface POSSale {
  id: string;
  receiptNumber: string;
  cashierId: string;
  cashierName?: string;
  customerId?: string;
  items: POSItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  amountReceived: number;
  change: number;
  registerId?: string;
  createdAt?: Timestamp | null;
}

// ── Kassa (08 §8.6) ─────────────────────────────────────────
export interface CashRegister {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'pos_terminal';
  currency: string;
  currentBalance: number;
  isActive: boolean;
  createdAt?: Timestamp | null;
}

export interface CashTransaction {
  id: string;
  registerId: string;
  registerName?: string;
  type: 'in' | 'out';
  category: string;
  amount: number;
  currency: string;
  description?: string;
  referenceType?: string;
  referenceId?: string;
  userId?: string;
  username?: string;
  createdAt?: Timestamp | null;
}

// ── Maliyyə (09) ────────────────────────────────────────────
export type ARAPStatus = 'open' | 'partial' | 'paid' | 'overdue';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'sales' | 'purchase';
  customerId?: string;
  customerName?: string;
  salesOrderId?: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: PaymentStatus;
  dueDate?: Timestamp | null;
  createdAt?: Timestamp | null;
}

export interface Receivable {
  id: string;
  customerId: string;
  customerName?: string;
  invoiceId: string;
  invoiceNumber?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate?: Timestamp | null;
  status: ARAPStatus;
  createdAt?: Timestamp | null;
}

export interface Payable {
  id: string;
  supplierId: string;
  supplierName?: string;
  purchaseOrderId: string;
  grnId?: string;
  invoiceNumber?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate?: Timestamp | null;
  status: ARAPStatus;
  createdAt?: Timestamp | null;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName?: string;
  amount: number;
  method: 'cash' | 'transfer' | 'card';
  appliedInvoices?: { invoiceId: string; amount: number }[];
  createdAt?: Timestamp | null;
}

export type ExpenseCategory =
  | 'raw_material' | 'production' | 'washing' | 'packaging'
  | 'salary' | 'rent' | 'utilities' | 'transport'
  | 'marketing' | 'bank_fees' | 'taxes' | 'other';

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  paymentMethod: string;
  description?: string;
  approvalStatus: 'submitted' | 'approved' | 'paid';
  createdAt?: Timestamp | null;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  soNumber?: string;
  customerId?: string;
  customerName?: string;
  items: { variantSku: string; finishedGoodId?: string; quantity: number; reason: string }[];
  reason: 'defective' | 'wrong_size' | 'customer_request' | 'other';
  returnType: 'refund' | 'exchange' | 'store_credit';
  refundAmount?: number;
  status: 'pending' | 'approved' | 'completed';
  restockable: boolean;
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

// ═══════════════════════════════════════════════════════════
// İNSAN RESURSLARI & ƏMƏK HAQQI (HR & Payroll)
// ═══════════════════════════════════════════════════════════

export interface Department {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  managerId?: string | null;
  managerName?: string;
  createdAt?: Timestamp | null;
}

export interface Position {
  id: string;
  title: string;
  departmentId?: string | null;
  departmentName?: string;
  level?: number;
  baseSalaryMin?: number;
  baseSalaryMax?: number;
  createdAt?: Timestamp | null;
}

export type EmployeeStatus = 'active' | 'probation' | 'on_leave' | 'suspended' | 'terminated';
export type ContractType = 'permanent' | 'fixed_term' | 'part_time' | 'intern';
export type PayType = 'monthly' | 'daily' | 'hourly' | 'piece_rate';

export interface SalaryComponent {
  name: string;
  amount: number;
  type: 'allowance' | 'deduction';
}

export interface Employee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl?: string;
  gender?: 'male' | 'female' | 'other';
  birthDate?: Timestamp | null;
  nationalId?: string; // FIN / şəxsiyyət
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  // İş məlumatları
  departmentId?: string | null;
  departmentName?: string;
  positionId?: string | null;
  positionTitle?: string;
  managerId?: string | null;
  hireDate?: Timestamp | null;
  contractType: ContractType;
  contractEndDate?: Timestamp | null;
  status: EmployeeStatus;
  workLocation?: string;
  // Əmək haqqı strukturu
  payType: PayType;
  baseSalary: number; // aylıq brüt (və ya günlük/saatlıq dərəcə)
  pieceRates?: Record<string, number>; // əməliyyat (stage) → ədəd başına ₼
  allowances?: SalaryComponent[];
  deductions?: SalaryComponent[];
  bankName?: string;
  iban?: string;
  // Məzuniyyət
  annualLeaveEntitlement?: number; // illik gün
  leaveBalance?: number; // qalan gün
  // ESS bağı
  userId?: string | null;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: 'contract' | 'id' | 'certificate' | 'diploma' | 'medical' | 'other';
  name: string;
  url: string;
  expiryDate?: Timestamp | null;
  createdAt?: Timestamp | null;
}
