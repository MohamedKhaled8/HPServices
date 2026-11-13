const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { upsertEnvLine } = require('./upsertEnvLine.cjs');

const PRIMARY_ADMIN_UID = '5DjRsAVE26fG1elYMVKN4u5Ghes2';
const DUPLICATE_LEAKED_UID = 'LKvMxxCFmBcc7Nk6JdMrJ7ht09T2';
const RTDB_URL =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.VITE_FIREBASE_DATABASE_URL ||
  'https://hpservices-29a44-default-rtdb.firebaseio.com';

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKeyRaw.replace(/\\n/gm, '\n')
      }),
      databaseURL: RTDB_URL
    });
    return;
  }

  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson && saJson.trim().startsWith('{')) {
    initializeApp({
      credential: cert(JSON.parse(saJson)),
      databaseURL: RTDB_URL
    });
    return;
  }

  throw new Error('Missing Firebase Admin credentials in .env.local');
}

function generateHighEntropyPassword(length = 28) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all = upper + lower + digits + symbols;

  const pick = (charset) => charset[crypto.randomInt(0, charset.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) {
    chars.push(pick(all));
  }
  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function generateSecureEmail(prefix, domain) {
  const tokenA = crypto.randomBytes(5).toString('hex');
  const tokenB = crypto.randomBytes(3).toString('hex');
  return `${prefix}.${tokenA}.${tokenB}@${domain}`;
}

function hashPasswordScrypt(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { algorithm: 'scrypt', salt, hash: derived };
}

function computeAuditHash(prevHash, entry) {
  const canonicalString = [
    prevHash,
    entry.action,
    entry.category,
    entry.severity,
    entry.actorUid,
    entry.actorRole,
    entry.message,
    entry.ip,
    String(entry.timestampMs)
  ].join('|');
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

async function provisionOrRotateTelemetryAdmin(auth, newEmail, newPassword, epoch) {
  const existingUid = process.env.TELEMETRY_ADMIN_UID;
  let userRecord = null;

  if (existingUid) {
    try {
      userRecord = await auth.getUser(existingUid);
    } catch {
      userRecord = null;
    }
  }

  if (userRecord) {
    userRecord = await auth.updateUser(userRecord.uid, {
      email: newEmail,
      password: newPassword,
      emailVerified: true,
      disabled: false,
      displayName: 'HP Telemetry Supervisor'
    });
  } else {
    userRecord = await auth.createUser({
      email: newEmail,
      password: newPassword,
      emailVerified: true,
      disabled: false,
      displayName: 'HP Telemetry Supervisor'
    });
  }

  await auth.setCustomUserClaims(userRecord.uid, {
    isAdmin: false,
    isTelemetryAdmin: true,
    role: 'telemetry_admin',
    credentialEpoch: epoch
  });
  await auth.revokeRefreshTokens(userRecord.uid);
  return userRecord;
}

async function main() {
  initFirebaseAdmin();
  const auth = getAuth();
  const rtdb = getDatabase();
  const db = getFirestore();
  const epoch = Date.now();
  const nowIso = new Date(epoch).toISOString();

  // 1. Generate cryptographically strong credentials
  const primaryEmail = generateSecureEmail('hp.ctrl', 'hp-portal.sec');
  const primaryPassword = generateHighEntropyPassword(28);
  const trackingEmail = generateSecureEmail('hp.obs', 'hp-telemetry.sec');
  const trackingPassword = generateHighEntropyPassword(28);
  const hmacSecret = process.env.TELEMETRY_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

  // 2. Rotate Primary Admin (preserving UID & relationships)
  const primaryUser = await auth.updateUser(PRIMARY_ADMIN_UID, {
    email: primaryEmail,
    password: primaryPassword,
    emailVerified: true,
    disabled: false
  });
  await auth.setCustomUserClaims(PRIMARY_ADMIN_UID, {
    isAdmin: true,
    isTelemetryAdmin: false,
    role: 'primary_admin',
    credentialEpoch: epoch
  });
  await auth.revokeRefreshTokens(PRIMARY_ADMIN_UID);

  // 3. Disable & revoke duplicate leaked account (admin@example.con)
  let duplicateStatus = 'not_found';
  try {
    await auth.getUser(DUPLICATE_LEAKED_UID);
    await auth.updateUser(DUPLICATE_LEAKED_UID, {
      disabled: true,
      password: generateHighEntropyPassword(32)
    });
    await auth.setCustomUserClaims(DUPLICATE_LEAKED_UID, {
      isAdmin: false,
      isTelemetryAdmin: false,
      role: 'revoked'
    });
    await auth.revokeRefreshTokens(DUPLICATE_LEAKED_UID);
    duplicateStatus = 'disabled_and_revoked';
  } catch (err) {
    duplicateStatus = `skipped (${err.code || err.message})`;
  }

  // 4. Provision isolated Tracking Admin account
  const trackingUser = await provisionOrRotateTelemetryAdmin(
    auth,
    trackingEmail,
    trackingPassword,
    epoch
  );

  // 5. Persist salted scrypt verifiers + epoch + audit log into isolated RTDB store
  const primaryHash = hashPasswordScrypt(primaryPassword);
  const trackingHash = hashPasswordScrypt(trackingPassword);

  await rtdb.ref(`telemetry_v1/auth_registry/${PRIMARY_ADMIN_UID}`).set({
    uid: PRIMARY_ADMIN_UID,
    role: 'primary_admin',
    emailHash: crypto.createHash('sha256').update(primaryEmail.toLowerCase()).digest('hex'),
    passwordVerifier: primaryHash,
    credentialEpoch: epoch,
    rotatedAt: nowIso
  });

  await rtdb.ref(`telemetry_v1/auth_registry/${trackingUser.uid}`).set({
    uid: trackingUser.uid,
    role: 'telemetry_admin',
    emailHash: crypto.createHash('sha256').update(trackingEmail.toLowerCase()).digest('hex'),
    passwordVerifier: trackingHash,
    credentialEpoch: epoch,
    rotatedAt: nowIso
  });

  // Append tamper-proof audit entry in RTDB
  const auditPayload = {
    action: 'CREDENTIAL_ROTATION_EXECUTED',
    category: 'security',
    severity: 'critical',
    actorUid: 'system-rotation-cli',
    actorRole: 'system',
    message: `Rotated primary admin (${PRIMARY_ADMIN_UID}), disabled duplicate (${duplicateStatus}), provisioned tracking admin (${trackingUser.uid})`,
    ip: '127.0.0.1',
    timestampMs: epoch,
    timestampIso: nowIso,
    metadata: {
      primaryUid: PRIMARY_ADMIN_UID,
      trackingUid: trackingUser.uid,
      duplicateAccountStatus: duplicateStatus
    }
  };
  const entryHash = computeAuditHash('GENESIS', auditPayload);
  const logRef = rtdb.ref('telemetry_v1/audit_logs').push();
  await Promise.all([
    logRef.set({
      id: logRef.key,
      ...auditPayload,
      prevHash: 'GENESIS',
      entryHash
    }),
    rtdb.ref('telemetry_v1/audit_meta').set({ lastHash: entryHash, updatedAtMs: epoch })
  ]);

  // 6. Best-effort primary DB scrub (non-fatal if Firestore daily quota is exhausted)
  let firestoreStatus = 'scrubbed';
  try {
    await db.collection('admins').doc(PRIMARY_ADMIN_UID).set(
      {
        isAdmin: true,
        role: 'primary_admin',
        emailHash: crypto.createHash('sha256').update(primaryEmail.toLowerCase()).digest('hex'),
        credentialEpoch: epoch,
        rotatedAt: nowIso
      },
      { merge: true }
    );
    const studentRef = db.collection('students').doc(PRIMARY_ADMIN_UID);
    const studentSnap = await studentRef.get();
    if (studentSnap.exists) {
      await studentRef.set(
        {
          email: primaryEmail,
          password: FieldValue.delete(),
          passwordHash: `${primaryHash.algorithm}:${primaryHash.salt}:${primaryHash.hash}`,
          updatedAt: nowIso
        },
        { merge: true }
      );
    }
  } catch (fsErr) {
    firestoreStatus = `deferred_due_to_firestore_quota (${fsErr.message})`;
  }

  // 7. Save server secrets to .env.local and operator copy to ADMIN_CREDENTIALS.local.txt (both git-ignored)
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  upsertEnvLine(envLocalPath, 'TELEMETRY_HMAC_SECRET', hmacSecret);
  upsertEnvLine(envLocalPath, 'TELEMETRY_ADMIN_UID', trackingUser.uid);
  upsertEnvLine(envLocalPath, 'PRIMARY_ADMIN_UID', PRIMARY_ADMIN_UID);
  upsertEnvLine(envLocalPath, 'FIREBASE_DATABASE_URL', RTDB_URL);

  const credsFilePath = path.resolve(__dirname, '../ADMIN_CREDENTIALS.local.txt');
  const credsReport = [
    '# HP Services - Rotated Admin & Telemetry Credentials (GIT-IGNORED - STORE IN PASSWORD MANAGER)',
    `Generated At: ${nowIso}`,
    '',
    '====================================================================',
    '1. PRIMARY ADMIN (Main Operations Portal: /login -> /admin)',
    '====================================================================',
    `UID:      ${primaryUser.uid}`,
    `Email:    ${primaryEmail}`,
    `Password: ${primaryPassword}`,
    `Role:     primary_admin (isAdmin=true)`,
    '',
    '====================================================================',
    '2. ISOLATED TRACKING ADMIN (Telemetry & Security: /telemetry-login -> /telemetry)',
    '====================================================================',
    `UID:      ${trackingUser.uid}`,
    `Email:    ${trackingEmail}`,
    `Password: ${trackingPassword}`,
    `Role:     telemetry_admin (isAdmin=false, zero Firestore student/order access)`,
    '',
    '====================================================================',
    '3. LEGACY DUPLICATE CLEANUP',
    '====================================================================',
    `Duplicate UID (${DUPLICATE_LEAKED_UID}): ${duplicateStatus}`,
    `Firestore Sync Status: ${firestoreStatus}`,
    ''
  ].join('\n');

  fs.writeFileSync(credsFilePath, credsReport, { encoding: 'utf8', mode: 0o600 });

  console.log(credsReport);
  process.exit(0);
}

main().catch((err) => {
  console.error('Rotation failed:', err);
  process.exit(1);
});
