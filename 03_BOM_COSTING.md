# 03. BOM KALKULYASIYA + MAYA DƏYƏRİ

> Modullar: #1 ölçüyə görə element miqdarı, #27 BOM kalkulyasiya, maya dəyəri hesablama

---

## 3.1 BOM NƏDİR?

**BOM (Bill of Materials)** — bir cins şalvarı istehsal etmək üçün lazım olan bütün xam materialların **ölçüyə görə** siyahısı və miqdarları.

### Nümunə: İndigo Classic Fit Jeans

| Material | 28-30 | 32-34 | 36-38 | 40-42 | Vahid | Fire% |
|----------|:-----:|:-----:|:-----:|:-----:|-------|:-----:|
| Denim 12oz | 1.20 | 1.30 | 1.45 | 1.55 | metr | 3 |
| Astar | 0.30 | 0.32 | 0.35 | 0.38 | metr | 2 |
| Bel Sapı | 0.50 | 0.52 | 0.55 | 0.58 | metr | 2 |
| Zamok 15cm | 1 | 1 | 1 | 1 | ədəd | 1 |
| Düymə 15mm | 5 | 5 | 5 | 5 | ədəd | 2 |
| Rivet | 8 | 8 | 8 | 8 | ədəd | 1 |
| Jakron | 1 | 1 | 1 | 1 | ədəd | 0 |
| Yuyulma Etiketi | 2 | 2 | 2 | 2 | ədəd | 0 |
| Brand Etiketi | 1 | 1 | 1 | 1 | ədəd | 0 |
| Sallantı Kartı | 1 | 1 | 1 | 1 | ədəd | 0 |
| Kartric | 1 | 1 | 1 | 1 | ədəd | 0 |
| Cib Kartı | 1 | 1 | 1 | 1 | ədəd | 0 |

> **KRİTİK:** Ölçü böyüdükcə parça sərfiyyatı artır. Sistem hər ölçü üçün ayrı miqdar saxlamalıdır (size-based BOM).

---

## 3.2 BOM DATA MODEL

```typescript
interface BOM {
  id: string;
  bomNumber: string;         // BOM-PRD-00001-v1
  productId: string;
  version: string;           // "1.0", "1.1", "2.0"
  status: 'draft' | 'active' | 'scheduled' | 'archived' | 'obsolete';
  effectiveDate: Timestamp;

  // Ölçüyə görə material miqdarları
  sizeBasedItems: {
    [sizeRange: string]: BOMItem[];   // "28-30": [...], "32-34": [...]
  };
  // VƏ YA tək (ölçüdən asılı olmayan) əgər sadədirsə:
  items?: BOMItem[];

  // Əmək və overhead
  laborCost: number;         // 1 ədəd üçün
  laborMinutes: number;      // SMV (Standard Minute Value)
  overheadPercentage: number;
  packagingCost: number;

  // Hesablanmış
  materialCost: number;      // cari qiymətlərlə
  totalCost: number;         // material + labor + overhead + packaging

  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
}

interface BOMItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;          // əsas miqdar
  unit: string;
  wastagePercentage: number; // fire %
  totalQuantity: number;     // quantity * (1 + wastage/100)
  unitCost: number;          // snapshot (cari)
  lineCost: number;          // totalQuantity * unitCost
}
```

---

## 3.3 BOM YARATMA AXINI

```
1. Məhsul seç (Product)
2. Versiya təyin et (auto v1.0)
3. Hər ölçü aralığı üçün material əlavə et:
   - Material seç (autocomplete, kod/ad ilə)
   - Miqdar daxil et
   - Fire % təyin et
   - Sistem totalQuantity = qty × (1+fire/100) hesablayır
   - Cari unitCost snapshot götürülür
   - lineCost avtomatik
4. Labor: dəqiqə (SMV) və saat dərəcəsi
5. Overhead %: material+labor üzərinə
6. Material çatışmazlığı yoxlanılır (cari stok)
7. Maya dəyəri göstərilir
8. Təklif qiymət (markup) göstərilir
9. Aktiv et / Qaralama
```

---

## 3.4 MAYA DƏYƏRİ HESABLAMASI (Costing)

```
┌─────────────────────────────────────────────┐
│ 1. MATERIAL COST                            │
│    Σ (item.totalQuantity × item.unitCost)   │
│    [unitCost = FIFO/AVCO cari maya]          │
├─────────────────────────────────────────────┤
│ 2. LABOR COST                               │
│    laborMinutes/60 × hourlyRate             │
│    və ya birbaşa laborCost                  │
├─────────────────────────────────────────────┤
│ 3. WASHING COST (yuyulma)                   │
│    Əgər kənar laundry: per-piece tarif      │
│    + shrinkage itki dəyəri                   │
├─────────────────────────────────────────────┤
│ 4. OVERHEAD                                 │
│    (material + labor) × overheadPct%        │
├─────────────────────────────────────────────┤
│ 5. PACKAGING                                │
├─────────────────────────────────────────────┤
│ = STANDARD COST (planlaşdırılmış maya)      │
│                                              │
│ Sonra ACTUAL COST (faktiki, istehsaldan):   │
│   FIFO/AVCO real material + real labor       │
│   + real washing loss                        │
│ Variance = Actual − Standard (təhlil üçün)  │
└─────────────────────────────────────────────┘
```

### Qiymət təklifi (markup):
```javascript
const wholesalePrice = totalCost * (1 + wholesaleMarkup);  // məs. ×2.1
const retailPrice = totalCost * (1 + retailMarkup);        // məs. ×2.9
```

---

## 3.5 BOM VERSİYA İDARƏSİ

```
v1.0 → orijinal
v1.1 → parça/qiymət/supplier dəyişikliyi
v2.0 → tam yenidən dizayn

Yeni versiya:
  - əsasdan kopyala
  - dəyişiklik səbəbi
  - effectiveDate (bu tarixdən aktiv)
  - köhnə versiya archived olur

Versiya müqayisəsi: material/qiymət fərqləri, maya dəyəri dəyişikliyi
```

---

## 3.6 İSTEHSALDA AVTOMATİK STOK AZALMASI (ƏN VACİB)

> Bu sistemin ürəyidir. İstehsal başlayanda BOM əsasında materiallar avtomatik stokdan çıxır.

### Axın:
```
İstehsal Sifarişi yaradılır (məhsul + ölçü paylanması + miqdar)
        ↓
BOM çağırılır (məhsulun aktiv BOM-u)
        ↓
Hər ölçü üçün material tələbi hesablanır:
   tələb = Σ (ölçüdəki məhsul sayı × BOM[ölçü].totalQuantity)
        ↓
Stok çatışmazlığı yoxlanılır
   Əgər çatmırsa → xəbərdarlıq + PO təklifi
        ↓
"İstehsala başla" təsdiqi (geri qaytarılmaz!)
        ↓
Cloud Function:
   FOR EACH material:
      - FIFO/AVCO ilə stokdan çıx
      - StockMovement (OUT_PRODUCTION) yarat
      - Cost layer-ləri yenilə
      - COGS hesabla (istehsal maya dəyərinə)
      - Material Issue Note (PDF) yarat
      - Stok yoxla → low/out bildirişi
        ↓
İstehsal sifarişi: status = "in_progress"
```

### Cloud Function nümunəsi:
```javascript
exports.startProduction = functions.firestore
  .document('production_orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // status draft → in_progress olduqda
    if (before.status === 'draft' && after.status === 'in_progress') {
      const bom = await getBOM(after.productId);
      const batch = db.batch();

      for (const [sizeRange, qty] of Object.entries(after.sizeDistribution)) {
        const items = bom.sizeBasedItems[sizeRange];
        for (const item of items) {
          const needed = qty * item.totalQuantity;
          // FIFO və ya AVCO
          const { totalCost } = await issueStock(
            item.materialId, needed, after.id, item.unitCost
          );
          // COGS toplanır
          accumulateCOGS(after.id, totalCost);
        }
      }
      await batch.commit();
      await generateIssueNote(after.id);  // PDF
      await checkStockLevels();           // bildiriş
    }
  });
```

### Nümunə nəticə:
```
İstehsal: 100 ədəd Classic Fit (ölçü: 28-30: 40, 32-34: 60)

Denim tələbi:
  40 × 1.24m (28-30) = 49.6m
  60 × 1.34m (32-34) = 80.4m
  ─────────────────────────
  Cəmi: 130m

Stokdan çıxılır (FIFO):
  Denim: 850m → 720m  🟡 (reorder: 1200)
  Düymə: 12000 → 11490 🟢
  Zamok: 500 → 399  🔴 KRİTİK! → out-of-stock bildirişi

COGS (FIFO): material $1,081 + labor $500 + overhead $237 = $1,818
```

---

## 3.7 İSTEHSAL TAMAMLANDIQDA (WIP → Finished Goods)

```
Bütün mərhələlər + yuyulma + QC bitir
        ↓
Faktiki məhsul sayı (qüsurlu çıxılır)
        ↓
Final maya dəyəri hesablanır:
   actualCOGS / acceptedQty = per-unit cost
   (qüsurlu və yuyulma itkisi maya dəyərini artırır)
        ↓
Hazır məhsul stoka əlavə (+stok, finished goods warehouse)
        ↓
Qüsurlu məhsul: zay hesabına (disposal)
```

---

## 3.8 MATERİAL TƏLƏB PROQNOZU (MRP-lite)

```
Cari + planlaşdırılmış istehsal sifarişləri əsasında:

Material | Cari Stok | Aylıq İstifadə | 3-Aylıq Tələb | Çatışmazlıq | Tövsiyə
---------|-----------|----------------|---------------|-------------|--------
Denim    | 720m      | 1550m          | 4650m         | -3930m      | PO 4000m
Zamok    | 399       | 1200           | 3600          | -3201       | PO 4000

AI (Groq) köməyi: trend təhlili + tövsiyə mətnləri
"Tövsiyə olunan PO-ları yarat" düyməsi
```

---

**Növbəti fayl:** `04_CONTACTS_CRM.md` - Kontragentlər + CRM
