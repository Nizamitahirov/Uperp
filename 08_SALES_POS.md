# 08. SATIŞ, SİFARİŞ, POS, KASSA

> Modullar: #11 Sifariş, #14 Kassa, #15 POS

---

## 8.1 SATIŞ KANALLARI

```
1. B2B Topdan (Wholesale) — Sales Order, faktura, kredit
2. B2C Pərakəndə (Retail) — POS, nağd/kart
3. Online B2B — Gmail ilə girən müştəri kataloqdan sifariş
```

---

## 8.2 QİYMƏT TƏKLİFİ (Quotation)

```typescript
interface Quotation {
  id: string;
  quoteNumber: string;       // QT-2026-0034
  customerId: string;
  date: Timestamp;
  validUntil: Timestamp;
  items: { variantSku, qty, unitPrice, discount }[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  status: 'sent' | 'accepted' | 'rejected' | 'expired';
  notes?: string;
}
```
AI (Groq): təklif mətni AZ/EN, PDF.

---

## 8.3 SATIŞ SİFARİŞİ (Sales Order)

```typescript
interface SalesOrder {
  id: string;
  soNumber: string;          // SO-2026-0156
  customerId: string;
  channel: 'wholesale' | 'retail' | 'online';
  date: Timestamp;

  items: SalesOrderItem[];

  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  totalAmount: number;

  // Çatdırılma
  deliveryAddress: Address;
  deliveryDate?: Timestamp;

  // Ödəniş
  paymentMethod: 'cash' | 'transfer' | 'card' | 'credit';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paidAmount: number;

  status: SalesOrderStatus;
  createdBy: string;
}

type SalesOrderStatus =
  | 'new' | 'confirmed' | 'preparing'
  | 'shipped' | 'delivered' | 'cancelled' | 'returned';

interface SalesOrderItem {
  variantSku: string;
  productName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}
```

### Sifariş axını
```
Yeni → Təsdiq (stok rezerv) → Hazırlanır → Göndərilir → Çatdırılır
       ↓
   availableStock azalır (rezerv)
       ↓
   Çatdırılanda currentStock azalır + faktura + AR
```

### Endirim qaydaları (tiered)
```
Topdan endirim cədvəli (məhsuldan):
10-49 ədəd: 0%
50-99: 5%
100-199: 10%
200+: 15%

Müştəri xüsusi endirimi (Customer.discountRate) əlavə
```

---

## 8.4 ÇATDIRILMA (Delivery)

```typescript
interface Delivery {
  id: string;
  deliveryNumber: string;
  salesOrderId: string;
  date: Timestamp;
  courier?: string;
  packages: { count, weight }[];
  status: 'preparing' | 'in_transit' | 'delivered' | 'returned';
  proofOfDelivery?: string;  // imza/foto
}
```
Yüklənmə vərəqi (packing list) PDF avtomatik.

---

## 8.5 POS (Point of Sale) — Modul #15

> Pərakəndə satış üçün sürətli interfeys. Mobile/tablet-friendly.

### POS İnterfeysi
```
┌─────────────────────────────────────────────┐
│ [🔍 Barkod/Axtarış]      Müştəri: [seç/yox] │
├──────────────────────┬──────────────────────┤
│  MƏHSUL GRID         │  SƏBƏT                │
│  [şəkil] Classic 32  │  Classic 32  ×2  $178 │
│  $89                 │  Slim 30     ×1  $79  │
│  [şəkil] Slim 30     │  ──────────────────── │
│  $79                 │  Ara cəm:     $257    │
│  ...                 │  Endirim:     -$20    │
│                      │  ƏDV:         $42.6   │
│                      │  CƏMI:        $279.6  │
│                      │                       │
│                      │  [Nağd][Kart][Köçür]  │
│                      │  [SATIŞI TAMAMLA]     │
└──────────────────────┴──────────────────────┘
```

### POS əməliyyatı
```typescript
interface POSSale {
  id: string;
  receiptNumber: string;     // RCP-2026-001234
  cashierId: string;
  customerId?: string;       // opsional
  items: POSItem[];
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  amountReceived: number;    // nağd üçün
  change: number;            // qaytarılan
  timestamp: Timestamp;
}
```

### POS xüsusiyyətləri
```
- Barkod skan (kamera / USB scanner)
- Sürətli axtarış (SKU, ad)
- Avtomatik stok azalması (real-time)
- Qəbz çapı (termal printer / PDF)
- Müştəri seçimi (opsional, loyallıq)
- Offline rejim (Firestore offline → sync)
- Gün sonu hesabatı
```

### Qəbz (Receipt)
```
┌──────────────────────┐
│   [Şirkət Logo]      │
│   Cins Şalvar MMC    │
│   VÖEN: xxxxx        │
│ ──────────────────── │
│ Qəbz: RCP-001234     │
│ 15.02.2026 14:30     │
│ Kassir: Əli M.       │
│ ──────────────────── │
│ Classic 32  ×2  $178 │
│ Slim 30     ×1  $79  │
│ ──────────────────── │
│ Cəm:        $257     │
│ Endirim:    -$20     │
│ ƏDV(18%):   $42.6    │
│ YEKUN:      $279.6   │
│ Nağd:       $300     │
│ Qaytarma:   $20.4    │
│ ──────────────────── │
│ Təşəkkürlər!         │
│ [QR kod]             │
└──────────────────────┘
```

---

## 8.6 KASSA MODULU — Modul #14

> Nağd və bank vəsaitlərinin idarəsi

### Kassa növləri
```typescript
interface CashRegister {
  id: string;
  name: string;              // Əsas kassa, POS-1, Bank-Kapital
  type: 'cash' | 'bank' | 'pos_terminal';
  currency: 'AZN' | 'USD' | 'TRY';
  currentBalance: number;
  isActive: boolean;
}
```

### Kassa əməliyyatları
```typescript
interface CashTransaction {
  id: string;
  registerId: string;
  type: 'in' | 'out';        // mədaxil / məxaric
  category: string;
  amount: number;
  currency: string;
  description: string;
  referenceType?: string;    // SalesOrder, PO, Salary, ...
  referenceId?: string;
  attachments?: string[];    // qəbz
  userId: string;
  timestamp: Timestamp;
}
```

### Mədaxil kateqoriyaları
```
- Müştəri ödənişi (satışdan)
- Nağd satış (POS)
- Bank köçürməsi
- Digər gəlir
```

### Məxaric kateqoriyaları
```
- Supplier ödənişi
- Əmək haqqı
- Kommunal
- Nəqliyyat
- Yuyulma (kənar laundry)
- Ofis xərcləri
- Vergilər
- Digər
```

### Gün sonu (Cash Closing)
```
Kassir gün sonunda:
- Açılış balansı
- Ümumi mədaxil
- Ümumi məxaric
- Hesablanmış balans vs faktiki nağd
- Fərq (varsa)
- Təsdiq + imza
```

### Valyuta idarəsi
```
- Çox valyuta (AZN əsas, USD/TRY/EUR)
- Məzənnə bazası (tarixi)
- CBAR API ilə avtomatik məzənnə (opsional)
- Mübadilə mənfəəti/zərəri
```

---

## 8.7 GERİ QAYTARMA (Return)

```typescript
interface SalesReturn {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  customerId?: string;
  items: { variantSku, qty, reason }[];
  reason: 'defective' | 'wrong_size' | 'customer_request' | 'other';
  returnType: 'refund' | 'exchange' | 'store_credit';
  refundAmount?: number;
  status: 'pending' | 'approved' | 'completed';
  // Qaytarılan məhsul stoka geri (əgər satıla bilərsə)
  restockable: boolean;
}
```

---

**Növbəti fayl:** `09_FINANCE.md` - Maliyyə və Mühasibatlıq
