# 10. MƏHSUL KATALOQU + MODEL İDARƏÇİLİYİ (AI)

> Modullar: #21 Məhsul kataloqu, #22 Model/kataloq idarəsi (photo upload, AI, moda jurnalı dizaynı), #23 Gmail ilə kataloq girişi

---

## 10.1 MƏHSUL DATA MODEL

```typescript
interface Product {
  id: string;
  sku: string;               // PRD-00001
  modelCode: string;         // JCF-IND-001

  // Çoxdilli ad
  name: { az: string; en: string; ru?: string };

  category: 'men' | 'women' | 'kids';
  subCategory: string;       // classic_fit, slim, skinny, ...

  // Atributlar
  colorCode: string;
  colorName: string;
  washEffect: WashType;      // stone, enzyme, ...
  materialType: string;      // denim
  weight: string;            // 12oz
  stretch: boolean;
  pocketType: string;
  fit: 'regular' | 'slim' | 'skinny' | 'loose';
  rise: 'low' | 'mid' | 'high';
  season: string;
  collection: string;        // 2026 Spring-Summer

  // Ölçülər
  sizes: { waist: number[]; length: number[] };

  // Qiymət
  wholesalePrice: number;
  retailPrice: number;
  cost: number;              // BOM-dan (auto)
  discountTiers: DiscountTier[];

  // Media (moda jurnalı üçün)
  images: ProductImage[];
  video?: string;
  view360?: string[];

  // Təsvir (AI generated ola bilər)
  description: { az: string; en: string };
  features: string[];
  careInstructions: CareInstructions;

  // SEO
  metaTitle?: string;
  metaDescription?: string;
  tags: string[];

  bomId?: string;            // əlaqəli BOM
  status: 'active' | 'draft' | 'archived';
  createdAt: Timestamp;
}

interface ProductImage {
  url: string;               // Firebase Storage
  type: 'main' | 'back' | 'side' | 'detail' | 'model' | 'flat_lay';
  isPrimary: boolean;
  aiGenerated?: boolean;
}
```

---

## 10.2 MODEL İDARƏÇİLİYİ — Photo Upload

```
Şəkil yükləmə (Firebase Storage):
- Əsas şəkil (məcburi, 600×800px)
- Əlavə (max 10): arxa, yan, detal, model üzərində, flat lay
- Video (opsional, max 50MB)
- 360° görünüş (opsional)

İşləmə:
- Avtomatik resize (thumbnail + full)
- WebP konversiya (performans)
- Lazy loading
- CDN (Firebase)
```

---

## 10.3 MODA JURNALI DİZAYNI (Vogue-style Catalog)

> Modul #22: moda dərgiləri kimi dizayn

### Kataloq estetikası
```
- Böyük, keyfiyyətli şəkillər (editorial style)
- Minimalist, elegant tipoqrafiya
- Grid + masonry layout
- Hover effektləri (şəkil dəyişimi)
- Full-screen lookbook rejimi
- Kolleksiya hekayələri (storytelling)
- "Lookbook" PDF export

Referans dizayn: əvvəlki Birtask/Gradex + moda jurnalı
```

### Kataloq görünüşləri
```
1. Grid (standart məhsul gridi)
2. Lookbook (full-width editorial)
3. Kolleksiya (mövsümi qruplaşma)
4. Liste (cədvəl - B2B sürətli sifariş)
```

### Müştəri kataloq səhifəsi (Gmail login sonrası)
```
┌──────────────────────────────────────────────┐
│  [Logo]   KOLLEKSIYA   MƏHSULLAR   SİFARİŞ    │
│                              [Profil] [Səbət]  │
├──────────────────────────────────────────────┤
│   ╔════════════╗  ╔════════════╗  ╔═════════╗ │
│   ║ [editorial ║  ║ [editorial ║  ║[editorial║ │
│   ║   photo]   ║  ║   photo]   ║  ║  photo] ║ │
│   ║            ║  ║            ║  ║         ║ │
│   ║ İndigo     ║  ║ Black Slim ║  ║ Vintage ║ │
│   ║ Classic    ║  ║ $79        ║  ║ $95     ║ │
│   ║ $89        ║  ║            ║  ║         ║ │
│   ╚════════════╝  ╚════════════╝  ╚═════════╝ │
└──────────────────────────────────────────────┘
```

---

## 10.4 AI İNTEQRASİYASI (Groq) — Kataloqda

> Modul #22: AI integration

### Məhsul Description (avtomatik)
```
Input: məhsul atributları (rəng, fit, yuyulma, material)
Groq prompt:
  "Bu cins şalvar üçün cəlbedici marketinq təsviri yaz.
   Atributlar: İndigo, Classic Fit, Stone Wash, 12oz denim.
   Dil: Azərbaycan + İngilis. Moda jurnalı tonu."
Output: 
  AZ: "İndigo rəngli klassik kəsim cins şalvar..."
  EN: "Indigo classic fit jeans with stone wash..."
```

### Digər AI funksiyaları kataloqda
```
- Avtomatik tag/keyword generasiyası
- SEO meta title/description
- Kolleksiya hekayəsi (storytelling)
- Şəkil alt-text (accessibility)
- Müştəri sorğusuna görə məhsul tövsiyəsi
```

### (Opsional) AI Şəkil
```
Əgər istifadəçi şəkil generasiyası istəyirsə:
- Məhsul mockup
- Background dəyişimi
- Model üzərində vizualizasiya
(Groq mətn AI-dır; şəkil üçün ayrı servis lazım ola bilər)
```

---

## 10.5 MƏHSUL YARATMA AXINI

```
1. Əsas məlumat (ad, kateqoriya, model kodu)
2. Atributlar (rəng, fit, yuyulma, ölçülər)
3. Şəkil yükləmə (Firebase Storage)
4. AI ilə description generasiyası (Groq) — düymə ilə
5. Qiymət (topdan/pərakəndə) + endirim tier
6. BOM bağlama (və ya yarat)
7. SEO (AI köməyi)
8. Aktiv et
```

---

## 10.6 KATALOQ FİLTRLƏRİ (Müştəri üçün)

```
- Kateqoriya (kişi/qadın/uşaq)
- Fit (classic/slim/skinny)
- Rəng
- Yuyulma effekti
- Qiymət aralığı
- Ölçü (mövcud olanlar)
- Kolleksiya/mövsüm
- Yeni gələnlər / Endirimlər
```

---

## 10.7 B2B SİFARİŞ (Kataloqdan)

```
Gmail ilə girən müştəri:
1. Kataloqdan məhsul seçir
2. Ölçü/rəng/miqdar (size run: 28×2, 30×3, 32×5...)
3. Səbətə əlavə
4. Topdan qiymət + endirim avtomatik
5. Sifariş göndər → Sales Order (status: new)
6. Satış meneceri təsdiqləyir
7. Müştəri öz sifarişlərini izləyir (status)
```

---

**Növbəti fayl:** `11_DASHBOARD_REPORTS.md` - Executive Dashboard + Hesabatlar
