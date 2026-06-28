# 👖 JEANS ERP/MES — Texniki Tələblər (Claude Code üçün)

Bu repozitoriya **cins şalvar istehsalı** üçün tam ERP/MES sisteminin texniki spesifikasiyasıdır.
Claude Code bu sənədlərə əsasən tətbiqi sıfırdan qurmalıdır.

## 🛠 Texnoloji Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts
- **Database/Backend:** Google Firebase (Firestore, Auth, Storage, Cloud Functions, FCM)
- **AI:** Groq (Llama 3.3 70B) — xülasə, invoice, məhsul description, AZ/EN chatbot
- **Dil:** Azərbaycanca (UI) + İngilis terminlər; next-intl ilə AZ/EN
- **Deploy:** GitHub → Vercel (avtomatik)
- **Dizayn referansı:** Birtask & Gradex layihələri

## 📖 OXUMA ARDICILLIĞI (vacibdir)

| № | Fayl | Məzmun |
|---|------|--------|
| 00 | [00_OVERVIEW.md](./00_OVERVIEW.md) | Ümumi baxış, arxitektura, biznes dövrü, denim sənaye konteksti |
| 01 | [01_AUTH_RBAC.md](./01_AUTH_RBAC.md) | Auth, Gmail login, 8 rol, icazə matrisi, User/Role/Access Management |
| 02 | [02_RAW_MATERIAL.md](./02_RAW_MATERIAL.md) | Xam material anbarı, 14 kateqoriya, **FIFO/AVCO**, qaimə/təhvil-təslim |
| 03 | [03_BOM_COSTING.md](./03_BOM_COSTING.md) | Ölçüyə görə BOM, **maya dəyəri**, avtomatik stok azalması |
| 04 | [04_CONTACTS_CRM.md](./04_CONTACTS_CRM.md) | Kontragentlər, Customer Management, CRM pipeline |
| 05 | [05_PROCUREMENT.md](./05_PROCUREMENT.md) | PR, **PO**, **GRN**, 3-way matching |
| 06 | [06_PRODUCTION_WASHING.md](./06_PRODUCTION_WASHING.md) | İstehsal mərhələləri, **yuyulma + itki faizi**, QC |
| 07 | [07_FINISHED_GOODS.md](./07_FINISHED_GOODS.md) | Hazır məhsul, planlama, **overstock/out-of-stock** |
| 08 | [08_SALES_POS.md](./08_SALES_POS.md) | Sifariş, **POS**, **Kassa** modulu |
| 09 | [09_FINANCE.md](./09_FINANCE.md) | Maliyyə, mühasibatlıq, AR/AP, P&L, ƏDV |
| 10 | [10_CATALOG_AI.md](./10_CATALOG_AI.md) | Məhsul kataloqu, photo upload, moda jurnalı dizaynı, AI |
| 11 | [11_DASHBOARD_REPORTS.md](./11_DASHBOARD_REPORTS.md) | **Executive Dashboard**, hesabat və analitika |
| 12 | [12_AI_INTEGRATION.md](./12_AI_INTEGRATION.md) | Groq inteqrasiyası, chatbot (AZ/EN), RAG |
| 13 | [13_NOTIFICATIONS.md](./13_NOTIFICATIONS.md) | Bildirişlər, stok xəbərdarlıqları (FCM/email/in-app) |
| 14 | [14_FIREBASE_SCHEMA.md](./14_FIREBASE_SCHEMA.md) | ~35 Firestore kolleksiyası, sxem, index |
| 15 | [15_DESIGN_SYSTEM.md](./15_DESIGN_SYSTEM.md) | Dizayn sistemi, responsive, PWA |
| 16 | [16_DEPLOYMENT.md](./16_DEPLOYMENT.md) | Vercel deploy, env, **6 fazalı yol xəritəsi** |

## ✅ 27 Tələbin Əhatə Xəritəsi
Xam material+maya (02,03) · Anbar giriş/çıxış+sənədlər+FIFO/AVCO (02) · Executive Dashboard (11) · Yuyulma+itki (06) · Hazır məhsul planlama (07) · WIP→hazır keçid (06,07) · Overstock/Out-of-stock (07,13) · Kontragentlər+CRM (04) · Sifariş/PO/GRN (05,08) · Kassa/POS (08) · Maliyyə/mühasibatlıq (09) · Hesabat/analitika (11) · User/Role/Access Mgmt (01) · Məhsul kataloqu+model idarəsi+AI+moda dizaynı (10) · Gmail login→catalog (01,10) · Customer Mgmt (04) · BOM (03).

## 🚀 Başlama
Claude Code: **00_OVERVIEW.md** ilə başla, sonra 16_DEPLOYMENT.md-dəki 6 fazalı yol xəritəsinə əməl et. Faza 1-dən (foundation + auth + RBAC) başla.
