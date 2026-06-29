# 👖 JEANS ERP/MES — Texniki Tələblər (Claude Code üçün)

Bu repozitoriya **cins şalvar istehsalı** üçün tam ERP/MES sisteminin texniki spesifikasiyası **və tətbiqidir**.

> 📦 **Tətbiq statusu:** Bütün 6 faza implementasiya edilib (`16_DEPLOYMENT.md` yol xəritəsi):
>
> - **Faza 1 — Təməl:** Next.js 14 + Firebase + TypeScript, auth (email + Gmail/Google), RBAC (8 rol + səlahiyyət matrisi), User/Role Management, dizayn sistemi, responsive layout, i18n (AZ/EN).
> - **Faza 2 — Anbar + Costing:** stok hərəkətləri, FIFO/AVCO + landed cost, PO/GRN, bildiriş sistemi (real-time bell + mərkəz), material detal (cost layers), PO/GRN çap.
> - **Faza 3 — İstehsal (MES):** məhsul kataloqu + AI description (Groq), size-based BOM + costing, istehsal sifarişi + avtomatik stok çıxımı, yuyulma + itki izləmə, QC, hazır məhsul.
> - **Faza 4 — Satış:** müştərilər + CRM (Kanban), satış sifarişi + rezervasiya + faktura/AR, POS + kassa, debitor/kreditor (AR/AP) + ödənişlər, geri qaytarma.
> - **Faza 5 — Maliyyə + Analitika:** xərclər, executive dashboard (real KPI + Recharts + AI insights), hesabatlar (P&L, satış, inventar), overstock bildiriş.
> - **Faza 6 — AI + Kataloq + Polish:** AI chatbot (RAG-lite), müştəri kataloqu (moda jurnalı) + B2B sifariş + sifariş izləmə, PWA (service worker), tənzimləmələr.

## ⚡ Quraşdırma (Local)

```bash
npm install
cp .env.example .env.local   # və dəyərləri doldur
npm run dev                  # http://localhost:3000
npm run build                # production build
```

`.env.local`-da **Firebase Web App config** (Console → Project Settings → Your apps → Web app) tələb olunur:
`NEXT_PUBLIC_FIREBASE_API_KEY`, `..._MESSAGING_SENDER_ID`, `..._APP_ID`. Qalan dəyərlər (`PROJECT_ID`,
`AUTH_DOMAIN`, `STORAGE_BUCKET`) layihə ID-sindən törəyir. Groq açarı və Admin SDK yalnız server tərəfdə
(Cloud Functions) istifadə olunur və **heç vaxt client-ə düşmür**.

> ⚠️ `.env.local` git-ə commit OLUNMUR (`.gitignore`-dadır). Sirləri orada saxla.

## 🌱 İlk quraşdırma (Bootstrap)

1. **Firebase Console → Authentication → Get started** → **Email/Password** və **Google** provayderlərini aktiv et.
2. **Firestore Database** yarat (production mode).
3. İlk direktor hesabını və default parametrləri yarat:
   ```bash
   npm run seed
   ```
   Bu skript `director@uperp.az` / `Director@2026` hesabını (Auth + Firestore profil,
   `role: director`), `settings/global`, default kassa və valyuta məzənnələrini yaradır.
   Email/parol və adı `SEED_DIRECTOR_EMAIL`, `SEED_DIRECTOR_PASSWORD` env ilə dəyişə bilərsən.
4. Qaydaları və indeksləri deploy et:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

---


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
