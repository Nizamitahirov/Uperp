# 07. HAZIR MƏHSUL ANBARI + PLANLAŞDIRMA

> Modullar: #5 hazır məhsul planlaşdırması, #6 keçid, #7 overstock, #8 out-of-stock

---

## 7.1 HAZIR MƏHSUL (Finished Goods) STOK

### Variant səviyyəsində stok
Bir məhsulun çoxlu variantı var (ölçü × rəng × yuyulma):
```
PRD-00001 (İndigo Classic Fit)
├── PRD-00001-28-30-A  (28/30, A sort)  → stok: 45
├── PRD-00001-30-32-A  (30/32, A sort)  → stok: 60
├── PRD-00001-32-34-A  (32/34, A sort)  → stok: 80
├── PRD-00001-32-34-B  (32/34, B sort)  → stok: 5
└── ...
```

### Data model
```typescript
interface FinishedGoodStock {
  id: string;
  productId: string;
  variantSku: string;        // PRD-00001-32-34-A
  size: string;              // 32-34
  color: string;
  grade: 'A' | 'B';

  currentStock: number;
  reservedStock: number;     // sifariş üçün rezerv
  availableStock: number;    // current − reserved

  minStock: number;          // overstock/out-of-stock üçün
  maxStock: number;
  reorderPoint: number;

  unitCost: number;          // istehsaldan gələn faktiki maya
  wholesalePrice: number;
  retailPrice: number;

  warehouseId: string;
  locationCode: string;      // Rəf-A-12
  updatedAt: Timestamp;
}
```

---

## 7.2 REZERVASİYA SİSTEMİ

```
Sifariş təsdiqlənir
  ↓
reservedStock += sifariş miqdarı
availableStock = currentStock − reservedStock
  ↓
Çatdırılma olur
  ↓
currentStock −= miqdar
reservedStock −= miqdar
  ↓
Sifariş ləğv olarsa → rezerv açılır
```

---

## 7.3 HAZIR MƏHSUL PLANLAŞDIRMASI (Demand Planning)

> Modul #5

```
Tələb proqnozu = keçmiş satış trendi + mövsümilik + aktiv sifarişlər

Sistem hesablayır:
- Hansı variant nə qədər satılır (aylıq)
- Cari stok neçə günə çatır
- Nə qədər istehsal lazımdır
- Mövsümi pik (yay/qış kolleksiya)

AI (Groq) köməyi:
- Trend təhlili və proqnoz şərhi
- "Bu modeli 200 ədəd istehsal edin" tövsiyəsi
```

### Planlaşdırma ekranı
```
Variant         | Cari | Rezerv | Avail | Aylıq Satış | Çatır | Tövsiyə
----------------|------|--------|-------|-------------|-------|--------
32-34 İndigo A  | 80   | 20     | 60    | 120         | 15gün | İstehsal 200
30-32 İndigo A  | 60   | 10     | 50    | 90          | 17gün | İstehsal 150
28-30 Black A   | 15   | 5      | 10    | 80          | 4gün  | TƏCİLİ 250 🔴
```

---

## 7.4 OVERSTOCK BİLDİRİŞLƏRİ

> Modul #7

```
Şərt: currentStock > maxStock
  VƏ YA
Şərt: stok > X gün satışı (ləng hərəkət)

Bildiriş:
🟠 OVERSTOCK: "32-34 İndigo A" stoku maksimumu keçib
   Cari: 350 | Max: 200 | Aylıq satış: 50
   Tövsiyə: endirim kampaniyası / istehsalı dayandır

Cloud Function (scheduled, gündəlik):
  forEach variant:
    if (currentStock > maxStock || daysOfStock > 90):
      createNotification('OVERSTOCK', variant)
```

### Overstock idarəsi
```
- Endirim təklifi (markdown)
- B sort outlet-ə köçür
- İstehsal planından çıxar
- Kampaniya (CRM ilə)
```

---

## 7.5 OUT-OF-STOCK BİLDİRİŞLƏRİ

> Modul #8

```
Şərt: availableStock <= reorderPoint   → 🟡 Low
Şərt: availableStock === 0             → 🔴 Out of stock

Bildiriş:
🔴 OUT OF STOCK: "28-30 Black A" bitib!
   Aylıq satış: 80 | Gözləyən sifariş: 25
   Tövsiyə: Təcili istehsal sifarişi 250 ədəd

Real-time (Firestore trigger):
  onStockChange:
    if (availableStock === 0) notify('OUT_OF_STOCK')
    else if (availableStock <= reorderPoint) notify('LOW_STOCK')
```

### Eyni məntiq XAM MATERİAL üçün də (bax 02):
```
🔴 Xam material out: "Metal Zamok" bitib → istehsal dayana bilər
🟡 Xam material low: "Denim 12oz" reorder point-də → PO təklifi
```

---

## 7.6 ABC ANALİZİ (Inventory Classification)

```
A sinif: dövriyyənin 80%-i (top satıcılar) — sıx izləmə
B sinif: 15% — orta
C sinif: 5% — ləng hərəkət

Hər variant avtomatik təsnif olunur → stok strategiyası fərqli
```

---

**Növbəti fayl:** `08_SALES_POS.md` - Satış, Sifariş, POS, Kassa
