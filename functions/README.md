# UP ERP — Cloud Functions

Server-tərəfi avtomatlaşdırma:

- **aiAssistant** — Groq AI proxy (onCall)
- **checkOverstock**, **arReminders** — gündəlik scheduled işlər
- **Workflow icra mühərriki** (`workflow.ts`):
  - Firestore triggerləri: `wfSalesCreated`, `wfSalesStatus`, `wfPOCreated`,
    `wfExpenseCreated`, `wfGrnCreated`, `wfProductionCreated`,
    `wfCustomerCreated`, `wfCatalogPublished`
  - `wfProcessDelays` (hər 10 dəq) — **delay** addımlarını real davam etdirir
  - `wfStockScan` (gündəlik) — `stock.below_reorder` triggeri
  - `arReminders` → `invoice.overdue` triggeri

GROQ açarı Secret Manager əvəzinə `functions/.env` faylından oxunur
(`GROQ_API_KEY=...`) — bu fayl git-ə düşmür.

## Deploy

> Tələb: Blaze planı (aktivdir). Aşağıdakı API-lər **bir dəfə** aktiv olmalıdır.
> `deployer` service account bu API-ləri aktiv edə bilmir (serviceusage icazəsi yox),
> ona görə bu addımı layihə sahibi (owner) etməlidir.

### 1. Lazımi API-ləri aktiv et (owner, bir dəfə)
```bash
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com \
  cloudfunctions.googleapis.com run.googleapis.com eventarc.googleapis.com \
  cloudscheduler.googleapis.com pubsub.googleapis.com --project up-erp-4d6e5
```
(və ya Console → APIs & Services → hər birini Enable)

### 2. Deploy (owner hesabı ilə ən sadə)
```bash
cd functions && npm install && npm run build && cd ..
npx firebase-tools login
npx firebase-tools deploy --only functions --project up-erp-4d6e5
```

### 3. (Alternativ) deployer SA ilə deploy
API-lər aktivdirsə və SA-ya bu rollar verilibsə:
`cloudfunctions.admin`, `run.admin`, `artifactregistry.admin`, `eventarc.admin`,
`cloudbuild.builds.editor`, `iam.serviceAccountUser`, `cloudscheduler.admin`, `pubsub.editor`
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/serviceAccount.json
npx firebase-tools deploy --only functions --project up-erp-4d6e5 --non-interactive
```

### 4. Deploy-dan sonra — ikiqat icranın qarşısını al
Vercel-də environment variable əlavə et:
```
NEXT_PUBLIC_SERVER_WORKFLOWS=1
```
Bu, client-side dispatch-i söndürür (engine yalnız server-də işləyir).
Təyin edilməsə, avtomatlaşdırma **client-side** işləməyə davam edir (hazırda belədir).
