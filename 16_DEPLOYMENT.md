# 16. DEPLOYMENT (Vercel) + DEVOPS

> GitHub → Vercel auto-deploy + Firebase backend

---

## 16.1 DEPLOYMENT ARXİTEKTURASI

```
GitHub Repository
   │ git push (main branch)
   ▼
Vercel (auto-deploy)
   ├── Next.js frontend (SSR/SSG/Client)
   └── API routes (lazımsa)
   │
   ▼
Firebase (backend)
   ├── Firestore (database)
   ├── Authentication
   ├── Storage
   ├── Cloud Functions (deploy ayrıca)
   └── Cloud Messaging
   │
   ▼
Groq API (env variable ilə)
```

---

## 16.2 ENVIRONMENT VARIABLES

```bash
# .env.local (Vercel-də əlavə edilir)

# Firebase (client - public, NEXT_PUBLIC prefix)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Server-only (Cloud Functions, NEVER client)
GROQ_API_KEY=                    # yalnız Cloud Function-da
FIREBASE_ADMIN_PRIVATE_KEY=      # admin SDK
FIREBASE_ADMIN_CLIENT_EMAIL=
```

> **KRİTİK:** Groq API key heç vaxt client-də olmamalıdır. Yalnız Cloud Function env.

---

## 16.3 FOLDER STRUCTURE (Next.js 14 App Router)

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/          # Gmail customer
│   ├── (dashboard)/           # protected, rol əsaslı
│   │   ├── dashboard/
│   │   ├── materials/
│   │   ├── bom/
│   │   ├── suppliers/
│   │   ├── customers/
│   │   ├── crm/
│   │   ├── procurement/       # PR, PO, GRN
│   │   ├── production/
│   │   ├── washing/
│   │   ├── finished-goods/
│   │   ├── sales/
│   │   ├── pos/
│   │   ├── cash/
│   │   ├── finance/
│   │   ├── reports/
│   │   ├── users/
│   │   └── settings/
│   ├── (catalog)/             # customer-facing
│   │   ├── catalog/           # moda jurnalı
│   │   └── my-orders/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                    # shadcn/ui
│   ├── shared/                # ümumi
│   ├── charts/                # Recharts wrappers
│   └── ai/                    # AI komponentləri
├── lib/
│   ├── firebase/              # config, auth, firestore helpers
│   ├── ai/                    # Groq client (Cloud Function call)
│   ├── costing/               # FIFO/AVCO logic
│   ├── pdf/                   # sənəd generasiyası
│   ├── utils/
│   └── validations/          # Zod schemas
├── hooks/                     # custom React hooks
├── stores/                    # Zustand
├── types/                     # TypeScript types
├── messages/                  # i18n (az.json, en.json)
├── functions/                 # Firebase Cloud Functions
│   ├── src/
│   │   ├── stock/             # stock triggers, FIFO/AVCO
│   │   ├── notifications/
│   │   ├── ai/                # Groq proxy
│   │   ├── pdf/
│   │   └── scheduled/        # cron jobs
│   └── package.json
├── firestore.rules            # security rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 16.4 DEPLOYMENT ADDIMLARI

```bash
# 1. Firebase setup
firebase init   # Firestore, Functions, Storage, Hosting(opsional)

# 2. Cloud Functions deploy
cd functions && npm install
firebase deploy --only functions

# 3. Firestore rules + indexes deploy
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage:rules

# 4. Frontend → Vercel
# GitHub repo bağla → Vercel import → env əlavə et → deploy
# Sonra hər git push avtomatik deploy olur
```

---

## 16.5 CI/CD

```
GitHub → Vercel:
- main branch → production deploy
- PR → preview deploy (test)
- Avtomatik build + deploy
- Build xətası olarsa deploy dayanır

Firebase Functions:
- GitHub Actions (opsional) → firebase deploy
- Və ya manual deploy
```

---

## 16.6 MONITORING

```
- Vercel Analytics (performans, traffic)
- Firebase Analytics (istifadəçi davranış)
- Firebase Crashlytics / error logging
- Firestore usage monitoring (quota)
- Cloud Functions logs
```

---

## 16.7 İNKİŞAF YOL XƏRİTƏSİ (Roadmap - Faza-faza)

> Claude Code üçün tövsiyə olunan inkişaf ardıcıllığı

### Faza 1: Təməl (MVP Core)
```
1. Firebase setup + Auth (email + Google)
2. RBAC (user/role/access)
3. Design system (shadcn/ui + Tailwind)
4. Layout (sidebar, responsive)
5. Raw materials CRUD
6. Suppliers CRUD
```

### Faza 2: Anbar + Costing
```
7. Stock movements + FIFO/AVCO
8. PO + GRN
9. Landed cost
10. Sənəd PDF generasiyası
11. Stock notifications (low/out)
```

### Faza 3: İstehsal
```
12. Products CRUD
13. BOM (size-based) + costing
14. Production orders + auto stock deduction
15. Washing module + loss tracking
16. QC + finished goods
```

### Faza 4: Satış
```
17. Customers + CRM
18. Sales orders + reservation
19. POS + cash module
20. Invoices + AR/AP
21. Returns
```

### Faza 5: Maliyyə + Analitika
```
22. Finance (P&L, expenses)
23. Executive dashboard
24. Reports + report builder
25. Overstock notifications
```

### Faza 6: AI + Kataloq + Polish
```
26. Groq AI integration (all use cases)
27. AI chatbot
28. Product catalog (moda jurnalı)
29. Gmail customer self-service
30. PWA + mobile polish
31. i18n (AZ/EN tam)
```

---

## 16.8 TEXNİKİ QEYDLƏR (Claude Code üçün)

```
✅ TypeScript strict mode
✅ Zod validation hər formda
✅ Firestore offline persistence aktiv
✅ Optimistic UI (mutation)
✅ React Query / SWR (server state cache)
✅ Error boundaries
✅ Loading states (skeleton)
✅ Audit log hər kritik əməliyyatda
✅ Cloud Functions transaction (stok dəqiqliyi üçün)
✅ FIFO/AVCO atomicity (Firestore transaction)
✅ Rate limiting (AI, auth)
✅ Bütün UI mətnləri i18n (AZ default)
✅ Grammatik düzgün Azərbaycan dili
✅ Mobile-first hər səhifə
```

---

## 16.9 KRİTİK BİZNES QAYDALARI (Xülasə)

```
1. İstehsal başlayanda material AVTOMATİK stokdan çıxır (FIFO/AVCO)
2. GRN material qəbulunda cost layer yaranır
3. Yuyulma itkisi (8-12%) maya dəyərinə əlavə olunur
4. Ölçü böyüdükcə parça sərfiyyatı artır (size-based BOM)
5. COGS satış anında posting olunur (FIFO/AVCO)
6. Stok rezerv: sifariş təsdiqdə, açılır ləğvdə
7. 3-way matching (PO↔GRN↔Invoice) ödənişdən əvvəl
8. Out-of-stock real-time, overstock gündəlik scheduled
9. Customer Gmail ilə girir → avtomatik kataloq
10. Bütün məbləğlər AZN-ə çevrilir (məzənnə ilə)
```

---

## ✅ SƏNƏD TAMAMLANDI

Bütün 17 fayl GitHub repository-yə qoyula bilər. Claude Code bu spesifikasiya əsasında modul-modul inkişaf edə bilər (Faza 1-dən başlayaraq).

**Texnologiya:** Next.js 14 + Firebase + Groq AI + Vercel
**Dil:** Azərbaycanca (UI) + İngiliscə (terminlər)
**Platforma:** Web + Mobile-friendly (PWA)
