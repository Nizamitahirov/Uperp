# 06. İSTEHSAL (MES) + YUYULMA (WASHING)

> Modullar: #4 Yuyulma + itki faizləri, #6 məhsulun hazır faza keçidi, istehsal idarəsi

---

## 6.1 İSTEHSAL MƏRHƏLƏLƏRİ (Denim Best Practice)

> Sənaye standartı (araşdırma əsasında)

```
1. Fabric Inspection (Parça yoxlama)
2. Pattern/Marker (Lekal/marker)
3. Spreading (Sərmə)
4. Cutting (Kəsim) — ~20 parça hissəsi/şalvar
5. Sewing (Tikiş):
   - Pocket attach (cib)
   - Side seams (yan)
   - Inseam (iç tikiş)
   - Waistband (bel)
   - Belt loops (ilgək)
   - Bartack (möhkəmləndirmə)
   - Hemming (ətək)
6. Hardware (Zamok, düymə, rivet, jakron)
7. Washing (Yuyulma) ← AYRI MODUL
8. Finishing (Ütü, təmizləmə)
9. Quality Control (QC)
10. Folding & Packing
11. Warehouse
```

---

## 6.2 İSTEHSAL SİFARİŞİ (Production Order)

```typescript
interface ProductionOrder {
  id: string;
  orderNumber: string;       // PR-2026-0456
  productId: string;
  bomId: string;             // istifadə olunan BOM versiyası

  // Ölçü paylanması
  sizeDistribution: {
    [sizeVariant: string]: number;  // "28-30": 40, "32-34": 60
  };
  totalQuantity: number;

  plannedStartDate: Timestamp;
  plannedEndDate: Timestamp;
  priority: 'low' | 'normal' | 'high';

  status: 'planned' | 'material_check' | 'in_progress'
        | 'in_washing' | 'in_qc' | 'completed' | 'cancelled';

  stages: ProductionStage[];

  // Maya dəyəri izləmə
  standardCost: number;      // BOM-dan
  actualMaterialCost: number;// FIFO/AVCO faktiki
  actualLaborCost: number;
  washingCost: number;
  totalActualCost: number;

  // Nəticə
  producedQuantity?: number;
  defectQuantity?: number;
  washingLossQuantity?: number;

  createdBy: string;
}

interface ProductionStage {
  stageName: string;         // cutting, sewing, ...
  status: 'pending' | 'in_progress' | 'completed';
  startTime?: Timestamp;
  endTime?: Timestamp;
  assignedWorker?: string;
  defects?: DefectRecord[];
  notes?: string;
}
```

---

## 6.3 İSTEHSAL PROSESİ AXINI

```
1. Production Order yaradılır (məhsul + ölçü + miqdar)
2. Material yoxlama (BOM × miqdar vs cari stok)
3. "İstehsala başla" → MATERIAL AVTOMATİK STOKDAN ÇIXIR (bax 03)
4. Mərhələlər ardıcıl izlənir (real-time status)
5. Hər mərhələdə qüsur qeydi (defect tracking)
6. Cutting/Sewing bitir → WIP (Work in Progress)
7. Yuyulmaya təhvil (bax 6.4)
8. QC
9. Hazır məhsul stoka əlavə
```

### Qüsur idarəsi (Defect Tracking)
```typescript
interface DefectRecord {
  stage: string;
  defectType: string;        // skipped stitch, color, size, ...
  quantity: number;
  cause?: string;
  action: 'rework' | 'reject' | 'downgrade';  // düzəlt / zay / 2-ci sort
}
```

---

## 6.4 YUYULMA (WASHING) MODULU — ÖZƏL MODUL

> Modul #4: parçanın yuyulmaya təhvil verilməsi, itki (shrinkage) faizləri

### 6.4.1 Yuyulma növləri (best practice + shrinkage)

| Növ (kod) | Effekt | Shrinkage | Su sərfi | Qeyd |
|-----------|--------|:---------:|:--------:|------|
| `rinse` | minimal | 1-3% | aşağı | ən yüngül |
| `enzyme` | yumşaq fade | 3-5% | orta | ekoloji |
| `stone` | vintage | 5-7% | yüksək | pumice daşı |
| `bleach` | açıq | 4-6% | yüksək | kimyəvi |
| `acid` | mərmər | 4-6% | yüksək | snow/moon |
| `heavy_stone` | çox köhnə | 8-12% | çox yüksək | yarn breakage riski |

> **KRİTİK:** Yuyulma 8-12%-ə qədər büzülmə yaradır. BOM/lekal bunu nəzərə almalıdır. Sistem hər partiya üçün **giriş sayı → çıxış sayı → itki faizi**ni izləyir.

### 6.4.2 Washing Order (Yuyulma Sifarişi)

```typescript
interface WashingOrder {
  id: string;
  washNumber: string;        // WSH-2026-0078
  productionOrderId: string;
  washType: WashType;

  // Kənar laundry (outsource) və ya daxili
  isOutsourced: boolean;
  laundryId?: string;        // kənar laundry kontragent
  pricePerPiece?: number;    // kənar tarif

  // Təhvil
  sentQuantity: number;      // yuyulmaya göndərilən
  sentDate: Timestamp;
  expectedReturnDate: Timestamp;

  // Qayıdış
  returnedQuantity?: number; // qayıdan (sağlam)
  damagedQuantity?: number;  // yuyulmada zədələnən
  returnDate?: Timestamp;

  // İtki hesablanması
  lossQuantity?: number;     // sent − returned
  lossPercentage?: number;   // loss/sent × 100
  shrinkageMeasured?: number;// faktiki büzülmə %

  status: 'sent' | 'in_process' | 'returned' | 'closed';
  notes?: string;
  cost: number;              // ümumi yuyulma xərci
}
```

### 6.4.3 Yuyulma Axını

```
1. WIP məhsul yuyulmaya hazır (sewing bitib)
2. Washing Order yaradılır:
   - washType seç
   - kənar laundry-yə? → laundry seç, tarif
   - sentQuantity, təhvil-təslim aktı (PDF)
3. Yuyulmaya göndərilir (status: sent)
   - WIP stokdan "yuyulmada" statusuna keçir
4. Qayıdır:
   - returnedQuantity (sağlam)
   - damagedQuantity (zədələnmiş — zay)
   - lossPercentage avtomatik hesablanır
5. İtki maya dəyərinə əlavə olunur:
   - per-unit cost = totalCost / returnedQty (itki dəyəri qalanlara paylanır)
6. QC-yə keçir
```

### 6.4.4 İtki Hesablanması (Loss)

```javascript
function calculateWashingLoss(washingOrder) {
  const { sentQuantity, returnedQuantity, damagedQuantity } = washingOrder;
  const loss = sentQuantity - returnedQuantity;
  const lossPercentage = (loss / sentQuantity) * 100;

  // İtki dəyəri qalan məhsullara paylanır (maya dəyəri artır)
  const lostValue = loss * perUnitCostBeforeWash;
  const newPerUnitCost = (totalBatchCost) / returnedQuantity;

  // Xəbərdarlıq: itki normadan çoxdursa
  if (lossPercentage > WASH_TYPE_MAX_LOSS[washingOrder.washType]) {
    createAlert('HIGH_WASHING_LOSS', washingOrder);
  }
  return { loss, lossPercentage, newPerUnitCost };
}
```

### 6.4.5 Yuyulma Hesabatı
```
Partiya | Növ | Göndərilən | Qayıdan | Zədələnən | İtki% | Norma% | Status
--------|-----|------------|---------|-----------|-------|--------|-------
WSH-078 | stone| 100        | 94      | 4         | 6%    | 7%     | ✅ Norma
WSH-079 | heavy| 100        | 88      | 9         | 12%   | 12%    | ⚠️ Limit
WSH-080 | enzyme| 100       | 91      | 6         | 9%    | 5%     | 🔴 Yüksək!

Laundry performans (kənar): orta itki%, vaxtında qayıdış%, keyfiyyət
```

---

## 6.5 QUALITY CONTROL (QC)

```typescript
interface QCInspection {
  id: string;
  productionOrderId: string;
  inspectedQuantity: number;
  acceptedQuantity: number;
  defectQuantity: number;
  defects: { type: string; count: number }[];
  grade: 'A' | 'B' | 'reject';  // A=1-ci sort, B=2-ci sort
  inspector: string;
  date: Timestamp;
}
```

AQL (Acceptable Quality Limit) standartları tətbiq oluna bilər.

---

## 6.6 İSTEHSAL → HAZIR MƏHSUL KEÇİDİ

> Modul #6

```
QC bitir
  ↓
acceptedQuantity hesablanır (qüsur + yuyulma itkisi çıxılır)
  ↓
Final per-unit maya dəyəri:
   totalActualCost (material+labor+washing+overhead) / acceptedQty
  ↓
Hazır Məhsul Anbarına +stok (variant SKU səviyyəsində: ölçü+rəng)
  ↓
StockMovement (finished goods IN)
  ↓
Production Order: status = completed
  ↓
B sort məhsullar ayrıca (outlet/endirim)
  ↓
Zay məhsullar: disposal
```

---

**Növbəti fayl:** `07_FINISHED_GOODS.md` - Hazır Məhsul Anbarı + Planlaşdırma
