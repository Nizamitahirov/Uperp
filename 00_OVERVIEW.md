# CİNS ŞALVAR İSTEHSALI ERP/MES SİSTEMİ
## CLAUDE CODE ÜÇÜN TAM TEXNİKİ ŞƏRT (TECHNICAL SPECIFICATION)

> **Versiya:** 3.0 (Production-Ready Specification)
> **Tarix:** 2026
> **Hədəf platforma:** Web (Vercel deployment) + Mobile-friendly (responsive)
> **Database:** Google Firebase (Firestore + Authentication + Storage)
> **AI:** Groq AI inteqrasiyası (LLM)
> **Dil:** Azərbaycanca (UI), texniki terminlər İngiliscə
> **Repository:** GitHub → Vercel auto-deploy

---

## 📑 ÜMUMİ MÜNDƏRİCAT

| # | Bölmə | Fayl |
|---|-------|------|
| 0 | **Bu fayl** - Giriş, Arxitektura, Tech Stack, Data Model | `00_OVERVIEW.md` |
| 1 | İstifadəçi, Rol, Access Management (RBAC) | `01_AUTH_RBAC.md` |
| 2 | Xam Material Anbarı + Costing (FIFO/AVCO) | `02_RAW_MATERIAL.md` |
| 3 | BOM Kalkulyasiya + Maya Dəyəri | `03_BOM_COSTING.md` |
| 4 | Kontragentlər (Suppliers + Customers) + CRM | `04_CONTACTS_CRM.md` |
| 5 | Satınalma (PR → PO → GRN) | `05_PROCUREMENT.md` |
| 6 | İstehsal (MES) + Yuyulma (Washing) | `06_PRODUCTION_WASHING.md` |
| 7 | Hazır Məhsul Anbarı + Planlaşdırma | `07_FINISHED_GOODS.md` |
| 8 | Satış, Sifariş, POS, Kassa | `08_SALES_POS.md` |
| 9 | Maliyyə və Mühasibatlıq | `09_FINANCE.md` |
| 10 | Məhsul Kataloqu + Model İdarəçiliyi (AI) | `10_CATALOG_AI.md` |
| 11 | Executive Dashboard + Hesabat/Analitika | `11_DASHBOARD_REPORTS.md` |
| 12 | AI İnteqrasiyası (Groq) - Bütün modullar | `12_AI_INTEGRATION.md` |
| 13 | Bildirişlər (Overstock/Out-of-stock) | `13_NOTIFICATIONS.md` |
| 14 | Firebase Data Schema (tam) | `14_FIREBASE_SCHEMA.md` |
| 15 | UI/UX Dizayn Sistemi (Birtask/Gradex) | `15_DESIGN_SYSTEM.md` |
| 16 | Deployment (Vercel) + DevOps | `16_DEPLOYMENT.md` |

---

# 0. LAYİHƏ HAQQINDA ÜMUMİ MƏLUMAT

## 0.1 Layihənin Məqsədi

Cins şalvar (denim jeans) istehsalı və satışı ilə məşğul olan fabriklər üçün **tam inteqrasiya olunmuş, bulud əsaslı ERP + MES (Manufacturing Execution System)** platforması.

Sistem aşağıdakı tam biznes dövrünü əhatə edir:

```
Xam Material Alışı (Çin/Türkiyə)
        ↓
Anbar Qəbulu (GRN) + Costing (FIFO/AVCO)
        ↓
BOM əsasında İstehsal Planlaşdırması
        ↓
İstehsal Prosesi (Cutting → Sewing → ...)
        ↓
Yuyulma (Washing - kənar və ya daxili)
        ↓
Keyfiyyət Nəzarəti (QC)
        ↓
Hazır Məhsul Anbarı
        ↓
Satış (B2B Topdan / B2C Pərakəndə / POS)
        ↓
Maliyyə + Mühasibatlıq + Analitika
```

## 0.2 Əsas Biznes Tələbləri

1. **Xam mal-material anbarı** - maya dəyəri hesablama, ölçüyə görə BOM
2. **Anbar giriş/çıxış** - avtomatik sənəd (qaimə, təhvil-təslim), FIFO/AVCO
3. **Executive Dashboard** - real-time KPI-lar
4. **Yuyulma idarəsi** - kənar laundry-yə təhvil, itki (shrinkage) faizi
5. **Hazır məhsul planlaşdırması** - tələb proqnozu
6. **İstehsaldan hazır məhsula keçid** - WIP → Finished Goods
7. **Overstock bildirişləri**
8. **Out-of-stock bildirişləri**
9. **Kontragentlər** (Suppliers + Customers)
10. **CRM** - müştəri münasibətləri
11. **Sifariş** idarəsi
12. **PO** (Purchase Order)
13. **GRN** (Goods Received Note)
14. **Kassa** modulu
15. **POS** modulu
16. **Maliyyə və mühasibatlıq**
17. **Hesabat və analitika**
18-20. **User / Role / Access Management** (RBAC)
21. **Məhsul kataloqu**
22. **Model/kataloq idarəsi** - photo upload, AI, moda jurnalı dizaynı
23. **Gmail ilə giriş** - alıcılar üçün avtomatik kataloq girişi
24-26. **Customer Management** + rollar (anbardar, mühasib, admin)
27. **BOM kalkulyasiya**

## 0.3 Texnoloji Stack

### Frontend
```yaml
Framework: Next.js 14+ (App Router)
Language: TypeScript
UI Library: React 18+
Styling: Tailwind CSS + shadcn/ui
State: Zustand (yüngül) və ya React Query (server state)
Charts: Recharts (dashboard)
Forms: React Hook Form + Zod (validasiya)
Tables: TanStack Table (data grid)
Icons: Lucide React
PDF: react-pdf / jsPDF (qaimə, faktura)
Excel: SheetJS (xlsx import/export)
Date: date-fns
i18n: next-intl (AZ/EN)
```

### Backend / Database
```yaml
Platform: Google Firebase
  - Firestore (NoSQL database, real-time)
  - Firebase Authentication (Email/Password + Google OAuth)
  - Firebase Storage (şəkillər, sənədlər, PDF)
  - Firebase Cloud Functions (server-side logic, triggers)
  - Firebase Cloud Messaging (push notifications)
Security: Firestore Security Rules (rol əsaslı)
```

### AI
```yaml
Provider: Groq AI (sürətli LLM inference)
Models: Llama 3.3 70B / Mixtral (Groq-da mövcud olanlar)
İstifadə halları:
  - Xülasə hazırlama (summary)
  - Invoice/faktura mətn tərtibi
  - Məhsul description (AZ + EN)
  - AI Chatbot (sual-cavab, AZ + EN)
  - Hesabat şərhi (insights)
  - Inventar proqnozu köməyi
  - Müştəri email draft
```

### Deployment / DevOps
```yaml
Hosting: Vercel (Next.js native)
Source: GitHub repository
CI/CD: Vercel auto-deploy (git push → deploy)
Env: Environment variables (Firebase config, Groq API key)
Domain: Vercel domain / custom domain
Monitoring: Vercel Analytics + Firebase Analytics
```

### Dizayn referansı
```yaml
Style guide: Əvvəlki "Birtask" və "Gradex" layihələrindən
  - Birtask: təmiz, modern dashboard estetikası
  - Gradex: data-rich komponentlər, cədvəllər
Moda jurnalı estetikası: Məhsul kataloqu üçün (Vogue-style)
```

## 0.4 Sistem Arxitekturası

```
┌──────────────────────────────────────────────────┐
│                   CLIENT (Browser/Mobile)          │
│   Next.js 14 + React + Tailwind + shadcn/ui        │
│   - Responsive (desktop/tablet/mobile)             │
│   - PWA capable                                    │
└───────────────────┬──────────────────────────────┘
                    │ HTTPS
        ┌───────────┼───────────┬──────────────┐
        ▼           ▼           ▼              ▼
┌──────────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐
│  Firebase    │ │Firebase│ │ Firebase│ │  Groq AI  │
│  Firestore   │ │  Auth  │ │ Storage │ │   API     │
│  (database)  │ │(login) │ │(files)  │ │  (LLM)    │
└──────────────┘ └────────┘ └─────────┘ └───────────┘
        │
        ▼
┌──────────────────────────────────────────────────┐
│         Firebase Cloud Functions                  │
│  - Stok hərəkəti triggers (auto-update)           │
│  - FIFO/AVCO costing hesablanması                 │
│  - Bildiriş triggers (overstock/out-of-stock)     │
│  - PDF generation (qaimə, faktura)                │
│  - AI request proxy (Groq API key qorunması)      │
│  - Scheduled jobs (proqnoz, hesabat)              │
└──────────────────────────────────────────────────┘
```

## 0.5 Əsas Dizayn Prinsipləri

1. **Mobile-first responsive** - bütün ekranlar telefon/planşetdə işləməlidir
2. **Real-time** - Firestore listener-lər ilə canlı yeniləmə
3. **Optimistic UI** - əməliyyat dərhal görünür, sonra təsdiqlənir
4. **Offline-capable** - Firestore offline persistence
5. **Audit trail** - hər əməliyyat loglanır (kim, nə, nə vaxt)
6. **Rol əsaslı UI** - istifadəçi yalnız səlahiyyəti olan şeyi görür
7. **Azərbaycan dili** - qrammatik cəhətdən düzgün, terminlər EN ola bilər
8. **AI-augmented** - mümkün yerlərdə AI köməyi

## 0.6 Cins Şalvar İstehsalı - Sənaye Konteksti

> **Best practice araşdırması əsasında** (denim manufacturing standards)

### İstehsal mərhələləri (standart denim flow):
```
1. Fabric Inspection (Parça yoxlama)
2. Pattern Making / Marker (Lekal/marker hazırlama)
3. Spreading (Parçanın sərilməsi)
4. Cutting (Kəsim) — bir klassik 5-cib şalvar ≈ 20 parça hissəsi
5. Sewing / Assembly (Tikiş):
   - Pocket attaching (cib tikmə)
   - Side seams (yan tikişlər)
   - Inseam (iç tikiş)
   - Waistband (bel)
   - Belt loops (kəmər ilgəkləri)
   - Bartack (möhkəmləndirici tikiş)
   - Hemming (ətək)
6. Trimming / Hardware (Aksesuar: zamok, düymə, rivet, jakron)
7. Washing (Yuyulma) — kənar laundry-yə təhvil ola bilər
8. Finishing (Ütü, son təmizləmə)
9. Quality Control (Keyfiyyət nəzarəti)
10. Folding & Packing (Qatlama və qablaşdırma)
11. Warehouse / Dispatch (Anbar / Göndərmə)
```

### Parça sərfiyyatı (best practice):
```
Klassik 5-cib regular jeans: ≈ 1.5 metr denim
Selvedge denim: ≈ 2.5 metr
Slim/Skinny: ≈ 1.1-1.3 metr
Bir şalvar ≈ 20 kəsim parçası
```

### Yuyulma növləri (washing) və xüsusiyyətləri:
```
| Növ          | Effekt           | Shrinkage (büzülmə) | Su sərfi |
|--------------|------------------|--------------------|----------|
| Rinse Wash   | minimal          | 1-3%               | aşağı    |
| Enzyme Wash  | yumşaq fade      | 3-5%               | orta     |
| Stone Wash   | vintage, kobud   | 5-7%               | yüksək   |
| Bleach Wash  | açıq rəng        | 4-6%               | yüksək   |
| Acid Wash    | mərmər effekti   | 4-6%               | yüksək   |
| Heavy Stone  | çox köhnə        | 8-12%              | çox yüksək|

⚠️ KRİTİK: Yuyulma 8-12%-ə qədər büzülmə yaradır.
   Lekal kəsimi bunu nəzərə almalıdır (oversize kəsim).
   Sistem yuyulma itki faizini (loss %) izləməlidir.
```

---

## 0.7 Modulların Qarşılıqlı Əlaqəsi (Data Flow)

```
KONTRAGENT (Supplier)
    │
    ├──> PO (Purchase Order)
    │       │
    │       └──> GRN (Goods Received Note)
    │               │
    │               └──> XAM MATERİAL ANBARI (+stok, +cost layer)
    │                       │ (FIFO/AVCO)
    │                       ▼
    │               BOM (hər məhsul üçün resept)
    │                       │
    │                       ▼
    │               İSTEHSAL SİFARİŞİ (Production Order)
    │                       │ (material -stok, çıxış qaiməsi)
    │                       ▼
    │               İSTEHSAL MƏRHƏLƏLƏRİ (Cutting→Sewing→...)
    │                       │
    │                       ▼
    │               YUYULMA (Washing) ──> itki faizi (loss)
    │                       │
    │                       ▼
    │               QC ──> HAZIR MƏHSUL ANBARI (+stok)
    │                       │
    │                       ▼
KONTRAGENT (Customer) <── SATIŞ / SİFARİŞ / POS
    │                       │ (məhsul -stok, faktura)
    │                       ▼
    └──────────────> MALİYYƏ (AR/AP, Kassa, P&L)
                            │
                            ▼
                    DASHBOARD + HESABATLAR + AI INSIGHTS
```

---

**Növbəti fayl:** `01_AUTH_RBAC.md` - İstifadəçi, Rol və Access Management
