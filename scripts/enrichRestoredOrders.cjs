#!/usr/bin/env node
/**
 * إثراء الطلبات المستعادة (real_cld_*) ببيانات ملفات الطلاب.
 *   node scripts/enrichRestoredOrders.cjs --service=9
 */
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const admin = require('firebase-admin');
const CLOUD_NAME = 'dpjnaefed';
const API_KEY = process.env.CLOUDINARY_API_KEY || '441411461172178';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'FJqt4NGMBOW49DhdvTpW9-SPNZ8';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');

const args = process.argv.slice(2);
const serviceFilter = (args.find((a) => a.startsWith('--service=')) || '').split('=')[1] || null;

function initFirebase() {
  if (admin.apps.length) return admin.firestore();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Firebase credentials missing in .env.local');
  }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKeyRaw.replace(/\\n/gm, '\n'),
    }),
  });
  return admin.firestore();
}

function buildRequestData(student, serviceId) {
  const s = student || {};
  const fullNameAr = s.fullNameArabic || s.full_name_arabic || s.full_name || 'طالب';
  const phone = s.whatsappNumber || s.phone || s.phoneNumber || s.mobile || '';
  const track = s.track || s.track_name || s.course || '';
  const base = {
    full_name_arabic: fullNameAr,
    national_id: s.nationalID || s.national_id || '',
    whatsapp_number: phone,
    phone_whatsapp: phone,
    email: s.email || '',
    track,
    student_names: fullNameAr,
    diploma_type: s.diplomaType || s.diploma_type || 'عام تربوي',
    diploma_year: s.diplomaYear || s.diploma_year || '2026',
  };
  if (serviceId === '9') {
    base.leader_whatsapp = phone;
    base.project_title = s.project_title || s.projectTitle || s.course || 'مشروع التخرج';
    base.group_link = s.group_link || s.groupLink || '';
  }
  return base;
}

function isPlaceholder(field, value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  if (!s || s === '-' || s === 'طالب') return true;
  if (field === 'project_title' && (s === 'مشروع التخرج' || s === 'طلب خدمة')) return true;
  return false;
}

function mergeData(existing, fresh) {
  const merged = { ...existing };
  for (const [k, v] of Object.entries(fresh)) {
    if (v == null) continue;
    if (isPlaceholder(k, merged[k]) && !isPlaceholder(k, v)) merged[k] = v;
  }
  return merged;
}

async function fetchCloudinaryGrouped(serviceId) {
  const all = [];
  let cursor = null;
  do {
    const body = { expression: 'public_id:serviceRequests/*', max_results: 500 };
    if (cursor) body.next_cursor = cursor;
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH_HEADER },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    all.push(...(data.resources || []));
    cursor = data.next_cursor;
  } while (cursor);

  const map = new Map();
  for (const asset of all) {
    const parts = (asset.public_id || '').split('/');
    let sid = '';
    let svc = '';
    for (const p of parts) {
      if (/^(1[0-1]|[1-9])$/.test(p)) { svc = p; break; }
    }
    for (const p of parts) {
      if (p !== 'serviceRequests' && p !== svc && p.length >= 8 && !p.includes('.')) { sid = p; break; }
    }
    if (!sid || !svc) continue;
    if (serviceId && svc !== serviceId) continue;
    const key = `${svc}__${sid}`;
    map.set(key, { studentId: sid, serviceId: svc });
  }
  return map;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getStudentWithRetry(db, id, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    try {
      const snap = await db.collection('students').doc(id).get();
      return snap.exists ? snap.data() : null;
    } catch (e) {
      if (!String(e.message).includes('RESOURCE_EXHAUSTED')) throw e;
      await sleep(3000 * (i + 1));
    }
  }
  return null;
}

async function main() {
  console.log('=== Enrich restored orders from student profiles ===');
  const db = initFirebase();
  const grouped = await fetchCloudinaryGrouped(serviceFilter);
  console.log(`Orders to enrich: ${grouped.size}`);

  let enriched = 0;
  let missing = 0;
  let i = 0;

  for (const { studentId, serviceId } of grouped.values()) {
    i++;
    process.stdout.write(`\r  ${i}/${grouped.size} — enriched: ${enriched}, missing: ${missing}`);

    const student = await getStudentWithRetry(db, studentId);
    await sleep(800);

    if (!student) {
      missing++;
      continue;
    }

    const docId = `real_cld_${serviceId}_${studentId}`;
    const colName = `serviceRequests_${serviceId}`;
    const ref = db.collection(colName).doc(docId);

    let existing = {};
    try {
      const snap = await ref.get();
      existing = snap.exists ? snap.data().data || {} : {};
    } catch (e) {
      if (String(e.message).includes('RESOURCE_EXHAUSTED')) {
        await sleep(5000);
        continue;
      }
    }

    const fresh = buildRequestData(student, serviceId);
    const merged = mergeData(existing, fresh);

    try {
      await ref.set({ data: merged, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      enriched++;
    } catch (e) {
      if (String(e.message).includes('RESOURCE_EXHAUSTED')) {
        await sleep(5000);
        i--;
        continue;
      }
      throw e;
    }
  }

  console.log(`\n\n✅ Enriched: ${enriched}, no student profile: ${missing}`);
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
