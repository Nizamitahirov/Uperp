/**
 * Admin bootstrap / seed skripti (idempotent).
 *
 * İşə salma:
 *   node scripts/seed.mjs
 *
 * .env.local-dan FIREBASE_ADMIN_* dəyişənlərini oxuyur və:
 *  1. Director email/parol Auth istifadəçisi yaradır (varsa ötür)
 *  2. Firestore users/{uid} profilini (role: director) yazır
 *  3. settings/global parametrlərini qoyur
 *  4. Default kassa + valyuta məzənnəsi yaradır
 *
 * ƏTRAF: heç bir sirr commit OLUNMUR — açarlar yalnız .env.local-dadır.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env.local sadə parser ───────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* .env.local yoxdursa, mövcud env-dən istifadə olunur */
  }
}
loadEnv();

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ FIREBASE_ADMIN_* dəyişənləri tapılmadı (.env.local).');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
const auth = admin.auth();
const db = admin.firestore();

// Konfiqurasiya edilə bilən director məlumatları (env ilə override)
const DIRECTOR_EMAIL = process.env.SEED_DIRECTOR_EMAIL || 'director@uperp.az';
const DIRECTOR_PASSWORD = process.env.SEED_DIRECTOR_PASSWORD || 'Director@2026';
const DIRECTOR_NAME = process.env.SEED_DIRECTOR_NAME || 'Sistem Direktoru';

async function ensureDirector() {
  let user;
  try {
    user = await auth.getUserByEmail(DIRECTOR_EMAIL);
    console.log(`ℹ️  Director artıq mövcuddur: ${DIRECTOR_EMAIL}`);
  } catch {
    user = await auth.createUser({ email: DIRECTOR_EMAIL, password: DIRECTOR_PASSWORD, displayName: DIRECTOR_NAME, emailVerified: true });
    console.log(`✅ Director Auth yaradıldı: ${DIRECTOR_EMAIL}`);
  }
  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      username: 'director',
      email: DIRECTOR_EMAIL,
      fullName: DIRECTOR_NAME,
      role: 'director',
      isActive: true,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      notificationPrefs: { channels: ['in_app'], types: [] },
    },
    { merge: true },
  );
  console.log(`✅ Firestore profil (role: director) yazıldı: ${user.uid}`);
}

async function ensureSettings() {
  await db.collection('settings').doc('global').set(
    {
      companyName: 'Cins Şalvar İstehsalı MMC',
      baseCurrency: 'AZN',
      vatRate: 18,
      defaultCostingMethod: 'FIFO',
      wholesaleMarkup: 1.1,
      retailMarkup: 1.9,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log('✅ settings/global yazıldı');
}

async function ensureCashRegister() {
  const snap = await db.collection('cash_registers').limit(1).get();
  if (!snap.empty) {
    console.log('ℹ️  Kassa artıq mövcuddur');
    return;
  }
  await db.collection('cash_registers').add({
    name: 'Əsas kassa',
    type: 'cash',
    currency: 'AZN',
    currentBalance: 0,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✅ Default kassa yaradıldı');
}

async function ensureExchangeRates() {
  await db.collection('exchange_rates').doc('latest').set(
    { base: 'AZN', rates: { USD: 1.7, EUR: 1.85, TRY: 0.05, CNY: 0.24 }, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true },
  );
  console.log('✅ exchange_rates/latest yazıldı');
}

(async () => {
  console.log('🌱 Bootstrap başlayır...\n');
  let authOk = true;
  try {
    await ensureDirector();
  } catch (e) {
    authOk = false;
    console.warn('⚠️  Director yaradıla bilmədi:', e.message);
    console.warn('    → Firebase Console → Authentication → "Get started" + Email/Password aktiv et, sonra yenidən cəhd et.');
  }
  try {
    await ensureSettings();
    await ensureCashRegister();
    await ensureExchangeRates();
  } catch (e) {
    console.error('❌ Firestore yazıla bilmədi:', e.message);
    console.error('    → Firebase Console → Firestore Database yarat (production mode).');
    process.exit(1);
  }
  console.log('\n🎉 Firestore seed tamamlandı.');
  if (authOk) {
    console.log('────────────────────────────────────────');
    console.log(`  Giriş: ${DIRECTOR_EMAIL}`);
    console.log(`  Parol: ${DIRECTOR_PASSWORD}`);
    console.log('  (İlk girişdən sonra parolu dəyişin!)');
    console.log('────────────────────────────────────────');
  }
  process.exit(0);
})().catch((e) => {
  console.error('❌ Xəta:', e.message);
  process.exit(1);
});
