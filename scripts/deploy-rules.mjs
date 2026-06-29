/**
 * Firestore Security Rules-u Admin SDK access-token ilə birbaşa deploy edir
 * (firebaserules.googleapis.com). `firebase` CLI login tələb etmir.
 *
 *   node scripts/deploy-rules.mjs
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
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ FIREBASE_ADMIN_* tapılmadı.');
  process.exit(1);
}

const cred = admin.credential.cert({ projectId, clientEmail, privateKey });
admin.initializeApp({ credential: cred });

async function token() {
  const t = await cred.getAccessToken();
  return t.access_token;
}

async function api(method, url, body, accessToken) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { ok: res.ok, status: res.status, json };
}

async function deployRuleset(file, releaseName, accessToken) {
  const content = readFileSync(join(root, file), 'utf8');
  // 1) ruleset yarat
  const create = await api(
    'POST',
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    { source: { files: [{ name: file, content }] } },
    accessToken,
  );
  if (!create.ok) {
    console.error(`❌ ${file} ruleset yaradılmadı (${create.status}):`, JSON.stringify(create.json).slice(0, 300));
    return false;
  }
  const rulesetName = create.json.name;
  console.log(`✅ Ruleset yaradıldı: ${rulesetName}`);

  // 2) mövcud release-i sil (varsa) və yenidən yarat
  const relUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/${releaseName}`;
  await api('DELETE', relUrl, null, accessToken); // varsa silinir, yoxdursa 404 — fərq etmir

  const post = await api(
    'POST',
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
    { name: `projects/${projectId}/releases/${releaseName}`, rulesetName },
    accessToken,
  );
  if (!post.ok) { console.error(`❌ release POST (${post.status}):`, JSON.stringify(post.json).slice(0, 300)); return false; }
  console.log(`✅ Release aktiv edildi: ${releaseName}`);
  return true;
}

(async () => {
  const accessToken = await token();
  console.log('🚀 Firestore rules deploy edilir...');
  const okFs = await deployRuleset('firestore.rules', 'cloud.firestore', accessToken);

  // Storage rules — opsional (IAM icazəsi olmaya bilər; xəta sakitcə ötürülür)
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (bucket && process.env.DEPLOY_STORAGE_RULES === '1') {
    console.log('🚀 Storage rules deploy edilir...');
    await deployRuleset('storage.rules', `firebase.storage/${bucket}`, accessToken).catch((e) => console.warn('Storage rules ötürüldü:', e.message));
  }

  console.log(okFs ? '\n🎉 Firestore rules aktivdir.' : '\n⚠️ Firestore rules deploy alınmadı.');
  process.exit(okFs ? 0 : 1);
})().catch((e) => { console.error('❌ Xəta:', e.message); process.exit(1); });
