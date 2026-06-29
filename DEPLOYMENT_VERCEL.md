# 🚀 Vercel Deploy Bələdçisi

## 1. Repo-nu Vercel-ə import et

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. GitHub hesabını bağla → `Nizamitahirov/Uperp` repo-sunu seç → **Import**
3. Framework: **Next.js** (avtomatik aşkarlanır). Build/Output ayarlarına toxunma.

> **Branch:** Vercel hər branch üçün avtomatik **Preview** URL yaradır. Cari iş
> branch-ı `claude/github-repo-setup-9juy8l` push olunan kimi preview deploy alacaq.
> **Production** (əsas domen) üçün branch-ı `main`-ə merge etmək lazımdır.

---

## 2. Environment Variables (Vercel → Settings → Environment Variables)

Aşağıdakıları **bütün mühitlərə** (Production + Preview + Development) əlavə et:

### Client (public — NEXT_PUBLIC)
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCwg26x5CQw2Tj6uvXwxr8rT2VTqPen5nM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=up-erp-4d6e5.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=up-erp-4d6e5
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=up-erp-4d6e5.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1059879582290
NEXT_PUBLIC_FIREBASE_APP_ID=1:1059879582290:web:763ab06d3a13b0f30b3d8b
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-1JY4QEN7MP
```

### Server-only (gizli — AI üçün)
```
GROQ_API_KEY=<.env.local-dakı dəyər>
```

> ⚠️ `GROQ_API_KEY`-i Vercel-də **Sensitive** kimi işarələ. Heç vaxt `NEXT_PUBLIC_` prefiksi ilə əlavə etmə.

---

## 3. Firebase Console — Vercel domenini icazəli et

Google/Gmail girişinin deploy olunmuş URL-də işləməsi üçün:

**Firebase Console → Authentication → Settings → Authorized domains → Add domain**
- `your-project.vercel.app` (Vercel verdiyi domen)
- preview deploy üçün də `*.vercel.app` domenlərini əlavə edə bilərsən

---

## 4. Deploy

- **Deploy** düyməsi (və ya hər `git push` avtomatik deploy edir).
- Build ~1-2 dəqiqə. Bitəndən sonra URL açılır.

---

## 5. İlk yoxlama (deploy-dan sonra)

1. `/login` açılır → **director@uperp.az / Director@2026** ilə daxil ol
   (əvvəlcə Firebase Auth aktiv + `npm run seed` işlədilməlidir — bax README).
2. Dashboard, materiallar, satış modulları işləməlidir.
3. AI insights/chatbot Vercel-də işləyəcək (Groq açarı serverdə).

---

## Tez-tez rast gəlinən problemlər

| Problem | Həll |
|---------|------|
| Login-də "auth/invalid-api-key" | Env dəyişənləri əlavə edilməyib və ya yenidən deploy lazımdır |
| Google login "unauthorized domain" | Firebase → Authorized domains-ə Vercel domenini əlavə et |
| AI 500/502 | `GROQ_API_KEY` Vercel-də yoxdur və ya səhvdir |
| Firestore "Missing index" | `firebase deploy --only firestore:indexes` işlət |
| Boş data | `npm run seed` + Firestore rules deploy |
