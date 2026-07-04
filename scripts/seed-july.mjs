/**
 * İyul 2026 üçün zəngin fake satış datası — Dashboard-ı doldurmaq üçün.
 * Cari ay + son 6 ay trendi, kanal payı, ölçü radar, top məhsul/müştəri.
 *   node scripts/seed-july.mjs
 * Admin SDK security rules-u bypass edir. İdempotentdir (sabit ID prefiksi: sj-).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const TS = (d) => admin.firestore.Timestamp.fromDate(d);
const serverNow = admin.firestore.FieldValue.serverTimestamp();

// Deterministik psevdo-random (idempotent nəticələr üçün)
let _seed = 20260704;
const rnd = () => { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));

async function set(path, id, data) {
  await db.collection(path).doc(id).set({ ...data, updatedAt: serverNow }, { merge: true });
}

// ── Referans data ──────────────────────────────────────────
const CUSTOMERS = [
  { id: 'cus-001', name: 'Bakı Trade MMC', channel: 'wholesale' },
  { id: 'cus-002', name: 'Gənclik Mall Butik', channel: 'retail' },
  { id: 'cus-003', name: 'Region Distribyutor', channel: 'wholesale' },
  { id: 'cus-004', name: 'Denim House Baku', channel: 'retail' },
  { id: 'cus-005', name: 'Style Point MMC', channel: 'b2b' },
  { id: 'cus-006', name: 'Online Shop AZ', channel: 'online' },
  { id: 'cus-007', name: 'Ganja Fashion', channel: 'wholesale' },
  { id: 'cus-008', name: 'Sumqayıt Mağaza', channel: 'pos' },
];

const PRODUCTS = [
  { id: 'prd-001', name: 'İndigo Classic Fit', price: 45, img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&q=80' },
  { id: 'prd-002', name: 'Black Slim Fit', price: 42, img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80' },
  { id: 'prd-003', name: 'Vintage Wash', price: 50, img: 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=500&q=80' },
  { id: 'prd-004', name: 'Skinny Blue', price: 48, img: 'https://images.unsplash.com/photo-1475178626620-a4d074967452?w=500&q=80' },
  { id: 'prd-005', name: 'Relaxed Cargo', price: 55, img: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=500&q=80' },
];
const SIZES = ['28-30', '30-32', '32-34', '34-36', '36-38'];
const CHANNELS = ['wholesale', 'retail', 'online', 'pos', 'b2b'];

function makeOrder(id, no, date, deliver) {
  const cust = pick(CUSTOMERS);
  const channel = rnd() < 0.5 ? cust.channel : pick(CHANNELS);
  const lineCount = between(1, 3);
  const items = [];
  let subtotal = 0;
  for (let i = 0; i < lineCount; i++) {
    const p = pick(PRODUCTS);
    const qty = between(5, 60);
    const unitPrice = p.price;
    const lineTotal = +(qty * unitPrice).toFixed(2);
    subtotal += lineTotal;
    items.push({ productId: p.id, productName: p.name, variantSku: `${p.id}-${pick(SIZES)}`, size: pick(SIZES), grade: 'A', quantity: qty, unitPrice, discount: 0, lineTotal });
  }
  const vatAmount = +(subtotal * 0.18).toFixed(2);
  const totalAmount = +(subtotal + vatAmount).toFixed(2);
  return {
    soNumber: no, customerId: cust.id, customerName: cust.name, channel,
    date: TS(date), items, subtotal, discountAmount: 0, vatAmount, totalAmount,
    paymentMethod: pick(['transfer', 'cash', 'credit']), paymentStatus: deliver ? 'paid' : 'unpaid',
    paidAmount: deliver ? totalAmount : 0, status: deliver ? 'delivered' : pick(['new', 'confirmed', 'preparing']),
    reserved: true, createdBy: 'director', createdAt: TS(date),
  };
}

async function run() {
  console.log('🌱 İyul 2026 satış datası yüklənir...\n');

  // ── Müştəriləri təmin et ───────────────────────────────
  for (const c of CUSTOMERS) {
    await set('customers', c.id, { code: c.id.toUpperCase(), name: c.name, type: c.channel === 'retail' ? 'retail' : 'wholesale', status: 'active', createdAt: serverNow });
  }
  console.log(`✅ ${CUSTOMERS.length} müştəri`);

  // ── Məhsullara şəkil əlavə et (thumbnail üçün) ─────────
  for (const p of PRODUCTS) {
    await set('products', p.id, {
      sku: p.id.toUpperCase(), modelCode: p.id.toUpperCase(), name: { az: p.name, en: p.name },
      category: 'men', fit: 'regular', wholesalePrice: p.price, retailPrice: Math.round(p.price * 1.9), cost: Math.round(p.price * 0.62),
      status: 'active', sizes: SIZES,
      images: [{ url: p.img, type: 'main', isPrimary: true }],
      createdAt: serverNow,
    });
  }
  console.log(`✅ ${PRODUCTS.length} məhsul (şəkilli)`);

  // ── Satış sifarişləri: son 6 ay + cari ay (iyul) ───────
  const now = new Date(2026, 6, 4); // 2026-07-04
  let idx = 0;
  let julTotal = 0;
  const monthCounts = {};

  // Keçmiş 5 ay (Fev–İyun): hər ay 8–14 çatdırılmış sifariş → trend qrafiki
  for (let mo = 5; mo >= 1; mo--) {
    const d0 = new Date(2026, 6 - mo, 1);
    const count = between(8, 14);
    for (let i = 0; i < count; i++) {
      const day = between(1, 27);
      const date = new Date(d0.getFullYear(), d0.getMonth(), day, between(9, 18), between(0, 59));
      const id = `sj-${String(++idx).padStart(3, '0')}`;
      const no = `SO-2026-${String(1000 + idx)}`;
      await set('sales_orders', id, makeOrder(id, no, date, true));
    }
    monthCounts[6 - mo] = count;
  }

  // Cari ay (İyul): 34 çatdırılmış + 6 aktiv (pipeline)
  for (let i = 0; i < 40; i++) {
    const day = between(1, 4); // ayın 1–4-ü (bugünə qədər)
    const date = new Date(2026, 6, day, between(9, 20), between(0, 59));
    const deliver = i < 34;
    const id = `sj-${String(++idx).padStart(3, '0')}`;
    const no = `SO-2026-${String(1000 + idx)}`;
    const order = makeOrder(id, no, date, deliver);
    if (deliver) julTotal += order.totalAmount;
    await set('sales_orders', id, order);
  }
  console.log(`✅ ${idx} satış sifarişi (iyul çatdırılmış cəmi: ${julTotal.toFixed(0)} AZN)`);

  // ── Aylıq satış hədəfini təyin et (≈ 78% dolma) ────────
  const target = Math.round(julTotal / 0.78 / 1000) * 1000;
  await db.collection('settings').doc('global').set({ monthlySalesTarget: target, updatedAt: serverNow }, { merge: true });
  console.log(`✅ Aylıq satış hədəfi: ${target} AZN (dolma ≈ ${Math.round((julTotal / target) * 100)}%)`);

  console.log('\n🎉 Hazırdır! Dashboard: hədəf circle, trend, kanal donut, ölçü radar, top məhsul/müştəri dolu olmalıdır.');
  process.exit(0);
}

run().catch((e) => { console.error('❌ Xəta:', e.message); process.exit(1); });
