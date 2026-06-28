# 05. SATINALMA (PR → PO → GRN)

> Modullar: #12 PO, #13 GRN, satınalma dövrü

---

## 5.1 SATINALMA AXINI

```
Purchase Request (PR) → Approval → Purchase Order (PO)
    → Send to Supplier → Confirmation → Shipment
    → Customs → GRN (Goods Received Note) → QC
    → Stock In → Invoice Match (3-way) → Payment → Closed
```

---

## 5.2 PURCHASE REQUEST (Alış Tələbi)

### Avtomatik PR yaranır əgər:
- Material stoku `reorderPoint`-ə çatır
- İstehsal planında material çatışmazlığı var

### Data model
```typescript
interface PurchaseRequest {
  id: string;
  prNumber: string;          // PR-2026-0245
  requestedDate: Timestamp;
  requiredDate: Timestamp;
  priority: 'normal' | 'high' | 'urgent';
  reason: 'low_stock' | 'production_plan' | 'new_product' | 'manual';
  suggestedSupplierId?: string;
  items: PRItem[];
  totalEstimated: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'converted_to_po';
  approvalChain: Approval[];
  createdBy: string;
}
```

### Təsdiq axını (approval)
```
Təchizat Meneceri → Maliyyə (>2000 AZN) → Direktor (>5000 AZN)
```

---

## 5.3 PURCHASE ORDER (PO)

### Data model
```typescript
interface PurchaseOrder {
  id: string;
  poNumber: string;          // PO-2026-0045
  supplierId: string;
  orderDate: Timestamp;
  expectedDeliveryDate: Timestamp;
  purchaseRequestId?: string;

  items: POItem[];           // material, qty, unitPrice, discount

  // Xərclər (landed cost üçün)
  subtotal: number;
  customsFee: number;
  shippingFee: number;
  insuranceFee: number;
  otherFees: number;
  currency: string;
  exchangeRate: number;      // AZN-ə çevirmə
  totalAmount: number;
  totalAZN: number;

  // Ödəniş şərtləri
  paymentTerms: {
    method: 'TT' | 'LC' | 'cash';
    advancePercentage: number;
    advanceDays: number;
    balanceTerms: string;
    balanceDays: number;
  };
  incoterms: string;

  qualityRequirements?: string;
  notes?: string;

  status: PoStatus;          // aşağıda
  receivedItems?: ReceivedSummary;  // GRN-lərdən
  createdBy: string;
}

type PoStatus =
  | 'draft' | 'pending_approval' | 'approved'
  | 'sent_to_supplier' | 'confirmed' | 'in_production'
  | 'shipped' | 'in_customs' | 'partially_received'
  | 'completed' | 'cancelled';
```

### PO PDF + Email
```
- Avtomatik PO PDF (şirkət logo, items, şərtlər)
- Supplier-ə email (PDF əlavə)
- AI (Groq): email mətni AZ/EN draft
- Tracking link
```

### PO Detay (tablar)
```
1. Ümumi (items, xərclər)
2. Tarixçə/Status (timeline)
3. GRN-lər (qəbullar)
4. Ödənişlər (avans/qalıq)
5. Sənədlər (invoice, B/L, COO, COA)
6. Email/kommunikasiya
```

### Amendment (Reviziya)
```
Təsdiqlənmiş PO dəyişikliyi → yeni revision (Rev.2)
Təsdiq yenidən → Supplier-ə amendment email
```

---

## 5.4 GRN — GOODS RECEIVED NOTE (Material Qəbulu)

> Modul #13. Bu, stoka giriş və FIFO cost layer yaradan kritik sənəddir.

### GRN Axını (7 addım)
```
1. PO seç (shipped/confirmed olanlar)
2. Göndəriş məlumatı (tracking, container, daşıyıcı)
3. Material yoxlama (sifariş vs qəbul vs qüsur)
4. Keyfiyyət nəzarəti (QC)
5. Partiya + anbar yerləşmə (batch, location)
6. Sənədlər (packing list, invoice, COA upload)
7. Təsdiq → stoka daxil
```

### Data model
```typescript
interface GRN {
  id: string;
  grnNumber: string;         // GRN-2026-0123 (RC)
  purchaseOrderId: string;
  supplierId: string;
  receiptDate: Timestamp;

  // Göndəriş
  trackingNumber?: string;
  containerNumber?: string;
  carrier?: string;
  driver?: string;
  driverPhone?: string;

  items: GRNItem[];
  documents: string[];

  qualityStatus: 'approved' | 'partial' | 'rejected';
  receivedBy: string;
  createdAt: Timestamp;
}

interface GRNItem {
  materialId: string;
  poItemId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  defectType?: string;
  defectNotes?: string;
  defectAction?: 'return' | 'discount' | 'replace';
  batchNumber?: string;
  productionDate?: Timestamp;
  expiryDate?: Timestamp;
  warehouseLocation: string;
  landedUnitCost: number;    // qiymət + paylanmış xərclər
}
```

### GRN təsdiqindən sonra (avtomatik):
```javascript
exports.onGRNConfirmed = functions.firestore
  .document('grns/{grnId}')
  .onCreate(async (snap) => {
    const grn = snap.data();
    for (const item of grn.items) {
      // 1. Landed cost hesabla (PO xərclərini payla)
      const landedCost = calcLandedCost(item, grn.purchaseOrderId);

      // 2. FIFO cost layer yarat (və ya AVCO orta yenilə)
      await createCostLayer({
        materialId: item.materialId,
        grnId: grn.id,
        qty: item.acceptedQuantity,
        unitCost: landedCost,
      });

      // 3. Stok artır
      await incrementStock(item.materialId, item.acceptedQuantity);

      // 4. StockMovement (IN_GRN)
      await createMovement({ type: 'IN_GRN', ... });

      // 5. Qüsurlu → return to supplier (varsa)
      if (item.rejectedQuantity > 0) await createReturnRMA(item);
    }
    // 6. PO status yenilə (partial/completed)
    await updatePOStatus(grn.purchaseOrderId);
    // 7. GRN PDF
    await generateGRNPdf(grn.id);
    // 8. Maliyyəyə bildiriş (AP)
    await notifyFinanceAP(grn);
  });
```

### 3-Way Matching (best practice)
```
PO ↔ GRN ↔ Supplier Invoice
3 sənəd üzləşdirilir → fərq varsa ödəniş bloklanır
Overpayment qarşısı alınır
```

---

**Növbəti fayl:** `06_PRODUCTION_WASHING.md` - İstehsal (MES) + Yuyulma
