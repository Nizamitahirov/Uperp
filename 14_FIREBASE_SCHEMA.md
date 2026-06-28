# 14. FIREBASE DATA SCHEMA (Firestore)

> Bütün kolleksiyalar və əlaqələr. NoSQL — denormalizasiya tətbiq olunur.

---

## 14.1 KOLLEKSİYA SİYAHISI

```
users/                  # istifadəçilər
roles/                  # custom rollar
audit_logs/             # audit trail

warehouses/             # anbarlar
raw_materials/          # xam material
  └─ cost_layers/       # FIFO təbəqələri (subcollection)
stock_movements/        # bütün stok hərəkətləri

suppliers/              # təchizatçılar
customers/              # müştərilər
deals/                  # CRM pipeline
activities/             # CRM fəaliyyətlər

purchase_requests/      # PR
purchase_orders/        # PO
grns/                   # goods received notes

boms/                   # BOM-lar
products/               # məhsul kataloqu
finished_goods/         # hazır məhsul stok (variant)

production_orders/      # istehsal sifarişləri
washing_orders/         # yuyulma
qc_inspections/         # keyfiyyət nəzarəti

quotations/             # qiymət təklifi
sales_orders/           # satış sifarişi
deliveries/             # çatdırılma
pos_sales/              # POS satışları
sales_returns/          # geri qaytarma

cash_registers/         # kassalar
cash_transactions/      # kassa əməliyyatları
invoices/               # fakturalar
receivables/            # debitor (AR)
payables/               # kreditor (AP)
payment_receipts/       # ödəniş qəbzləri
expenses/               # xərclər

notifications/          # bildirişlər
settings/               # sistem parametrləri
exchange_rates/         # valyuta məzənnələri
```

---

## 14.2 ƏSAS KOLLEKSİYALAR (Schema)

### users/{uid}
```typescript
{
  uid: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;                // və ya roleId (custom)
  avatarUrl?: string;
  isActive: boolean;
  lastLogin?: Timestamp;
  createdAt: Timestamp;
  // notification settings
  notificationPrefs: { channels: string[], types: string[] };
}
```

### raw_materials/{id}
```typescript
{
  code, name, category, subCategory,
  attributes: {},
  unit, currentStock, minStock, maxStock, reorderPoint, moq,
  costingMethod: 'FIFO'|'AVCO',
  avgCost, lastPurchasePrice, currency, stockValue,
  primarySupplierId, alternativeSupplierIds: [], leadTimeDays,
  barcode, qrCode, imageUrls: [], documentUrls: [],
  isActive, createdAt, updatedAt
}
// subcollection: cost_layers/{layerId}
{ grnId, receivedDate, originalQty, remainingQty, unitCost, isExhausted }
```

### products/{id}
```typescript
{
  sku, modelCode,
  name: { az, en, ru },
  category, subCategory,
  colorCode, colorName, washEffect, materialType, weight,
  stretch, pocketType, fit, rise, season, collection,
  sizes: { waist: [], length: [] },
  wholesalePrice, retailPrice, cost, discountTiers: [],
  images: [{ url, type, isPrimary }],
  description: { az, en }, features: [], careInstructions: {},
  metaTitle, metaDescription, tags: [],
  bomId, status, createdAt
}
```

### finished_goods/{id}
```typescript
{
  productId, variantSku, size, color, grade,
  currentStock, reservedStock, availableStock,
  minStock, maxStock, reorderPoint,
  unitCost, wholesalePrice, retailPrice,
  warehouseId, locationCode, updatedAt
}
```

### production_orders/{id}
```typescript
{
  orderNumber, productId, bomId,
  sizeDistribution: { "28-30": 40, "32-34": 60 },
  totalQuantity, plannedStartDate, plannedEndDate, priority,
  status, stages: [],
  standardCost, actualMaterialCost, actualLaborCost,
  washingCost, totalActualCost,
  producedQuantity, defectQuantity, washingLossQuantity,
  createdBy, createdAt
}
```

### sales_orders/{id}
```typescript
{
  soNumber, customerId, channel, date,
  items: [{ variantSku, productName, size, color, quantity, unitPrice, discount, lineTotal }],
  subtotal, discountAmount, vatAmount, totalAmount,
  deliveryAddress, deliveryDate,
  paymentMethod, paymentStatus, paidAmount,
  status, createdBy
}
```

---

## 14.3 ƏLAQƏLƏR (Relations)

```
Supplier 1───* PurchaseOrder 1───* GRN *───1 RawMaterial
RawMaterial 1───* CostLayer
RawMaterial *───* BOM (BOMItem vasitəsilə)
Product 1───1 BOM
Product 1───* FinishedGoods (variant)
BOM 1───* ProductionOrder
ProductionOrder 1───* WashingOrder
ProductionOrder 1───* QCInspection
Customer 1───* SalesOrder
SalesOrder 1───* Delivery
SalesOrder 1───1 Invoice 1───1 Receivable
GRN 1───1 Payable
```

---

## 14.4 DENORMALİZASİYA STRATEGİYASI

> Firestore NoSQL — read performansı üçün təkrarlama

```
- raw_materials.currentStock (movement-lərdən denormalized)
- raw_materials.stockValue (auto-hesablanır)
- finished_goods.availableStock = currentStock − reservedStock
- sales_orders.items[].productName (snapshot)
- bom.items[].unitCost (snapshot yaradılma anında)
- customer.currentBalance (AR-dən denormalized)

Cloud Functions denormalized sahələri sinxron saxlayır.
```

---

## 14.5 İNDEKSLƏR (Firestore Indexes)

```
raw_materials: category + stockStatus, supplier + isActive
stock_movements: materialId + createdAt(desc)
sales_orders: customerId + date(desc), status + date
production_orders: status + plannedStartDate
notifications: recipientRoles(array) + isRead + createdAt(desc)
finished_goods: productId, availableStock(asc)
receivables: status + dueDate, customerId
```

---

## 14.6 SETTINGS (Global Parametrlər)

### settings/global
```typescript
{
  company: { name, logo, taxNumber, address, phone, email, bankDetails },
  defaultCostingMethod: 'FIFO' | 'AVCO',
  landedCostAllocation: 'value' | 'quantity',
  baseCurrency: 'AZN',
  vatRate: 18,
  numbering: {
    PO: { prefix: 'PO', format: 'PO-{YYYY}-{####}' },
    SO: { prefix: 'SO', format: 'SO-{YYYY}-{####}' },
    GRN: { prefix: 'GRN', format: 'GRN-{YYYY}-{####}' },
    // ...
  },
  markup: { wholesale: 1.1, retail: 1.9 },
  washTypeMaxLoss: { rinse: 3, enzyme: 5, stone: 7, heavy_stone: 12 },
}
```

---

**Növbəti fayl:** `15_DESIGN_SYSTEM.md` - UI/UX Dizayn Sistemi
