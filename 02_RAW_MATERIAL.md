# 02. XAM MATERİAL ANBARI + COSTING (FIFO/AVCO)

> Modullar: #1 Xam mal anbarı + maya dəyəri, #2 Anbar giriş/çıxış + sənədlər + silmə metodları (FIFO/AVCO)

---

## 2.1 MATERİAL KATEQORİYALARI (14 növ)

> Bu element siyahısı əvvəlki tələbdən gəlir — cins şalvar üçün

| # | Kateqoriya (kod) | Vahid | Min Stok | Tipik Mənşə |
|---|------------------|-------|----------|-------------|
| 1 | Parça/Denim (`fabric`) | metr | 1000 | Çin, Türkiyə |
| 2 | Sap - bel/cib (`thread`) | metr | 500 | Türkiyə |
| 3 | Astar (`lining`) | metr | 300 | Çin |
| 4 | Yuyulma Etiketi (`wash_label`) | ədəd | 5000 | Yerli |
| 5 | Kartric/Care Label (`care_label`) | ədəd | 5000 | Çin |
| 6 | Zamok/Fermuar (`zipper`) | ədəd | 2000 | Türkiyə, Çin |
| 7 | Düymə (`button`) | ədəd | 10000 | Çin |
| 8 | Rivet/Pərçim (`rivet`) | ədəd | 15000 | Çin |
| 9 | Jakron/Dəri etiket (`leather_patch`) | ədəd | 3000 | Türkiyə |
| 10 | Cib Aksesuarı (`pocket_acc`) | ədəd/metr | 500 | Çin |
| 11 | Sallantı Kartı/Hang Tag (`hang_tag`) | ədəd | 5000 | Yerli |
| 12 | Bia/Bağlama (`binding`) | metr | 200 | Türkiyə |
| 13 | Brand Etiket (`brand_label`) | ədəd | 3000 | Türkiyə |
| 14 | Cib Kartı (`pocket_card`) | ədəd | 5000 | Yerli |

### Parça (Denim) əlavə atributları:
```yaml
type: [denim, elastic_denim, twill, canvas, corduroy]
weight_oz: [8, 10, 12, 14, 16]   # oz (gr/m²)
width_cm: [140, 150, 160]
composition: { cotton: %, elastane: %, polyester: % }
stretch_pct: number  # uzanma %
color: string
```

---

## 2.2 MATERİAL CRUD

### 2.2.1 Material Yaratmaq

**Material kodu (auto):** `MAT-{CAT}-{seq}` → `MAT-DEN-00125`

**Firestore document:**
```typescript
interface RawMaterial {
  id: string;
  code: string;              // MAT-DEN-00125
  name: string;
  category: MaterialCategory;
  subCategory?: string;
  attributes: Record<string, any>;  // çəki, en, rəng və s.
  unit: 'meter' | 'piece' | 'kg';

  // Stok
  currentStock: number;      // cari miqdar (denormalized)
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  moq: number;               // min order quantity

  // Costing
  costingMethod: 'FIFO' | 'AVCO';  // material səviyyəsində seçilə bilər
  avgCost: number;           // AVCO üçün cari orta
  lastPurchasePrice: number;
  currency: 'AZN' | 'USD' | 'TRY' | 'EUR';
  stockValue: number;        // currentStock * cost (denormalized)

  // Supplier
  primarySupplierId: string;
  alternativeSupplierIds: string[];
  leadTimeDays: number;

  // Media
  barcode: string;           // EAN-13 / Code128
  qrCode: string;
  imageUrls: string[];       // Firebase Storage
  documentUrls: string[];    // sertifikatlar

  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.2.2 Material Siyahısı
```
Stat kartları: Ümumi | Kritik | Aşağı | Stok Dəyəri | Deaktiv
Cədvəl: şəkil | kod | ad | kateqoriya | stok(rəngli) | min | qiymət | supplier | əməliyyat
Stok statusu rəngləri:
  🟢 OK (> reorderPoint)
  🟡 Low (reorderPoint > x > minStock)
  🔴 Critical (< minStock)
  ⚫ Out (= 0)
Filtrlər: kateqoriya, stok statusu, supplier, qiymət aralığı
Toplu: export(Excel/PDF), barkod çap, deaktiv
```

### 2.2.3 Material Detalları (tablar)
```
1. Ümumi (şəkil qalereya, atributlar, barkod/QR)
2. Stok Tarixçəsi (bütün hərəkətlər + qrafik)
3. Cost Layers (FIFO təbəqələri — vacib!)
4. Alış Tarixçəsi (PO-lar + qiymət qrafiki)
5. BOM İstifadəsi (hansı məhsullarda)
6. Maliyyə (ümumi alış, orta, dəyər)
```

---

## 2.3 STOK HƏRƏKƏTLƏRİ (Stock Movements)

### 2.3.1 Hərəkət növləri

| Növ (kod) | İzah | Stoka təsir | Sənəd |
|-----------|------|:-----------:|-------|
| `IN_GRN` | PO qəbulu (GRN) | + | Goods Received Note |
| `OUT_PRODUCTION` | İstehsala buraxılış | − | Material Çıxış Qaiməsi |
| `IN_RETURN_PROD` | İstehsaldan qaytarma | + | Qaytarma aktı |
| `OUT_RETURN_SUP` | Supplier-ə qaytarma | − | Return to Supplier |
| `ADJ_INVENTORY` | İnventarizasiya düzəlişi | ± | İnventarizasiya aktı |
| `TRF_WAREHOUSE` | Anbarlar arası transfer | ± | Transfer qaiməsi |
| `OUT_DISPOSAL` | İmha/zay/fire | − | İmha aktı |
| `OUT_SAMPLE` | Nümunə | − | — |

### 2.3.2 Stock Movement document
```typescript
interface StockMovement {
  id: string;
  materialId: string;
  type: MovementType;
  quantity: number;          // + giriş, − çıxış
  unitCost: number;          // bu hərəkətdəki vahid maya
  totalCost: number;
  balanceAfter: number;      // hərəkətdən sonra qalıq
  referenceType: 'PO' | 'GRN' | 'ProductionOrder' | 'Inventory' | 'Transfer' | 'Disposal';
  referenceId: string;
  warehouseId: string;
  locationCode?: string;     // R-A-03
  batchNumber?: string;
  userId: string;
  notes?: string;
  createdAt: Timestamp;
}
```

---

## 2.4 COSTING — FIFO və AVCO (KRİTİK MODUL)

> **Best practice:** Apparel sənayesində 2 əsas metod istifadə olunur: **FIFO** (First-In First-Out) və **AVCO/WAC** (Weighted Average Cost). LIFO əksər ölkələrdə (və IFRS-də) qadağandır — daxil etmirik, amma opsional saxlaya bilərik.

### 2.4.1 Metodun seçilməsi
```yaml
Səviyyə: 
  - Global default (Settings-də): FIFO və ya AVCO
  - Material səviyyəsində override edilə bilər
İstifadəçi material yaradanda costingMethod seçir.
Bir dəfə əməliyyat başlayandan sonra dəyişmək tövsiyə edilmir (audit).
```

### 2.4.2 FIFO İmplementasiyası (Cost Layers)

Hər GRN (giriş) yeni **cost layer** yaradır:

```typescript
interface CostLayer {
  id: string;
  materialId: string;
  grnId: string;             // hansı qəbuldan
  receivedDate: Timestamp;
  originalQty: number;       // ilkin miqdar
  remainingQty: number;      // qalan (azalır)
  unitCost: number;          // landed cost (qiymət + gömrük + daşıma paylanmış)
  isExhausted: boolean;      // remainingQty === 0
}
```

**FIFO Çıxış alqoritmi (Cloud Function):**
```javascript
// İstehsala 124m material çıxır
function fifoIssue(materialId, qtyNeeded) {
  // Ən köhnə layer-lərdən başla (receivedDate ASC)
  const layers = getActiveLayers(materialId, orderBy='receivedDate ASC');
  let remaining = qtyNeeded;
  let totalCost = 0;
  const consumed = [];

  for (const layer of layers) {
    if (remaining <= 0) break;
    const take = Math.min(layer.remainingQty, remaining);
    totalCost += take * layer.unitCost;
    layer.remainingQty -= take;
    if (layer.remainingQty === 0) layer.isExhausted = true;
    consumed.push({ layerId: layer.id, qty: take, unitCost: layer.unitCost });
    remaining -= take;
  }

  if (remaining > 0) throw new Error("Kifayət qədər stok yoxdur");

  // COGS = totalCost; bu istehsal sifarişinin maya dəyərinə yazılır
  return { totalCost, avgUnitCost: totalCost / qtyNeeded, consumed };
}
```

**FIFO nümunəsi:**
```
Giriş 1: 200m @ $8.00 (15 Yan)
Giriş 2: 300m @ $8.50 (20 Yan)
Çıxış: 250m istehsala

FIFO hesablama:
  200m @ $8.00 = $1,600  (layer 1 tam istifadə)
  50m  @ $8.50 = $425    (layer 2-dən)
  ─────────────────────
  COGS = $2,025  (orta $8.10/m)
  Qalıq: 250m @ $8.50 = $2,125
```

### 2.4.3 AVCO İmplementasiyası (Weighted Average)

```javascript
// Hər GRN-də yeni orta hesablanır (perpetual/moving average)
function avcoReceive(material, qtyIn, unitCostIn) {
  const oldValue = material.currentStock * material.avgCost;
  const newValue = qtyIn * unitCostIn;
  const newStock = material.currentStock + qtyIn;
  material.avgCost = (oldValue + newValue) / newStock;  // yeni orta
  material.currentStock = newStock;
}

// Çıxışda cari avgCost istifadə olunur
function avcoIssue(material, qtyOut) {
  const cogs = qtyOut * material.avgCost;
  material.currentStock -= qtyOut;
  // avgCost dəyişmir (çıxışda)
  return cogs;
}
```

**AVCO nümunəsi:**
```
Giriş 1: 200m @ $8.00 → orta $8.00, stok 200m
Giriş 2: 300m @ $8.50 → orta = (200×8 + 300×8.5)/500 = $8.30, stok 500m
Çıxış: 250m → COGS = 250 × $8.30 = $2,075
Qalıq: 250m @ $8.30 = $2,075
```

### 2.4.4 Landed Cost (Vacib!)

Material maya dəyəri yalnız alış qiyməti deyil — **landed cost**:
```
Landed Cost = Alış qiyməti
            + Gömrük rüsumu (paylanmış)
            + Daşıma xərci (paylanmış)
            + Sığorta (paylanmış)
            + Bank/digər xərclər
```

Paylanma metodu: **miqdar əsaslı** və ya **dəyər əsaslı** (Settings-də).

```javascript
// PO-da $300 daşıma 3 materiala dəyər əsasında paylanır
function allocateLandedCost(poItems, freightTotal, method='value') {
  const totalValue = sum(poItems, i => i.qty * i.price);
  for (const item of poItems) {
    const itemValue = item.qty * item.price;
    const allocatedFreight = freightTotal * (itemValue / totalValue);
    item.landedUnitCost = item.price + (allocatedFreight / item.qty);
  }
}
```

---

## 2.5 ANBAR GİRİŞ/ÇIXIŞ SƏNƏDLƏRİ (Avtomatik)

> Modul #2: sənədlərin avtomatik tərtibi — qaimə, təhvil-təslim

### 2.5.1 Sənəd növləri

| Sənəd | İngilis | Nə vaxt | Format |
|-------|---------|---------|--------|
| Mədaxil Qaiməsi | Goods Received Note (GRN) | Material qəbulu | PDF |
| Məxaric Qaiməsi | Material Issue Note | İstehsala buraxılış | PDF |
| Təhvil-Təslim Aktı | Delivery/Handover Act | Transfer/təhvil | PDF |
| Transfer Qaiməsi | Stock Transfer Note | Anbarlar arası | PDF |
| İnventarizasiya Aktı | Inventory Count Sheet | Sayım | PDF |
| İmha Aktı | Disposal Act | Zay/fire | PDF |

### 2.5.2 Avtomatik PDF Generasiyası

Hər stok hərəkəti təsdiqlənəndə Cloud Function PDF yaradır:
```
Şablon (HTML→PDF):
┌────────────────────────────────────────────┐
│ [Şirkət Logo]        MƏXARİC QAİMƏSİ        │
│                      № MIN-2026-0123        │
│ Tarix: 15.02.2026                           │
│ Anbar: Əsas Anbar → İstehsalat              │
│ Əsas: İstehsal Sifarişi PR-2026-0456        │
├────────────────────────────────────────────┤
│ # │ Material      │ Kod      │ Miqdar │ Vahid│
│ 1 │ Denim 12oz    │ MAT-DEN..│ 124    │ metr │
│ 2 │ Metal Düymə   │ MAT-BTN..│ 510    │ ədəd │
├────────────────────────────────────────────┤
│ Təhvil verən: ____________  (Anbardar)      │
│ Təhvil alan:  ____________  (İstehsalat)    │
│ İmza/Möhür                                  │
└────────────────────────────────────────────┘
```

PDF Firebase Storage-a yüklənir, link movement-ə əlavə olunur.
AI (Groq) sənəd qeydlərini/xülasəsini avtomatik yaza bilər.

---

## 2.6 İNVENTARİZASİYA

```
Plan → Komanda → Sayım → Fərq → Düzəliş → Hesabat

Forma:
  Material | Sistemdə | Faktiki | Fərq | Səbəb(dropdown)
  Səbəblər: hesab xətası, itki/oğurluq, zay, qüsur, ölçü xətası, nümunə, digər

Düzəliş: ADJ_INVENTORY hərəkəti yaranır (FIFO layer və ya AVCO yenilənir)
Hesabat: yoxlanılan, uyğun, fərq, dəyər təsiri, səbəb təhlili
```

---

## 2.7 MULTI-WAREHOUSE (Çox Anbar)

```typescript
interface Warehouse {
  id: string;
  name: string;          // Əsas Anbar, İstehsalat Anbarı, Hazır Məhsul
  type: 'raw' | 'wip' | 'finished';
  locations: Location[]; // rəflər: R-A-03
  isActive: boolean;
}
```
Stok hər anbar üçün ayrı izlənir. Transfer hərəkəti ilə köçürülür.

---

**Növbəti fayl:** `03_BOM_COSTING.md` - BOM Kalkulyasiya + Maya Dəyəri
