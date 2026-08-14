#!/usr/bin/env node
/**
 * استعادة كافة طلبات الخدمات من صور Cloudinary إلى Firestore.
 * يجلب كل الصور (2613+) مع pagination — لا يتوقف عند 500.
 *
 *   node scripts/restoreOrdersFromCloudinary.cjs
 *   node scripts/restoreOrdersFromCloudinary.cjs --service=9
 *   node scripts/restoreOrdersFromCloudinary.cjs --dry-run
 */
const fs = require('fs');
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

const RESTORED_PREFIXES = ['restored_', 'exact_', 'real_auto_', 'real_cld_', 'real_grad_'];
const ALL_SERVICES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipDelete = args.includes('--skip-delete');
const skipStudents = args.includes('--skip-students');
const serviceFilter = (args.find((a) => a.startsWith('--service=')) || '').split('=')[1] || null;

function initFirebase() {
  if (admin.apps.length) return admin.firestore();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/gm, '\n'),
      }),
    });
    return admin.firestore();
  }

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson && String(saJson).trim().startsWith('{')) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saJson)) });
    return admin.firestore();
  }

  throw new Error('Firebase credentials missing in .env.local (FIREBASE_PROJECT_ID+CLIENT_EMAIL+PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT)');
}

function parsePublicId(publicId) {
  const parts = (publicId || '').split('/');
  let serviceId = '';
  let studentId = '';

  for (const p of parts) {
    if (/^(1[0-1]|[1-9])$/.test(p)) {
      serviceId = p;
      break;
    }
  }

  for (const p of parts) {
    if (p !== 'serviceRequests' && p !== serviceId && p.length >= 8 && !p.includes('.')) {
      studentId = p;
      break;
    }
  }
  if (!studentId && parts.length >= 2) studentId = parts[1];

  return { studentId, serviceId: serviceId || '1' };
}

async function fetchAllCloudinaryResources() {
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
    if (data.error) throw new Error(`Cloudinary: ${data.error.message || JSON.stringify(data.error)}`);

    all.push(...(data.resources || []));
    cursor = data.next_cursor;
    process.stdout.write(`\r  Cloudinary: ${all.length} / ${data.total_count || '?'} images`);
  } while (cursor);

  console.log('');
  return all;
}

function buildRequestData(student, serviceId) {
  const s = student || {};
  const fullNameAr = s.fullNameArabic || s.full_name_arabic || s.full_name || 'طالب';
  const fullNameEn = s.vehicleNameEnglish || s.fullNameEnglish || s.full_name_english || '';
  const phone = s.whatsappNumber || s.phone || s.phoneNumber || s.mobile || '';
  const natId = s.nationalID || s.national_id || '';
  const email = s.email || '';
  const track = s.track || s.track_name || s.course || '';
  const diplomaType = s.diplomaType || s.diploma_type || 'عام تربوي';
  const diplomaYear = s.diplomaYear || s.diploma_year || '2026';
  const address = s.address
    ? typeof s.address === 'object'
      ? `${s.address.governorate || ''} ${s.address.city || ''} ${s.address.street || ''}`.trim()
      : String(s.address)
    : '';

  const base = {
    full_name_arabic: fullNameAr,
    full_name_english: fullNameEn,
    national_id: natId,
    whatsapp_number: phone,
    phone_whatsapp: phone,
    email,
    address,
    address_details: address,
    diploma_type: diplomaType,
    diploma_year: diplomaYear,
    track,
    student_names: fullNameAr,
  };

  switch (serviceId) {
    case '1':
      base.college = s.college || '';
      base.department = s.department || '';
      base.grade = s.grade || '';
      break;
    case '3':
      base.number_of_copies = s.numberOfCopies || 1;
      base.names_array = [fullNameAr];
      base.tracks_array = [track || 'المسار الأول'];
      break;
    case '5':
      base.educational_specialization = s.specialization || s.department || 'عام';
      break;
    case '6':
      base.selectedCertificate = s.selectedCertificate || 'شهادة تقدير';
      break;
    case '7':
      base.transformation_type = s.transformationType || 'دورة التحول الرقمي';
      base.selectedExamLanguage = s.examLanguage || 'عربي';
      break;
    case '9':
      base.leader_whatsapp = phone;
      base.project_title = s.project_title || s.projectTitle || s.course || 'مشروع التخرج';
      base.group_link = s.group_link || s.groupLink || '';
      break;
    default:
      break;
  }

  return base;
}

function buildDocument(asset, fullNameAr) {
  return {
    id: asset.asset_id || asset.public_id,
    name: `إيصال_${fullNameAr}.jpg`,
    size: asset.bytes || 150000,
    type: 'image/jpeg',
    url:
      asset.secure_url ||
      `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto:best,f_auto/${asset.public_id}.${asset.format || 'jpg'}`,
  };
}

async function loadStudentsByIds(db, studentIds) {
  const map = new Map();
  const ids = [...new Set(studentIds)].filter(Boolean);
  const CHUNK = 30;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    await retry(async () => {
      const refs = chunk.map((id) => db.collection('students').doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap) => {
        if (snap.exists) map.set(snap.id, snap.data());
      });
    });
    process.stdout.write(`\r  Students loaded: ${Math.min(i + CHUNK, ids.length)} / ${ids.length}`);
  }
  console.log('');
  return map;
}

async function retry(fn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      if (!msg.includes('RESOURCE_EXHAUSTED') && !msg.includes('Quota exceeded')) throw e;
      const wait = Math.min(30000, 2000 * (i + 1));
      process.stdout.write(`\n  Quota hit, retry in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function deleteOldRestored(db, serviceIds) {
  let deleted = 0;
  for (const serviceId of serviceIds) {
    const colName = `serviceRequests_${serviceId}`;
    await retry(async () => {
      const snap = await db.collection(colName).get();
      const toDelete = snap.docs.filter((d) => RESTORED_PREFIXES.some((p) => d.id.startsWith(p)));
      for (let i = 0; i < toDelete.length; i += 200) {
        const batch = db.batch();
        toDelete.slice(i, i + 200).forEach((d) => batch.delete(d.ref));
        if (!dryRun) await batch.commit();
        deleted += Math.min(200, toDelete.length - i);
      }
    });
  }
  console.log(`  Old restored docs ${dryRun ? 'would delete' : 'deleted'}: ${deleted}`);
}

async function main() {
  console.log('=== Cloudinary → Firestore Order Restore ===');
  if (dryRun) console.log('(DRY RUN — no writes)\n');

  const db = initFirebase();
  const resources = await fetchAllCloudinaryResources();

  const byService = {};
  resources.forEach((r) => {
    const { serviceId } = parsePublicId(r.public_id);
    byService[serviceId] = (byService[serviceId] || 0) + 1;
  });
  console.log('  Images by service:', JSON.stringify(byService));

  // Group: one order per student+service, keep latest image by created_at
  const orderMap = new Map();
  for (const asset of resources) {
    const { studentId, serviceId } = parsePublicId(asset.public_id);
    if (!studentId) continue;
    if (serviceFilter && serviceId !== serviceFilter) continue;

    const key = `${serviceId}__${studentId}`;
    const existing = orderMap.get(key);
    const created = asset.created_at ? new Date(asset.created_at).getTime() : 0;
    const existingCreated = existing?.createdMs || 0;

    if (!existing || created >= existingCreated) {
      orderMap.set(key, { asset, studentId, serviceId, createdMs: created });
    }
  }

  console.log(`  Unique orders to restore: ${orderMap.size}`);

  let studentMap = new Map();
  if (!skipStudents) {
    studentMap = await loadStudentsByIds(
      db,
      [...orderMap.values()].map((o) => o.studentId)
    );
  } else {
    console.log('  Skipping student profile load (--skip-students)');
  }

  const serviceIds = serviceFilter ? [serviceFilter] : [...new Set([...orderMap.values()].map((o) => o.serviceId))];
  if (!skipDelete) {
    await deleteOldRestored(db, serviceIds.length ? serviceIds : ALL_SERVICES.filter((s) => s !== '1'));
  } else {
    console.log('  Skipping delete of old restored docs (--skip-delete)');
  }

  let written = 0;
  const entries = [...orderMap.values()];
  const countsByService = {};

  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    await retry(async () => {
      const batch = db.batch();

      for (const { asset, studentId, serviceId } of chunk) {
        const student = studentMap.get(studentId) || {};
        const fullNameAr = student.fullNameArabic || student.full_name_arabic || student.full_name || 'طالب';
        const colName = `serviceRequests_${serviceId}`;
        const docId = `real_cld_${serviceId}_${studentId}`;
        const createdAt = asset.created_at ? admin.firestore.Timestamp.fromDate(new Date(asset.created_at)) : admin.firestore.FieldValue.serverTimestamp();

        batch.set(
          db.collection(colName).doc(docId),
          {
            id: docId,
            studentId,
            serviceId,
            status: 'completed',
            data: buildRequestData(student, serviceId),
            documents: [buildDocument(asset, fullNameAr)],
            paymentMethod: 'Vodafone',
            createdAt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (!dryRun) await batch.commit();
    });

    for (const { studentId, serviceId } of chunk) {
      countsByService[serviceId] = (countsByService[serviceId] || 0) + 1;
      written++;
    }

    process.stdout.write(`\r  Written: ${written} / ${entries.length}`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n\n✅ Restore complete!');
  console.log('  Orders by service:', JSON.stringify(countsByService, null, 2));
  console.log(`  Total: ${written}${dryRun ? ' (dry run)' : ''}`);
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
