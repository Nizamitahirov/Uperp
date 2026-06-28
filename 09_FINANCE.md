# 09. MALİYYƏ VƏ MÜHASİBATLIQ

> Modul: #16 Maliyyə və mühasibatlıq

---

## 9.1 DEBİTOR İDARƏSİ (Accounts Receivable - AR)

> Müştəridən alınacaq borclar

```typescript
interface Receivable {
  id: string;
  customerId: string;
  invoiceId: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: Timestamp;
  status: 'open' | 'partial' | 'paid' | 'overdue';
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';
}
```

### Aging (Yaşlandırma) hesabatı
```
Müştəri    | 0-30   | 31-60  | 61-90  | 90+    | Cəmi
-----------|--------|--------|--------|--------|-------
Müştəri A  | 5000   | 2000   | 0      | 0      | 7000
Müştəri B  | 1000   | 0      | 3000   | 1500   | 5500
-----------|--------|--------|--------|--------|-------
CƏMI       | 6000   | 2000   | 3000   | 1500   | 12500
```

### Ödəniş qəbulu
```typescript
interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  amount: number;
  method: 'cash' | 'transfer' | 'card';
  bankReference?: string;
  appliedInvoices: { invoiceId, amount }[];  // hansı fakturalara
  date: Timestamp;
}
```

### Avtomatik xatırlatmalar
```
- Ödəniş tarixindən 3 gün əvvəl → email
- Ödəniş günü → email
- Gecikmə: 1, 7, 15, 30 gün → eskalasiya
AI (Groq): xatırlatma email draft (nəzakətli/sərt ton)
```

---

## 9.2 KREDİTOR İDARƏSİ (Accounts Payable - AP)

> Supplier-ə ödəniləcək borclar

```typescript
interface Payable {
  id: string;
  supplierId: string;
  purchaseOrderId: string;
  grnId: string;             // 3-way match
  invoiceNumber: string;     // supplier invoice
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: Timestamp;
  status: 'open' | 'partial' | 'paid' | 'overdue';
}
```

3-way matching (PO ↔ GRN ↔ Invoice) — fərq varsa ödəniş bloklanır.

---

## 9.3 XƏRC İDARƏSİ (Expenses)

```typescript
interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  paymentMethod: string;
  date: Timestamp;
  attachments: string[];     // qəbz/faktura
  description: string;
  approvalStatus: 'submitted' | 'approved' | 'paid';
  approvedBy?: string;
}

type ExpenseCategory =
  | 'raw_material' | 'production' | 'washing' | 'packaging'
  | 'salary' | 'rent' | 'utilities' | 'transport'
  | 'marketing' | 'bank_fees' | 'taxes' | 'other';
```

Təsdiq workflow: Submitted → Director approval → Paid

---

## 9.4 MƏNFƏƏT VƏ ZƏRƏR (P&L)

```
Gəlir/Gider Hesabatı:

SATIŞDAN GƏLİR (Revenue)              $XXX,XXX
(−) SATIŞIN MAYA DƏYƏRİ (COGS)       $XX,XXX
    [FIFO/AVCO əsasında faktiki]
─────────────────────────────────────────────
= ÜMUMİ MƏNFƏƏT (Gross Profit)       $XX,XXX
  Gross Margin %: XX%

(−) ƏMƏLİYYAT XƏRCLƏRİ (OpEx):
    Əmək haqqı                       $X,XXX
    İcarə                            $X,XXX
    Kommunal                         $XXX
    Marketinq                        $XXX
    Nəqliyyat                        $XXX
─────────────────────────────────────────────
= ƏMƏLİYYAT MƏNFƏƏTİ (Operating)     $XX,XXX

(±) Digər gəlir/xərc                 $XXX
(−) Vergilər                         $X,XXX
─────────────────────────────────────────────
= XALİS MƏNFƏƏT (Net Profit)         $XX,XXX
  Net Margin %: XX%
```

### Mənfəət təhlili (segmentlər)
```
- Məhsul/model üzrə
- Müştəri/seqment üzrə
- Kanal üzrə (B2B/B2C/online)
- Dövr üzrə (gün/həftə/ay/il)
- Variant (ölçü/rəng) üzrə
```

---

## 9.5 COGS HESABLANMASI (Best Practice)

> Apparel sənayesi standartı

```
COGS posting vaxtı: məhsul SATILANDA (invoice anında)
Metod: FIFO və ya AVCO (Settings-də seçilir)

Manufacturing COGS komponentləri:
- Direct Material (xam material, FIFO/AVCO)
- Direct Labor (istehsal işçiliyi)
- Manufacturing Overhead (elektrik, amortizasiya)
- Washing cost + shrinkage loss

Formula:
Beginning Inventory + Purchases/Production − Ending Inventory = COGS
```

---

## 9.6 BALANS HESABATI (Balance Sheet - sadə)

```
AKTİVLƏR:
  Cari aktivlər:
    Nağd və bank
    Debitor (AR)
    İnventar (xam + WIP + hazır məhsul)
  Əsas vəsaitlər (avadanlıq)

ÖHDƏLİKLƏR:
    Kreditor (AP)
    Qısamüddətli borclar
    Vergi öhdəlikləri

KAPİTAL:
    Nizamnamə kapitalı
    Bölüşdürülməmiş mənfəət
```

---

## 9.7 CASH FLOW (Pul Axını)

```
Əməliyyat fəaliyyəti:
  + Müştəri ödənişləri
  − Supplier ödənişləri
  − Əmək haqqı, xərclər
İnvestisiya:
  − Avadanlıq alışı
Maliyyə:
  ± Kreditlər

Cash Conversion Cycle (best practice metrikası):
  DIO (Days Inventory Outstanding)
  + DSO (Days Sales Outstanding)
  − DPO (Days Payable Outstanding)
  = CCC
```

---

## 9.8 VERGİ VƏ ƏDV

```
ƏDV dərəcəsi: 18% (Azərbaycan)
ƏDV daxil/xaric hesablama
ƏDV hesabatı (alış vs satış ƏDV)
Digər vergilər (mənfəət vergisi)
```

---

## 9.9 AI MALİYYƏDƏ (Groq)

```
- Invoice/faktura mətn tərtibi (AZ/EN)
- Aylıq maliyyə xülasəsi (insights)
- Anomaliya aşkarlama (qeyri-adi xərc)
- Cash flow proqnozu şərhi
- Debitor xatırlatma email draft
```

---

**Növbəti fayl:** `10_CATALOG_AI.md` - Məhsul Kataloqu + Model İdarəsi
