/**
 * firestore.indexes.json-dakı composite indeksləri Firestore Admin API ilə yaradır.
 * Service account-da "Cloud Datastore Index Admin" (və ya Editor) rolu olmalıdır.
 *
 *   node scripts/deploy-indexes.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  try {
    const raw = readFileSync(join(root, '.env.local'), 'utf8');
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

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const cred = admin.credential.cert({
  projectId,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
});
admin.initializeApp({ credential: cred });

const BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;

async function main() {
  const token = (await cred.getAccessToken()).access_token;
  const cfg = JSON.parse(readFileSync(join(root, 'firestore.indexes.json'), 'utf8'));
  const indexes = cfg.indexes ?? [];
  let created = 0;
  let exists = 0;
  let failed = 0;

  for (const idx of indexes) {
    const fields = idx.fields.map((f) => {
      const out = { fieldPath: f.fieldPath };
      if (f.arrayConfig) out.arrayConfig = f.arrayConfig;
      else out.order = f.order ?? 'ASCENDING';
      return out;
    });
    const url = `${BASE}/collectionGroups/${idx.collectionGroup}/indexes`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryScope: idx.queryScope ?? 'COLLECTION', fields }),
    });
    const body = await res.json().catch(() => ({}));
    const label = `${idx.collectionGroup} [${idx.fields.map((f) => f.fieldPath).join(', ')}]`;
    if (res.ok) {
      created++;
      console.log(`✅ Yaradıldı: ${label}`);
    } else if (res.status === 409 || JSON.stringify(body).includes('already exists')) {
      exists++;
      console.log(`ℹ️  Mövcuddur: ${label}`);
    } else {
      failed++;
      console.error(`❌ ${label} (${res.status}):`, JSON.stringify(body).slice(0, 200));
    }
  }

  console.log(`\nNəticə: ${created} yaradıldı, ${exists} mövcud, ${failed} xəta.`);
  console.log('Qeyd: indekslər arxa fonda qurulur (READY statusu bir neçə dəqiqə çəkə bilər).');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('❌ Xəta:', e.message); process.exit(1); });
