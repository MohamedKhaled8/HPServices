import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  setPersistence,
  inMemoryPersistence,
  getAuth
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  orderBy,
  deleteDoc,
  documentId,
  writeBatch,
  limit,
  startAfter,
  getCountFromServer,
  increment
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage, firebaseConfig } from '../config/firebase';
import { supabase, ASSIGNMENTS_BUCKET } from '../config/supabaseClient';
import { CLOUDINARY_CONFIG, UPLOAD_PRESET } from '../config/cloudinary';
import { uploadMultipleToCloudStorage, CloudProvider } from './cloudStorageService';
import { StudentData, ServiceRequest, ServiceRequestWorkflowStatus, UploadedFile, BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig, DigitalTransformationConfig, FinalReviewConfig, GraduationProjectConfig, AssignedFile, ServiceSettings, StatementEnrollmentConfig, DistributionReport } from '../types';
import type { Query, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { checkRateLimit } from '../utils/security';
import { triggerWhatsAppNotification } from '../utils/whatsapp';
import { classifyAssignment, AssignmentCategory, resolveStudentSpecialization, isSpecializationMatch, normalizeSpecialization } from '../utils/assignmentClassifier';
import { SERVICES } from '../constants/services';
import { PlatformTelemetryEmitter } from '../modules/telemetry/infrastructure/emitters/PlatformTelemetryEmitter';
import { syncStudentAssignmentsOnTrackChange, getTrackKey, trackKeyToDisplayName } from './studentTrackSyncService';

export { syncStudentAssignmentsOnTrackChange, getTrackKey, trackKeyToDisplayName } from './studentTrackSyncService';

const MAX_FILE_SIZE_MB = 10; // Max 10MB per file
const MAX_DOC_SIZE_KB = 1024; // 1MB Firestore doc limit warning

export type TrackKey = 'track1' | 'track2' | 'track3';

export interface AssignmentFileMeta {
  id: string;
  name: string;
  url: string;
  track: TrackKey;
  storagePath: string;
  /** مسار مجلد افتراضي داخل التبويب (مثل: "folderA/sub") */
  folderPath?: string;
  uploadedAt?: any;
}

export interface AssignmentFolderMeta {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  createdAt?: any;
}

// Auth Functions
export const registerUser = async (email: string, password: string, studentData: StudentData): Promise<FirebaseUser> => {
  try {
    // Security: Rate limiting
    if (!checkRateLimit('register', 3, 60000)) {
      throw new Error('محاولات متكررة جداً. يرجى المحاولة بعد دقيقة.');
    }
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Save student data to Firestore
    const studentDataWithId = {
      ...studentData,
      id: user.uid,
      email: email,
      password: password,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'students', user.uid), studentDataWithId);
    void incrementPlatformStudentsCount();

    return user;
  } catch (error: any) {
    let errorMessage = 'حدث خطأ أثناء التسجيل، يرجى المحاولة مرة أخرى.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول أو استخدام بريد إلكتروني آخر.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'البريد الإلكتروني المدخل غير صالح.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'كلمة المرور ضعيفة جداً. يجب أن تتكون من 6 أحرف على الأقل.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    throw new Error(errorMessage);
  }
};

export interface FoundStudentResult {
  docId: string;
  data: StudentData;
}

/**
 * Convert Arabic-Indic (Eastern Arabic) numerals (٠-٩) and Persian numerals (۰-۹) to standard ASCII (0-9)
 */
export const convertArabicIndicToAscii = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

/**
 * Universal Student Search in Firestore:
 * Searches flexibly across:
 * 1. Document ID / UID
 * 2. Email (exact and lowercase)
 * 3. National ID (14 digits, strings, numbers, variations: nationalID, national_id, nationalId, nid)
 * 4. Phone / WhatsApp (raw, stripped digits, Egyptian prefixes 01..., +201..., 201...)
 * 5. Student Names (Arabic fullNameArabic, full_name, vehicleNameEnglish, fullNameEnglish)
 */
export const findStudentInFirestore = async (rawIdentifier: string): Promise<FoundStudentResult | null> => {
  if (!rawIdentifier) return null;
  const originalClean = rawIdentifier.trim();
  if (!originalClean) return null;
  const clean = convertArabicIndicToAscii(originalClean).trim();
  const lower = clean.toLowerCase();
  const digitsOnly = clean.replace(/\D/g, '');
  const isEmailInput = clean.includes('@') || originalClean.includes('@');
  const studentsRef = collection(db, 'students');

  const runQueriesSequentially = async (queries: Query<DocumentData>[]): Promise<FoundStudentResult | null> => {
    for (const q of queries) {
      try {
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          return { docId: docSnap.id, data: { id: docSnap.id, ...(docSnap.data() as Record<string, any>) } as StudentData };
        }
      } catch (_) {}
    }
    return null;
  };

  // 1. Direct doc lookup by UID or custom document ID (skip when clearly an email)
  if (!isEmailInput) {
    const directIds = Array.from(new Set([clean, originalClean, digitsOnly].filter(Boolean)));
    for (const did of directIds) {
      try {
        const directSnap = await getDoc(doc(db, 'students', did));
        if (directSnap.exists()) {
          const data = directSnap.data();
          return { docId: directSnap.id, data: { id: directSnap.id, ...data } as StudentData };
        }
      } catch (_) {}
    }
  }

  // 2. Email lookup (exact or lowercase, deduplicated — return early if not found)
  if (isEmailInput) {
    const emailCandidates = Array.from(new Set([lower, clean, originalClean.toLowerCase()].filter(Boolean)));
    const emailQueries = emailCandidates.map((val) => query(studentsRef, where('email', '==', val), limit(1)));
    return runQueriesSequentially(emailQueries);
  }

  // 3. National ID lookup (14 digits or >=13 digits)
  if (digitsOnly.length >= 13) {
    const strValues = Array.from(new Set([clean, digitsOnly, originalClean].filter(Boolean)));
    const natFields = ['nationalID', 'national_id', 'nationalId', 'nationalNumber', 'national_number', 'nid'];
    const natQueries: Query<DocumentData>[] = [];
    for (const field of ['nationalID', 'national_id', 'nationalId']) {
      for (const v of strValues) {
        natQueries.push(query(studentsRef, where(field, '==', v), limit(1)));
      }
    }
    for (const field of natFields.slice(3)) {
      natQueries.push(query(studentsRef, where(field, '==', digitsOnly), limit(1)));
    }
    if (/^\d+$/.test(digitsOnly)) {
      const numVal = Number(digitsOnly);
      natQueries.push(query(studentsRef, where('nationalID', '==', numVal), limit(1)));
      natQueries.push(query(studentsRef, where('national_id', '==', numVal), limit(1)));
      natQueries.push(query(studentsRef, where('nationalId', '==', numVal), limit(1)));
    }
    const foundNat = await runQueriesSequentially(natQueries);
    if (foundNat || digitsOnly.length === 14) {
      return foundNat;
    }
  }

  // 4. WhatsApp / Phone lookup (only when input actually looks like a phone number)
  if (digitsOnly.length >= 8 && digitsOnly.length <= 13) {
    const rawValues = Array.from(new Set([clean, originalClean, digitsOnly].filter(Boolean)));
    const phoneQueries: Query<DocumentData>[] = [];
    for (const field of ['whatsappNumber', 'phone', 'phoneNumber', 'mobile']) {
      for (const v of rawValues) {
        phoneQueries.push(query(studentsRef, where(field, '==', v), limit(1)));
      }
    }
    phoneQueries.push(query(studentsRef, where('whatsapp', '==', clean), limit(1)));
    phoneQueries.push(query(studentsRef, where('tel', '==', clean), limit(1)));

    if (digitsOnly.startsWith('01') && digitsOnly.length === 11) {
      phoneQueries.push(query(studentsRef, where('whatsappNumber', '==', '+2' + digitsOnly), limit(1)));
      phoneQueries.push(query(studentsRef, where('whatsappNumber', '==', '2' + digitsOnly), limit(1)));
      phoneQueries.push(query(studentsRef, where('phone', '==', '+2' + digitsOnly), limit(1)));
      phoneQueries.push(query(studentsRef, where('phone', '==', '2' + digitsOnly), limit(1)));
    } else if ((digitsOnly.startsWith('201') || clean.startsWith('+201')) && digitsOnly.length === 12) {
      const local = '0' + digitsOnly.slice(2);
      phoneQueries.push(query(studentsRef, where('whatsappNumber', '==', local), limit(1)));
      phoneQueries.push(query(studentsRef, where('whatsappNumber', '==', '+' + digitsOnly), limit(1)));
      phoneQueries.push(query(studentsRef, where('phone', '==', local), limit(1)));
      phoneQueries.push(query(studentsRef, where('phone', '==', '+' + digitsOnly), limit(1)));
    }

    if (/^\d+$/.test(digitsOnly)) {
      const numVal = Number(digitsOnly);
      phoneQueries.push(query(studentsRef, where('whatsappNumber', '==', numVal), limit(1)));
      phoneQueries.push(query(studentsRef, where('phone', '==', numVal), limit(1)));
    }

    return runQueriesSequentially(phoneQueries);
  }

  // 5. Name lookup (Arabic / English)
  if (digitsOnly.length < 7 && originalClean.length >= 2) {
    const normArabic = normalizeArabicText(originalClean);
    const nameQueries = [
      query(studentsRef, where('fullNameArabic', '==', originalClean), limit(1)),
      query(studentsRef, where('full_name_arabic', '==', originalClean), limit(1)),
      query(studentsRef, where('full_name', '==', originalClean), limit(1)),
      query(studentsRef, where('fullName', '==', originalClean), limit(1)),
      query(studentsRef, where('name', '==', originalClean), limit(1)),
      query(studentsRef, where('vehicleNameEnglish', '==', originalClean), limit(1)),
      ...(lower !== originalClean ? [query(studentsRef, where('vehicleNameEnglish', '==', lower), limit(1))] : []),
      query(studentsRef, where('fullNameEnglish', '==', originalClean), limit(1)),
      ...(lower !== originalClean ? [query(studentsRef, where('fullNameEnglish', '==', lower), limit(1))] : []),
      query(studentsRef, where('full_name_english', '==', originalClean), limit(1)),
      query(studentsRef, where('name_en', '==', originalClean), limit(1)),
    ];
    if (normArabic && normArabic !== originalClean) {
      nameQueries.push(query(studentsRef, where('fullNameArabic', '==', normArabic), limit(1)));
      nameQueries.push(query(studentsRef, where('full_name_arabic', '==', normArabic), limit(1)));
    }
    return runQueriesSequentially(nameQueries);
  }

  return null;
};

/**
 * Migrates service requests from a legacy student ID to their current Firebase Auth UID.
 * Ensures the student sees all their past orders seamlessly.
 */
export const migrateStudentOrders = async (
  oldStudentId: string,
  newStudentId: string,
  nationalID?: string
): Promise<number> => {
  if (!oldStudentId || !newStudentId || oldStudentId === newStudentId) return 0;
  let migratedCount = 0;
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  for (const serviceId of serviceIds) {
    try {
      const colRef = collection(db, `serviceRequests_${serviceId}`);
      const q = query(colRef, where('studentId', '==', oldStudentId));
      const snap = await getDocs(q);

      const toUpdateDocs = new Set<string>();
      snap.forEach(d => toUpdateDocs.add(d.id));

      if (nationalID) {
        try {
          const qNat = query(colRef, where('nationalID', '==', nationalID));
          const snapNat = await getDocs(qNat);
          snapNat.forEach(d => {
            if (d.data().studentId !== newStudentId) {
              toUpdateDocs.add(d.id);
            }
          });
        } catch (_) {}
      }

      if (toUpdateDocs.size > 0) {
        const batch = writeBatch(db);
        toUpdateDocs.forEach(docId => {
          const docRef = doc(db, `serviceRequests_${serviceId}`, docId);
          batch.set(
            docRef,
            {
              studentId: newStudentId,
              legacyStudentId: oldStudentId,
              migratedAt: serverTimestamp()
            },
            { merge: true }
          );
          migratedCount++;
        });
        await batch.commit();
      }
    } catch (err) {
      logger.error(`Error migrating orders in serviceRequests_${serviceId}:`, err);
    }
  }

  if (migratedCount > 0) {
    logger.info(`Migrated ${migratedCount} service requests from ${oldStudentId} to ${newStudentId}`);
  }
  return migratedCount;
};

export const getStudentEmailByNationalID = async (nationalID: string): Promise<string | null> => {
  try {
    const found = await findStudentInFirestore(nationalID);
    return found?.data?.email || null;
  } catch (error) {
    logger.error('Error finding student by National ID:', error);
    return null;
  }
};

export const loginUser = async (identifier: string, password: string): Promise<FirebaseUser> => {
  try {
    // Security: Rate limiting
    if (!checkRateLimit('login', 5, 60000)) {
      throw new Error('محاولات دخول فاشلة كثيرة. يرجى الانتظار دقيقة.');
    }
    let email = identifier.trim();

    // Check if input is a National ID or Phone
    if (!email.includes('@')) {
      const found = await findStudentInFirestore(email);
      if (found && found.data.email) {
        email = found.data.email;
      } else if (/^\d{14}$/.test(email)) {
        email = `${email}@hpservices.local`;
      } else {
        throw new Error('رقم الهوية غير مسجل في النظام');
      }
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    let errorMessage = 'البيانات المدخلة أو كلمة المرور غير صحيحة';

    if (error.code === 'auth/user-not-found' || error.message === 'رقم الهوية غير مسجل في النظام') {
      errorMessage = 'المستخدم غير موجود. يرجى التأكد من البيانات أو التسجيل أولاً';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'كلمة المرور غير صحيحة';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'البريد الإلكتروني أو رقم الهوية غير صحيح';
    }

    throw new Error(errorMessage);
  }
};

/**
 * Ensures student document exists in Firestore using existing schema fields.
 * If document exists, returns existing data and triggers background order migration if needed.
 * If document does not exist under user.uid, searches for restored legacy record and migrates it.
 */
export const ensureStudentDocExists = async (
  user: FirebaseUser,
  email: string,
  password?: string,
  nationalID?: string
): Promise<StudentData> => {
  const docRef = doc(db, 'students', user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const updates: any = {};
    if (password && data.password !== password) {
      updates.password = password;
    }
    if (!data.email && email) {
      updates.email = email;
    }
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = serverTimestamp();
      try {
        await setDoc(docRef, updates, { merge: true });
        Object.assign(data, updates);
      } catch (e) {
        logger.error('Failed to sync student data updates to Firestore:', e);
      }
    }

    // Auto-heal orders if legacyId is set
    if (data.legacyId && data.legacyId !== user.uid) {
      migrateStudentOrders(data.legacyId, user.uid, data.nationalID).catch(err => {
        logger.error('Background order migration error:', err);
      });
    }

    return {
      ...data,
      id: docSnap.id,
      email: data.email || email,
      password: data.password || password || '',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
    } as StudentData;
  }

  // Document does NOT exist under user.uid!
  // Search for an existing restored record in Firestore by email or identifier
  const existingRecord = await findStudentInFirestore(email || user.email || '');

  if (existingRecord && existingRecord.docId !== user.uid) {
    // Found existing restored record under legacy doc ID!
    // Migrate data from existing record into new user.uid document
    const oldData = existingRecord.data;
    const mergedData: StudentData = {
      ...oldData,
      id: user.uid,
      email: email || user.email || oldData.email || '',
      password: password || oldData.password || '',
      legacyId: existingRecord.docId,
      createdAt: oldData.createdAt || (serverTimestamp() as any)
    };

    await setDoc(
      docRef,
      {
        ...mergedData,
        migratedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    // Run background order migration from legacy ID to new UID
    migrateStudentOrders(existingRecord.docId, user.uid, mergedData.nationalID).catch(err => {
      logger.error('Background order migration error:', err);
    });

    // Mark old doc as migrated
    try {
      await setDoc(
        doc(db, 'students', existingRecord.docId),
        { isMigrated: true, migratedToUid: user.uid, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (_) {}

    return mergedData;
  }

  // Brand-new student
  const initialStudent: StudentData = {
    id: user.uid,
    email: email || user.email || '',
    password: password || '',
    fullNameArabic: '',
    vehicleNameEnglish: '',
    whatsappNumber: '',
    diplomaYear: '',
    diplomaType: '',
    track: '',
    nationalID: nationalID || '',
    address: {
      governorate: '',
      city: '',
      street: '',
      building: '',
      siteNumber: ''
    },
    course: '',
    routeRegistrationCompleted: true,
    createdAt: serverTimestamp() as any
  };

  await setDoc(docRef, initialStudent, { merge: true });
  return initialStudent;
};

const isReservedAdminEmail = (identifier: string): boolean => {
  const lower = identifier.trim().toLowerCase();
  return (
    lower.startsWith('admin@') ||
    lower.includes('admin') ||
    lower.endsWith('@hp-portal.sec') ||
    lower.endsWith('@hp-telemetry.sec')
  );
};

export type AdminRole = 'primary_admin' | 'telemetry_admin' | 'student';

/**
 * Resolves the authenticated role using signed JWT Custom Claims first (0 Firestore reads),
 * falling back to Firestore admins/{userId} only for legacy admin accounts.
 */
export const checkAdminRole = async (userId: string): Promise<AdminRole> => {
  try {
    const current = auth.currentUser;
    if (current && current.uid === userId) {
      const tokenResult = await current.getIdTokenResult();
      const claims = tokenResult.claims as Record<string, unknown>;
      if (claims.role === 'telemetry_admin' || claims.isTelemetryAdmin === true) {
        return 'telemetry_admin';
      }
      if (claims.role === 'primary_admin' || claims.isAdmin === true) {
        return 'primary_admin';
      }
    }
    const adminDoc = await getDoc(doc(db, 'admins', userId));
    if (adminDoc.exists()) {
      const data = adminDoc.data();
      if (data.isAdmin === true) return 'primary_admin';
    }
    return 'student';
  } catch (error) {
    logger.error('Error checking admin role:', error);
    return 'student';
  }
};

const buildAdminProfilePlaceholder = (user: FirebaseUser, role: 'primary_admin' | 'telemetry_admin'): StudentData => ({
  id: user.uid,
  fullNameArabic: role === 'telemetry_admin' ? 'مشرف المراقبة والأمان' : 'مدير النظام',
  vehicleNameEnglish: role === 'telemetry_admin' ? 'Telemetry Admin' : 'Admin',
  whatsappNumber: '',
  diplomaYear: '',
  diplomaType: '',
  track: '',
  nationalID: '',
  address: { governorate: '', city: '', street: '', building: '', siteNumber: '' },
  course: '',
  email: user.email || '',
});

/**
 * Helper to fetch a student's password hint (masked) for forgot-password
 */
export const getStudentPasswordHint = async (identifier: string): Promise<{ password?: string; email?: string; accountExists?: boolean } | null> => {
  const originalClean = identifier.trim();
  const clean = convertArabicIndicToAscii(originalClean).trim();
  if (!clean) return null;

  // حماية أمنية مشددة: حظر تام لأي محاولة استكشاف أو استعلام عن حسابات الأدمن أو المراقبة
  if (isReservedAdminEmail(clean)) {
    return {
      accountExists: false,
      email: clean
    };
  }

  try {
    const found = await findStudentInFirestore(originalClean) || (clean !== originalClean ? await findStudentInFirestore(clean) : null);

    if (found) {
      const docData = found.data as any;
      if (
        docData.role === 'admin' ||
        docData.role === 'primary_admin' ||
        docData.role === 'telemetry_admin' ||
        docData.isAdmin === true ||
        docData.isTelemetryAdmin === true ||
        (docData.email && isReservedAdminEmail(String(docData.email)))
      ) {
        return { accountExists: false, email: clean };
      }
      const pw = docData.password || docData.nationalID || docData.national_id || '';
      return {
        password: pw,
        email: docData.email || clean,
        accountExists: true
      };
    }

    return {
      accountExists: false,
      email: clean
    };
  } catch (error) {
    logger.error('Error fetching student password hint:', error);
    return {
      accountExists: false,
      email: clean
    };
  }
};

/**
 * Single Entrypoint: Login or Automatic Registration with Auto-Healing.
 * - Supports Login via: Email, National ID, Phone Number, or Full Name.
 * - If account exists in Firebase Auth and password matches: Logs in.
 * - If account exists in Firestore (restored/legacy user) but NOT in Firebase Auth:
 *   Validates password and automatically heals the account by creating their Auth user.
 * - If account exists and password is wrong: Throws error (does NOT create new account).
 * - If account does not exist anywhere: Automatically creates account with entered credentials if an email was entered.
 */
export const loginOrRegisterUser = async (
  identifier: string,
  password: string
): Promise<{ user: FirebaseUser; isNewUser: boolean; studentData: StudentData }> => {
  if (!checkRateLimit('login', 15, 60000)) {
    throw new Error('محاولات دخول متكررة. يرجى الانتظار دقيقة.');
  }

  const rawClean = identifier.trim();
  const clean = convertArabicIndicToAscii(rawClean).trim();
  const cleanDigits = clean.replace(/\D/g, '');
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  const reservedAdmin = isEmail && isReservedAdminEmail(clean);

  if (!password) {
    throw new Error('يرجى إدخال كلمة المرور');
  }

  // 1. When identifier is an email (or reserved admin), try direct Auth sign-in first (0 Firestore lookup reads).
  // Only query Firestore before Auth when logging in with National ID / Phone / Name.
  const preFoundStudent = (isEmail || reservedAdmin)
    ? null
    : (await findStudentInFirestore(rawClean)) || (clean !== rawClean ? await findStudentInFirestore(clean) : null);

  // 2. Build candidate emails to attempt direct Firebase Auth sign-in
  const candidateEmails: string[] = [];
  if (isEmail) {
    candidateEmails.push(clean.toLowerCase());
  }
  if (preFoundStudent?.data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(preFoundStudent.data.email)) {
    const studentEmail = preFoundStudent.data.email.trim().toLowerCase();
    if (!candidateEmails.includes(studentEmail)) {
      candidateEmails.push(studentEmail);
    }
  }
  const natId = preFoundStudent?.data.nationalID || (cleanDigits.length === 14 ? cleanDigits : '');
  if (natId && !candidateEmails.includes(`${natId}@hpservices.local`)) {
    candidateEmails.push(`${natId}@hpservices.local`);
  }
  if (cleanDigits.length === 14 && !candidateEmails.includes(`${cleanDigits}@hpservices.local`)) {
    candidateEmails.push(`${cleanDigits}@hpservices.local`);
  }
  if (cleanDigits.length >= 10 && !candidateEmails.includes(`${cleanDigits}@hpservices.local`)) {
    candidateEmails.push(`${cleanDigits}@hpservices.local`);
  }
  if (preFoundStudent?.docId && !candidateEmails.includes(`${preFoundStudent.docId}@hpservices.local`)) {
    candidateEmails.push(`${preFoundStudent.docId}@hpservices.local`);
  }

  // Fallback if no candidate email exists
  if (candidateEmails.length === 0) {
    if (cleanDigits.length >= 10) {
      candidateEmails.push(`${cleanDigits}@hpservices.local`);
    } else if (!isEmail && !preFoundStudent) {
      throw new Error('الحساب غير مسجل في النظام. يرجى التأكد من البريد أو الرقم القومي أو الهاتف.');
    } else {
      candidateEmails.push(clean);
    }
  }

  // 3. Attempt direct sign-in across candidate emails with entered password
  let loggedInUser: FirebaseUser | null = null;
  let lastAuthError: any = null;

  for (const candEmail of candidateEmails) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, candEmail, password);
      loggedInUser = userCredential.user;
      break;
    } catch (err: any) {
      lastAuthError = err;
    }
  }

  if (loggedInUser) {
    const role = await checkAdminRole(loggedInUser.uid);
    if (role === 'primary_admin' || role === 'telemetry_admin') {
      return {
        user: loggedInUser,
        isNewUser: false,
        studentData: buildAdminProfilePlaceholder(loggedInUser, role)
      };
    }
    const studentData = await ensureStudentDocExists(loggedInUser, loggedInUser.email || candidateEmails[0], password);
    return { user: loggedInUser, isNewUser: false, studentData };
  }

  // 4. Direct sign-in did not succeed.
  // Block auto-healing / auto-registration for reserved or leaked admin emails
  if (reservedAdmin) {
    throw new Error('بيانات الدخول غير صحيحة');
  }

  // AUTO-HEALING & LEGACY ACCOUNT RESOLUTION:
  const foundStudent = preFoundStudent ?? (isEmail ? await findStudentInFirestore(clean) : null);

  if (foundStudent) {
    const storedDoc = foundStudent.data as any;
    const storedPassword = (storedDoc.password || '').toString().trim();
    const storedNationalID = (storedDoc.nationalID || storedDoc.national_id || '').toString().trim();
    const storedPhone = (storedDoc.whatsappNumber || storedDoc.phone || '').toString().trim();

    // Check if entered password matches stored password, or national ID, or phone, or was empty
    const passwordMatches =
      (storedPassword && storedPassword === password) ||
      (!storedPassword && storedNationalID && storedNationalID === password) ||
      (storedNationalID && storedNationalID === password) ||
      (storedPhone && storedPhone === password) ||
      !storedPassword;

    if (!passwordMatches) {
      throw new Error('كلمة المرور غير صحيحة');
    }

    // Entered password matches Firestore record!
    // If the account was previously in Auth with an older password (e.g. storedPassword or storedNationalID), try them:
    const altPasswords = [storedPassword, storedNationalID].filter(p => p && p !== password);
    for (const altPass of altPasswords) {
      for (const candEmail of candidateEmails) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, candEmail, altPass);
          // Sync Auth password to what user entered
          try {
            await updatePassword(userCredential.user, password);
            if (foundStudent.docId) {
              await setDoc(doc(db, 'students', foundStudent.docId), { password, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
            }
          } catch (_) {}
          const studentData = await ensureStudentDocExists(userCredential.user, userCredential.user.email || candEmail, password);
          return { user: userCredential.user, isNewUser: false, studentData };
        } catch (_) {}
      }
    }

    // Auto-heal: Create Auth user for the legacy / restored student
    const targetEmail = (foundStudent.data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(foundStudent.data.email))
      ? foundStudent.data.email.trim().toLowerCase()
      : (candidateEmails[0] || `${storedNationalID || foundStudent.docId}@hpservices.local`);

    try {
      const newUserCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
      const studentData = await ensureStudentDocExists(newUserCredential.user, targetEmail, password);
      return { user: newUserCredential.user, isNewUser: false, studentData };
    } catch (createErr: any) {
      if (createErr.code === 'auth/email-already-in-use') {
        // Auth user already exists under targetEmail. Attempt sync via helper or throw clear message
        try {
          await changeOtherUserPasswordHelper(foundStudent.docId, password);
          const retryCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
          const studentData = await ensureStudentDocExists(retryCredential.user, targetEmail, password);
          return { user: retryCredential.user, isNewUser: false, studentData };
        } catch (_) {
          throw new Error('كلمة المرور غير صحيحة');
        }
      }
      throw new Error(createErr.message || 'حدث خطأ أثناء تهيئة الحساب');
    }
  }

  // 5. User does not exist in Firestore:
  // Support one-step account creation via either email OR 14-digit National ID
  if (isEmail || cleanDigits.length === 14) {
    if (password.length < 6) {
      throw new Error('كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل');
    }
    const targetRegEmail = isEmail ? clean.toLowerCase() : `${cleanDigits}@hpservices.local`;
    const regNationalId = !isEmail && cleanDigits.length === 14 ? cleanDigits : '';
    try {
      const newUserCredential = await createUserWithEmailAndPassword(auth, targetRegEmail, password);
      const studentData = await ensureStudentDocExists(
        newUserCredential.user,
        targetRegEmail,
        password,
        regNationalId
      );
      return { user: newUserCredential.user, isNewUser: true, studentData };
    } catch (createError: any) {
      if (createError.code === 'auth/email-already-in-use') {
        throw new Error('كلمة المرور غير صحيحة');
      }
      if (createError.code === 'auth/weak-password') {
        throw new Error('كلمة المرور ضعيفة جداً. يجب أن تتكون من 6 أحرف على الأقل.');
      }
      if (createError.code === 'auth/invalid-email') {
        throw new Error('البريد الإلكتروني المدخل غير صالح.');
      }
      throw new Error(createError.message || 'حدث خطأ أثناء إنشاء الحساب تلقائياً');
    }
  }

  if (lastAuthError?.code === 'auth/wrong-password') {
    throw new Error('كلمة المرور غير صحيحة');
  }
  if (lastAuthError?.code === 'auth/too-many-requests') {
    throw new Error('تم حظر المحاولات مؤقتاً بسبب كثرة الطلبات. يرجى المحاولة لاحقاً.');
  }
  if (lastAuthError?.code === 'auth/network-request-failed') {
    throw new Error('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.');
  }

  throw new Error('الحساب غير مسجل في النظام. يرجى التأكد من البريد أو الرقم القومي أو الهاتف.');
};



export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تسجيل الخروج');
  }
};

export const changeUserPassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('المستخدم غير مسجل الدخول');

  try {
    // 1. Re-authenticate
    const credential = EmailAuthProvider.credential(user.email, oldPassword);
    await reauthenticateWithCredential(user, credential);

    // 2. Update Auth Password
    await updatePassword(user, newPassword);

    // 3. Update Firestore (Student records only; never store admin passwords in plaintext)
    const role = await checkAdminRole(user.uid);
    if (role === 'student') {
      await updateStudentData(user.uid, { password: newPassword } as any);
    }

  } catch (error: any) {
    logger.error('Error changing password:', error);
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('كلمة المرور الحالية غير صحيحة');
    }
    throw new Error('فشل تغيير كلمة المرور: ' + (error.message || 'خطأ غير معروف'));
  }
};



export const sendResetPasswordEmail = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('البريد الإلكتروني غير مسجل');
    }
    throw new Error('حدث خطأ أثناء إرسال البريد: ' + error.message);
  }
};

export const verifyResetCode = async (code: string): Promise<string> => {
  try {
    return await verifyPasswordResetCode(auth, code);
  } catch (error: any) {
    throw new Error('الرابط غير صالح أو منتهي الصلاحية');
  }
};

export const completePasswordReset = async (code: string, newPassword: string, email: string): Promise<void> => {
  try {
    // 1. Confirm Reset in Auth
    await confirmPasswordReset(auth, code, newPassword);

    // 2. Update Firestore (Find user by email)
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('email', '==', email));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const studentDoc = snap.docs[0];
      await updateStudentData(studentDoc.id, { password: newPassword } as any);
    }
  } catch (error: any) {
    throw new Error('فشل تحديث كلمة المرور: ' + error.message);
  }
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Student Data Functions
export const getStudentData = async (userId: string): Promise<StudentData | null> => {
  try {
    const docRef = doc(db, 'students', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
    }
    return null;
  } catch (error: any) {
    // تحسين رسائل الخطأ
    let errorMessage = 'حدث خطأ أثناء جلب البيانات';

    if (error.code === 'permission-denied') {
      errorMessage = 'الأذونات مفقودة. يرجى التحقق من Firestore Security Rules';
    } else if (error.message) {
      errorMessage = error.message;
    }

    logger.error('Error getting student data:', error);
    throw new Error(errorMessage);
  }
};

/**
 * Realtime subscription to a single student doc.
 * This is needed so assignedFiles updates (from admin distribution) appear immediately for students.
 */
export const subscribeToStudentData = (
  userId: string,
  onUpdate: (student: StudentData | null) => void,
  onError?: (error: any) => void
): (() => void) => {
  const docRef = doc(db, 'students', userId);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onUpdate(null);
        return;
      }
      const data = docSnap.data() as any;
      onUpdate({
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData);
    },
    (error) => {
      logger.error('Error subscribing to student data:', error);
      if (onError) onError(error);
    }
  );
};

/** جلب عدة طلاب دفعة واحدة (أسرع من استدعاء getStudentData لكل واحد) */
const FIRESTORE_IN_LIMIT = 30;
export const getStudentsByIds = async (userIds: string[]): Promise<Record<string, StudentData>> => {
  const result: Record<string, StudentData> = {};
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return result;
  try {
    const promises: Promise<any>[] = [];
    for (let i = 0; i < uniqueIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = uniqueIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const q = query(
        collection(db, 'students'),
        where(documentId(), 'in', chunk)
      );
      promises.push(getDocs(q));
    }
    
    const snapshots = await Promise.all(promises);
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const data = docSnap.data();
        result[docSnap.id] = {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as StudentData;
      });
    });
    return result;
  } catch (error: any) {
    logger.error('Error getting students by ids (batch):', error);
    for (const id of uniqueIds) {
      if (result[id]) continue;
      try {
        const docSnap = await getDoc(doc(db, 'students', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          result[id] = {
            ...data,
            id: docSnap.id,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          } as StudentData;
        }
      } catch (singleErr: any) {
        logger.warn(`getStudentsByIds fallback failed for ${id}:`, singleErr?.message);
      }
    }
    return result;
  }
};

export const changeOtherUserPasswordHelper = async (uid: string, newPassword: string): Promise<void> => {
  try {
    // 1. You should set up a Vercel Serverless Function or just call this endpoint.
    // Replace with your Vercel deployment domain or use relative path since we are on Vercel
    const response = await fetch('/api/updateUserPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: uid,
        newPassword: newPassword,
      }),
    });

    const contentType = response.headers.get("content-type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const textData = await response.text();
      throw new Error(`خطأ من الخادم: ${textData.slice(0, 100)}...`);
    }

    if (!response.ok) {
      throw new Error(data.error || 'Server error occurred while updating the password.');
    }

    logger.log('Password updated successfully via Admin SDK');
  } catch (error: any) {
    logger.error('Error in Vercel API password change:', error);
    throw new Error('لم يتم تحديث كلمة المرور في المصادقة. السبب: ' + error.message);
  }
};

export const normalizeArabicText = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[\u064B-\u0652]/g, '') // Strip Tashkeel
    .replace(/[\u0640]/g, '')        // Strip Tatweel
    .replace(/[أإآٱ]/g, 'ا')         // Normalize Alef
    .replace(/ة/g, 'ه')              // Normalize Ta Marbouta
    .replace(/ى/g, 'ي')              // Normalize Alef Maqsura
    .replace(/\s+/g, ' ');           // Collapse spaces
};

export const generateSearchKeywords = (studentData: Partial<StudentData>): string[] => {
  const keywordsSet = new Set<string>();

  const processText = (text?: string) => {
    if (!text) return;
    const rawStr = String(text).trim();
    if (!rawStr) return;

    const normStr = normalizeArabicText(rawStr);
    const words = normStr.split(/[\s,._\-/\\]+/).filter(w => w.length >= 2);

    words.forEach(w => {
      keywordsSet.add(w);
      // Prefix substrings for partial word matching (min 2 chars)
      for (let i = 2; i <= Math.min(w.length, 12); i++) {
        keywordsSet.add(w.slice(0, i));
      }
    });

    // Generate bi-grams (2-word phrases) for phrase search like "محمد مصطفى"
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      keywordsSet.add(bigram);
    }
  };

  const s = studentData as any;
  processText(s.fullNameArabic);
  processText(s.full_name_arabic);
  processText(s.full_name);
  processText(s.vehicleNameEnglish);
  processText(s.fullNameEnglish);
  processText(s.full_name_english);
  processText(s.email);
  processText(s.nationalID || s.national_id);
  processText(s.whatsappNumber || s.phone);
  processText(s.diplomaType);
  processText(s.course || s.track);

  return Array.from(keywordsSet);
};

export const updateStudentData = async (userId: string, data: Partial<StudentData>): Promise<void> => {
  try {
    const sanitizedData: any = { ...data };

    // Mirror aliases so all queries and legacy fields stay in sync in Firestore
    if (sanitizedData.fullNameArabic !== undefined) {
      sanitizedData.full_name_arabic = sanitizedData.fullNameArabic;
      sanitizedData.full_name = sanitizedData.fullNameArabic;
    }
    if (sanitizedData.vehicleNameEnglish !== undefined || sanitizedData.fullNameEnglish !== undefined) {
      const eng = sanitizedData.fullNameEnglish || sanitizedData.vehicleNameEnglish || '';
      sanitizedData.fullNameEnglish = eng;
      sanitizedData.vehicleNameEnglish = eng;
      sanitizedData.full_name_english = eng;
    }
    if (sanitizedData.whatsappNumber !== undefined) {
      sanitizedData.whatsapp_number = sanitizedData.whatsappNumber;
      sanitizedData.phone = sanitizedData.whatsappNumber;
    }
    if (sanitizedData.nationalID !== undefined) {
      sanitizedData.national_id = sanitizedData.nationalID;
    }
    if (sanitizedData.diplomaType !== undefined) {
      sanitizedData.diploma_type = sanitizedData.diplomaType;
    }
    if (sanitizedData.diplomaYear !== undefined) {
      sanitizedData.diploma_year = sanitizedData.diplomaYear;
    }
    if (sanitizedData.track !== undefined) {
      sanitizedData.track_name = sanitizedData.track;
      try {
        const studentRef = doc(db, 'students', userId);
        const curSnap = await getDoc(studentRef);
        if (curSnap.exists()) {
          const curData = curSnap.data();
          const oldTrackKey = getTrackKey(curData.track);
          const newTrackKey = getTrackKey(sanitizedData.track);
          if (newTrackKey && oldTrackKey && oldTrackKey !== newTrackKey) {
            const syncResult = await syncStudentAssignmentsOnTrackChange(
              userId,
              sanitizedData.track,
              curData.track
            );
            if (syncResult && syncResult.synced) {
              sanitizedData.assignedFiles = syncResult.assignedFiles;
              sanitizedData.assignedFile = syncResult.assignedFile;
            }
          }
        }
      } catch (syncErr) {
        logger.warn('Auto track sync inside updateStudentData skipped or failed:', syncErr);
      }
    }

    // Clean undefined fields to prevent Firestore setDoc errors
    const cleanPayload: Record<string, any> = {};
    for (const [key, value] of Object.entries(sanitizedData)) {
      if (value !== undefined) {
        cleanPayload[key] = value;
      }
    }

    const keywords = generateSearchKeywords(cleanPayload);
    if (keywords.length > 0) {
      cleanPayload.searchKeywords = keywords;
    }

    await setDoc(
      doc(db, 'students', userId),
      {
        ...cleanPayload,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث البيانات');
  }
};

/**
 * تحديث رقم هاتف/واتساب الطالب في ملفه الشخصي وفي جميع طلبات الخدمات السابقة
 */
export const updateStudentPhoneInAllRequestsAndProfile = async (
  userId: string,
  phoneNumber: string
): Promise<void> => {
  try {
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    if (!cleanPhone) return;

    // 1) تحديث الملف الشخصي للطالب
    await updateStudentData(userId, {
      whatsappNumber: cleanPhone
    });

    // 2) تحديث جميع طلبات الخدمات الخاصة به في مجموعات serviceRequests_1..12
    const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    for (const serviceId of serviceIds) {
      try {
        const colRef = collection(db, `serviceRequests_${serviceId}`);
        const q = query(colRef, where('studentId', '==', userId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach((docSnap) => {
            const currentData = docSnap.data().data || {};
            batch.set(
              docSnap.ref,
              {
                data: {
                  ...currentData,
                  whatsapp_number: cleanPhone,
                  phone_whatsapp: cleanPhone,
                  leader_whatsapp: cleanPhone
                },
                updatedAt: serverTimestamp()
              },
              { merge: true }
            );
          });
          await batch.commit();
        }
      } catch (err) {
        logger.error(`Error updating phone in serviceRequests_${serviceId}:`, err);
      }
    }
  } catch (error: any) {
    logger.error('Error updating student phone across profile and requests:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث رقم الهاتف');
  }
};

export const deleteStudentData = async (userId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // 1) حذف مستند الطالب الأساسي
    batch.delete(doc(db, 'students', userId));

    // 2) حذف جميع طلبات الخدمات الخاصة به من مجموعات serviceRequests_1..12
    const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    for (const serviceId of serviceIds) {
      const colRef = collection(db, `serviceRequests_${serviceId}`);
      const q = query(colRef, where('studentId', '==', userId));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
    }

    // 3) حذف أكواد التحول الرقمي الخاصة به
    {
      const dtCol = collection(db, 'digitalTransformationCodes');
      const q = query(dtCol, where('studentId', '==', userId));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
    }

    // 4) حذف أكواد الدفع الإلكتروني الخاصة به
    {
      const epCol = collection(db, 'electronicPaymentCodes');
      const q = query(epCol, where('studentId', '==', userId));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
    }

    // ملاحظة: حذف حساب Firebase Auth نفسه يتطلب Firebase Admin / backend وليس من كود الواجهة فقط

    await batch.commit();
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء حذف المشترك');
  }
};

// ============================================
// Assignments (Study Costs) - Files per track
// ============================================

const trackToKey = (track?: string | null): TrackKey | null => {
  if (!track) return null;
  const normalized = track.toLowerCase();
  if (normalized.includes('1') || normalized.includes('الأول')) return 'track1';
  if (normalized.includes('2') || normalized.includes('الثاني')) return 'track2';
  if (normalized.includes('3') || normalized.includes('الثالث')) return 'track3';
  return null;
};

// ... (code continues)

export const uploadAssignmentFilesForTrack = async (
  track: TrackKey,
  files: File[],
  adminId: string,
  folderPath: string = '',
  onProgress?: (current: number, total: number) => void
): Promise<AssignmentFileMeta[]> => {
  try {
    if (!adminId) {
      logger.warn('Admin ID missing in upload, using fallback or anonymous');
      const currentUser = auth.currentUser;
      if (currentUser) {
        adminId = currentUser.uid;
      } else {
        throw new Error('يجب تسجيل الدخول كمسؤول لرفع الملفات');
      }
    }

    // Use the new Cloud Storage Service (Google Drive / Mega)
    // This distributes files between providers automatically
    const uploadResults = await uploadMultipleToCloudStorage(files, onProgress);

    // Save metadata to Firestore
    const savedFiles: AssignmentFileMeta[] = [];
    const filesCollection = collection(db, 'assignments', track, 'files');

    for (const result of uploadResults) {
      const fileDocRef = doc(filesCollection);

      const meta: AssignmentFileMeta = {
        id: fileDocRef.id,
        name: result.fileName,
        url: result.url,
        track,
        storagePath: result.fileId || result.url, // Store ID if available, else URL
        folderPath,
        uploadedAt: serverTimestamp()
      };

      await setDoc(fileDocRef, {
        ...meta,
        adminId,
        provider: result.provider, // 'google-drive' or 'mega'
        bucket: 'cloud-storage', // Placeholder
        folderPath,
        uploadedAt: serverTimestamp()
      });

      savedFiles.push(meta);
    }

    return savedFiles;
  } catch (error: any) {
    logger.error('Error uploading assignment files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء رفع ملفات التكاليف');
  }
};

export const getAssignmentFilesForTrack = async (track: TrackKey): Promise<AssignmentFileMeta[]> => {
  try {
    const filesCollection = collection(db, 'assignments', track, 'files');
    const snapshot = await getDocs(filesCollection);

    return snapshot.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data.name,
        url: data.url,
        track: data.track as TrackKey,
        storagePath: data.storagePath,
        folderPath: typeof data.folderPath === 'string' ? data.folderPath : '',
        uploadedAt: data.uploadedAt
      };
    });
  } catch (error: any) {
    logger.error('Error fetching assignment files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب ملفات التكاليف');
  }
};

export type ServiceTier = '500' | '300' | 'personalized' | 'plain' | 'unified' | string;

export interface DistributeTargetOptions {
  tier?: ServiceTier;
  category?: AssignmentCategory;
  assignmentId?: string;
  assignmentName?: string;
  price?: number;
  namingMode?: 'personalized' | 'plain';
  targetSpecializations?: string[];
  mode?: 'smart_all_missing' | 'single_variant_rotation';
}

// Helper: Get student IDs who bought a specific assignment tier/service with accepted requests
export const getStudentIdsByTier = async (
  tierOrTarget:
    | number
    | string
    | {
        category?: AssignmentCategory;
        assignmentId?: string;
        assignmentName?: string;
        tierPrice?: number;
        legacyTier?: string;
      }
): Promise<Set<string>> => {
  const collectionName = `serviceRequests_5`; // Service 5 = assignments
  const requestsSnap = await getDocs(collection(db, collectionName));
  const studentIds = new Set<string>();

  let targetCategory: AssignmentCategory | undefined;
  let targetId: string | undefined;
  let targetName: string | undefined;
  let targetPrice: number | undefined;
  let legacyTier: string | undefined;

  if (typeof tierOrTarget === 'number') {
    targetPrice = tierOrTarget;
    legacyTier = String(tierOrTarget);
  } else if (typeof tierOrTarget === 'string') {
    if (tierOrTarget === 'personalized' || tierOrTarget === 'plain' || tierOrTarget === 'unified') {
      targetCategory = tierOrTarget;
    } else if (tierOrTarget === '500') {
      targetCategory = 'personalized';
      legacyTier = '500';
    } else if (tierOrTarget === '300') {
      // Could be legacy 300 or specific price
      targetPrice = 300;
      legacyTier = '300';
    } else if (tierOrTarget === '130') {
      targetCategory = 'unified';
      legacyTier = '130';
    } else {
      targetId = tierOrTarget;
    }
  } else if (tierOrTarget && typeof tierOrTarget === 'object') {
    targetCategory = tierOrTarget.category;
    targetId = tierOrTarget.assignmentId;
    targetName = tierOrTarget.assignmentName;
    targetPrice = tierOrTarget.tierPrice;
    legacyTier = tierOrTarget.legacyTier;

    if (!targetCategory && legacyTier) {
      if (legacyTier === 'personalized' || legacyTier === '500') targetCategory = 'personalized';
      else if (legacyTier === 'plain') targetCategory = 'plain';
      else if (legacyTier === 'unified' || legacyTier === '130') targetCategory = 'unified';
    }
  }

  const targetNameNorm = targetName ? targetName.trim().toLowerCase() : '';

  requestsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    // Only include confirmed/approved requests
    if (data.status !== 'completed' && data.status !== 'receipt_sent') return;

    const reqData = data.data || {};
    const selectedAssignments: string[] = Array.isArray(reqData.selectedAssignments) ? reqData.selectedAssignments : [];
    const selectedData: any[] = Array.isArray(reqData.selectedAssignmentsData) ? reqData.selectedAssignmentsData : [];
    const totalPrice: number = typeof reqData.totalPrice === 'number' ? reqData.totalPrice : 0;

    let matched = false;

    // 1. Direct match by specific assignment ID (highest precision)
    if (targetId) {
      if (selectedAssignments.includes(targetId) || selectedData.some((a: any) => a.id === targetId)) {
        matched = true;
      }
      // المشتركون في الباقة الشاملة الكاملة (500 ج) يستحقون استلام أي تكليف
      if (!matched && targetCategory === 'personalized' && (totalPrice >= 500 || (totalPrice === 300 && !String(reqData.assignmentType || '').includes('pdf')))) {
        matched = true;
      }
      if (!matched && targetCategory === 'plain' && (totalPrice >= 200 || (totalPrice === 300 && String(reqData.assignmentType || '').includes('pdf')))) {
        matched = true;
      }
    }

    // 2. Direct match by specific assignment Name
    if (!matched && targetNameNorm) {
      if (selectedData.some((a: any) => String(a.name || '').trim().toLowerCase() === targetNameNorm)) {
        matched = true;
      }
      // المشتركون في الباقة الشاملة الكاملة (500 ج) يستحقون استلام أي تكليف
      if (!matched && targetCategory === 'personalized' && (totalPrice >= 500 || (totalPrice === 300 && !String(reqData.assignmentType || '').includes('pdf')))) {
        matched = true;
      }
      if (!matched && targetCategory === 'plain' && (totalPrice >= 200 || (totalPrice === 300 && String(reqData.assignmentType || '').includes('pdf')))) {
        matched = true;
      }
    }

    // 3. Category match (Personalized "حل وتسليم" vs Plain "حل PDF فقط" vs Unified "تربية عملي")
    // This enforces 100% strict isolation so students never receive both tiers accidentally
    if (!matched && targetCategory) {
      if (targetCategory === 'personalized') {
        const hasPersonalized = selectedData.some((a: any) => classifyAssignment(a) === 'personalized');
        // Legacy fallback for orders saved before selectedAssignmentsData existed
        const legacyPersonalized =
          selectedData.length === 0 &&
          (totalPrice === 500 ||
            (totalPrice === 300 && !String(reqData.assignmentType || '').includes('pdf')));
        if (hasPersonalized || legacyPersonalized) {
          matched = true;
        }
      } else if (targetCategory === 'plain') {
        const hasPlain = selectedData.some((a: any) => classifyAssignment(a) === 'plain');
        // Legacy fallback for orders saved before selectedAssignmentsData existed
        const legacyPlain =
          selectedData.length === 0 &&
          (totalPrice === 200 ||
            (totalPrice === 300 && String(reqData.assignmentType || '').includes('pdf')));
        if (hasPlain || legacyPlain) {
          matched = true;
        }
      } else if (targetCategory === 'unified') {
        const hasUnified = selectedData.some((a: any) => classifyAssignment(a) === 'unified');
        const legacyUnified =
          selectedData.length === 0 && (totalPrice === 130 || totalPrice === 100);
        if (hasUnified || legacyUnified) {
          matched = true;
        }
      }
    }

    // 4. Fallback price matching only if no category was specified
    if (!matched && !targetCategory && targetPrice && targetPrice > 0) {
      if (selectedData.some((a: any) => Number(a.price) === targetPrice)) {
        matched = true;
      }
    }

    // 5. Fallback legacy tier matching if category didn't trigger
    if (!matched && !targetCategory && legacyTier) {
      if (legacyTier === '500') {
        if (selectedData.some((a: any) => classifyAssignment(a) === 'personalized') || totalPrice === 500) {
          matched = true;
        }
      } else if (legacyTier === '300') {
        if (selectedData.some((a: any) => classifyAssignment(a) === 'plain') || totalPrice === 200) {
          matched = true;
        }
      } else if (legacyTier === '130') {
        if (selectedData.some((a: any) => classifyAssignment(a) === 'unified') || totalPrice === 130) {
          matched = true;
        }
      }
    }

    if (matched && data.studentId) {
      studentIds.add(data.studentId);
    }
  });

  return studentIds;
};

export const distributeAssignmentsForTrack = async (
  track: TrackKey,
  fileIds?: string[],
  serviceTierOrOptions?: ServiceTier | DistributeTargetOptions,
  onProgress?: (processed: number, total: number, currentStudentName?: string) => void
): Promise<{ total: number; sent: number; report?: DistributionReport }> => {
  try {
    // 1) Parse options & target
    let targetOptions: DistributeTargetOptions = {};
    if (typeof serviceTierOrOptions === 'string') {
      if (serviceTierOrOptions === 'personalized' || serviceTierOrOptions === '500') {
        targetOptions = {
          category: 'personalized',
          tier: serviceTierOrOptions,
          namingMode: 'personalized'
        };
      } else if (serviceTierOrOptions === 'plain' || serviceTierOrOptions === '300') {
        targetOptions = {
          category: 'plain',
          tier: serviceTierOrOptions,
          namingMode: 'plain'
        };
      } else {
        targetOptions = {
          tier: serviceTierOrOptions,
          namingMode: 'personalized'
        };
      }
    } else if (serviceTierOrOptions && typeof serviceTierOrOptions === 'object') {
      targetOptions = serviceTierOrOptions;
    }

    const distributionMode = targetOptions.mode || 'smart_all_missing';

    // 2) Get all files for this track
    const allTrackFiles = await getAssignmentFilesForTrack(track);
    let files = allTrackFiles;
    if (fileIds && fileIds.length > 0) {
      const fileIdSet = new Set(fileIds);
      files = allTrackFiles.filter((f) => fileIdSet.has(f.id));
    }
    if (files.length === 0) {
      throw new Error('لا توجد ملفات مرفوعة لهذا المسار');
    }

    // Build lookup indexes across ALL track files to recognize which folder an existing file belongs to,
    // even for legacy assignments where ef.folderPath was not stored!
    const trackFileIdToFolder = new Map<string, string>();
    const folderToFileIdSet = new Map<string, Set<string>>();
    const folderToFileNameSet = new Map<string, Set<string>>();

    allTrackFiles.forEach((f) => {
      const fp = (f.folderPath || '').trim();
      if (fp) {
        trackFileIdToFolder.set(f.id, fp);
        if (!folderToFileIdSet.has(fp)) folderToFileIdSet.set(fp, new Set());
        folderToFileIdSet.get(fp)!.add(f.id);

        if (!folderToFileNameSet.has(fp)) folderToFileNameSet.set(fp, new Set());
        folderToFileNameSet.get(fp)!.add(f.name);
      }
    });

    // Group the SELECTED target files into independent Assignment Units (وحدات تكليف):
    // - Files inside a folder (f.folderPath) form a unit representing alternative models/variants of 1 assignment.
    // - Loose root files (f.folderPath is empty) each form an independent unit.
    interface AssignmentUnit {
      key: string;
      unitName: string;
      folderPath?: string;
      isFolder: boolean;
      files: AssignmentFileMeta[];
    }

    const unitMap = new Map<string, AssignmentUnit>();

    files.forEach((f) => {
      const fp = (f.folderPath || '').trim();
      if (fp) {
        const unitKey = `folder:::${fp}`;
        if (!unitMap.has(unitKey)) {
          const folderName = fp.split('/').filter(Boolean).pop() || fp;
          unitMap.set(unitKey, {
            key: unitKey,
            unitName: folderName,
            folderPath: fp,
            isFolder: true,
            files: []
          });
        }
        unitMap.get(unitKey)!.files.push(f);
      } else {
        const unitKey = `file:::${f.id}`;
        unitMap.set(unitKey, {
          key: unitKey,
          unitName: f.name,
          isFolder: false,
          files: [f]
        });
      }
    });

    const assignmentUnits = Array.from(unitMap.values());
    if (assignmentUnits.length === 0) {
      throw new Error('لا توجد تكليفات محددة للإرسال');
    }

    // Shuffled variants per unit for randomized rotation across students
    const unitFilesShuffled = new Map<string, AssignmentFileMeta[]>();
    const unitRotationIndex = new Map<string, number>();

    assignmentUnits.forEach((unit) => {
      unitFilesShuffled.set(unit.key, [...unit.files].sort(() => Math.random() - 0.5));
      unitRotationIndex.set(unit.key, 0);
    });

    const studentHasUnit = (unit: AssignmentUnit, existingFiles: AssignedFile[]): boolean => {
      if (unit.isFolder && unit.folderPath) {
        const fp = unit.folderPath;
        const idSet = folderToFileIdSet.get(fp);
        const nameSet = folderToFileNameSet.get(fp);

        return existingFiles.some((ef) => {
          if (ef.folderPath && ef.folderPath === fp) return true;
          if (ef.id && idSet && idSet.has(ef.id)) return true;
          if (ef.id && trackFileIdToFolder.get(ef.id) === fp) return true;
          if (ef.name && nameSet && nameSet.has(ef.name)) return true;
          if (targetOptions.assignmentId && ef.assignmentId && ef.assignmentId === targetOptions.assignmentId) return true;
          return false;
        });
      } else {
        const targetFile = unit.files[0];
        return existingFiles.some((ef) => {
          if (ef.id && targetFile.id && ef.id === targetFile.id) return true;
          if (ef.name && targetFile.name && ef.name === targetFile.name && ef.track === track) return true;
          if (targetOptions.assignmentId && ef.assignmentId && ef.assignmentId === targetOptions.assignmentId) return true;
          return false;
        });
      }
    };

    // 3) Get targeted students by tier/target and/or track without scanning full collection
    let targetStudentsMap: Record<string, StudentData> = {};

    const hasTargetFilter = Boolean(
      targetOptions.category ||
        targetOptions.tier ||
        targetOptions.assignmentId ||
        targetOptions.assignmentName ||
        targetOptions.price
    );

    if (hasTargetFilter) {
      const tierStudentIds = await getStudentIdsByTier({
        category: targetOptions.category,
        assignmentId: targetOptions.assignmentId,
        assignmentName: targetOptions.assignmentName,
        tierPrice: targetOptions.price,
        legacyTier: targetOptions.tier
      });
      if (tierStudentIds.size > 0) {
        targetStudentsMap = await getStudentsByIds(Array.from(tierStudentIds));
      }
    } else {
      const trackVariantsMap: Record<TrackKey, string[]> = {
        track1: ['track1', 'الأول', 'الاول', 'المسار الأول', 'المسار الاول', 'الأولى', '1'],
        track2: ['track2', 'الثاني', 'المسار الثاني', 'الثانية', '2'],
        track3: ['track3', 'الثالث', 'المسار الثالث', 'الثالثة', '3']
      };
      const variants = trackVariantsMap[track] || [track];
      const q = query(collection(db, 'students'), where('track', 'in', variants));
      const snap = await getDocs(q);
      snap.docs.forEach((docSnap) => {
        targetStudentsMap[docSnap.id] = docSnap.data() as StudentData;
      });
    }

    let allStudentsInTrack: { id: string; data: StudentData }[] = [];
    Object.entries(targetStudentsMap).forEach(([id, data]) => {
      const studentTrackKey = trackToKey(data.track || null);
      if (studentTrackKey === track) {
        allStudentsInTrack.push({ id, data });
      }
    });

    if (allStudentsInTrack.length === 0) {
      const tierLabel =
        targetOptions.assignmentName ||
        (targetOptions.category === 'personalized' || targetOptions.tier === '500'
          ? 'باقة حل وتسليم التكليفات'
          : targetOptions.category === 'plain' || targetOptions.tier === '300'
          ? 'باقة حل PDF فقط'
          : 'هذه الخدمة');
      throw new Error(`لا يوجد طلاب مشتركين في ${tierLabel} في هذا المسار حالياً`);
    }

    // 4) تصفية الطلاب حسب التخصصات المستهدفة (Specializations Filter)
    const targetSpecs = targetOptions.targetSpecializations;
    let students = allStudentsInTrack.filter((student) => {
      const spec = resolveStudentSpecialization(student.data);
      return isSpecializationMatch(spec, targetSpecs);
    });

    if (students.length === 0) {
      const specsNames = targetSpecs && targetSpecs.length > 0 ? targetSpecs.join('، ') : 'المحددة';
      throw new Error(`لا يوجد طلاب مطابقين للتخصصات (${specsNames}) في هذا المسار حالياً`);
    }

    const isPlainNaming =
      targetOptions.namingMode === 'plain' ||
      targetOptions.category === 'plain' ||
      (!targetOptions.namingMode && (targetOptions.tier === 'plain' || targetOptions.tier === '300'));

    // 5) تنفيذ الإرسال الذكي حسب وحدات التكليف (Unit-Based Smart Distribution)
    // كل مجلد يُعامل كوحدة تكليف مستقلة ذات نماذج متعددة (Variant Rotation)، وكل ملف بالجذر يُعامل كوحدة مستقلة
    const report: DistributionReport = {
      totalTargeted: students.length,
      totalSentAssignments: 0,
      newStudentsCount: 0,
      completedOldStudentsCount: 0,
      skippedStudentsCount: 0,
      specializationBreakdown: {},
      failedCount: 0,
      failureReasons: []
    };

    // خرائط تتبع المجلدات والملفات المرسلة لتوثيق وتاريخ دفعات الإرسال
    const unitSentStudents = new Map<string, Set<string>>();
    const unitSentFiles = new Map<string, Set<string>>();

    let batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 25; // حجم دفعة آمن ومحكم لتفادي احتقان الشبكة وتجميد المتصفح
    let processedStudents = 0;
    const totalStudents = students.length;

    for (const student of students) {
      const studentSpec = resolveStudentSpecialization(student.data);
      if (!report.specializationBreakdown[studentSpec]) {
        report.specializationBreakdown[studentSpec] = { studentCount: 0, sentCount: 0 };
      }
      report.specializationBreakdown[studentSpec].studentCount++;

      const existingFiles: AssignedFile[] = Array.isArray(student.data.assignedFiles)
        ? student.data.assignedFiles
        : student.data.assignedFile
        ? [student.data.assignedFile]
        : [];

      // فحص وحدات التكليف الناقصة لهذا الطالب تحديداً
      const missingUnits = assignmentUnits.filter((unit) => !studentHasUnit(unit, existingFiles));

      if (missingUnits.length === 0) {
        // الطالب يمتلك بالفعل كافة التكليفات المحددة
        report.skippedStudentsCount++;
      } else {
        if (existingFiles.length === 0) {
          report.newStudentsCount++;
        } else {
          report.completedOldStudentsCount++;
        }

        const studentName = (student.data.fullNameArabic || 'طالب')
          .replace(/\s+/g, '_')
          .replace(/[^\u0600-\u06FF\w.-]/g, '_');

        // إنشاء نموذج واحد فقط لكل وحدة تكليف ناقصة بالتدوير العادل لمنع التكرار وتخفيف الحمل
        const newAssignments: AssignedFile[] = missingUnits.map((unit) => {
          let fileToAssign: AssignmentFileMeta;
          if (unit.isFolder) {
            const fileList = unitFilesShuffled.get(unit.key) || unit.files;
            const curIdx = unitRotationIndex.get(unit.key) || 0;
            fileToAssign = fileList[curIdx % fileList.length];
            unitRotationIndex.set(unit.key, curIdx + 1);
          } else {
            fileToAssign = unit.files[0];
          }

          const fileExtension = fileToAssign.name.includes('.')
            ? fileToAssign.name.substring(fileToAssign.name.lastIndexOf('.'))
            : '';
          const fileNameWithoutExt = fileToAssign.name.includes('.')
            ? fileToAssign.name.substring(0, fileToAssign.name.lastIndexOf('.'))
            : fileToAssign.name;
          const customFileName = isPlainNaming
            ? fileToAssign.name
            : `${studentName}_-_${fileNameWithoutExt}${fileExtension}`;

          return {
            id: fileToAssign.id,
            name: fileToAssign.name,
            customName: customFileName,
            url: fileToAssign.url,
            track,
            assignmentId: targetOptions.assignmentId || fileToAssign.id,
            specialization: studentSpec,
            assignedAt: new Date().toISOString(),
            folderPath: fileToAssign.folderPath || '',
            folderName: unit.unitName || ''
          };
        });

        // تسجيل إحصائيات المجلدات المرسلة لهذا الطالب
        newAssignments.forEach((assigned) => {
          const uKey = assigned.folderPath ? `folder:::${assigned.folderPath}` : `file:::${assigned.id}`;
          if (!unitSentStudents.has(uKey)) unitSentStudents.set(uKey, new Set());
          unitSentStudents.get(uKey)!.add(student.id);

          if (!unitSentFiles.has(uKey)) unitSentFiles.set(uKey, new Set());
          unitSentFiles.get(uKey)!.add(assigned.id);
        });

        const updatedFiles = [...existingFiles, ...newAssignments];
        const updatePayload: any = {
          assignedFiles: updatedFiles,
          assignedFile: newAssignments[newAssignments.length - 1],
          updatedAt: serverTimestamp()
        };

        batch.update(doc(db, 'students', student.id), updatePayload);
        batchCount++;

        report.totalSentAssignments += newAssignments.length;
        report.specializationBreakdown[studentSpec].sentCount += newAssignments.length;

        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          // إتاحة الفرصة للمتصفح لتحديث واجهة المستخدم والرسم بسلاسة
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      }

      processedStudents++;
      if (onProgress) {
        try {
          onProgress(processedStudents, totalStudents, student.data.fullNameArabic || 'طالب');
        } catch {
          // ignore
        }
      }

      // تفريغ دورة معالجة المتصفح (Event Loop) لمنع أي تجميد للصفحة
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // تسجيل إرسال الفولدرات الكاملة كدفعات توزيع تاريخية لتمكين السحب بتاريخ محدد
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const dateString = nowIso.split('T')[0];

      for (const unit of assignmentUnits) {
        const studentSet = unitSentStudents.get(unit.key);
        const fileSet = unitSentFiles.get(unit.key);
        if (studentSet && studentSet.size > 0) {
          await addDoc(collection(db, 'distribution_batches'), {
            track,
            folderPath: unit.folderPath || '',
            folderName: unit.unitName,
            isFolder: unit.isFolder,
            assignedAt: nowIso,
            dateString,
            studentCount: studentSet.size,
            studentIds: Array.from(studentSet),
            fileIds: fileSet ? Array.from(fileSet) : [],
            status: 'active',
            createdAt: serverTimestamp()
          }).catch(() => {});
        }
      }
    } catch (logErr) {
      logger.warn('Error recording distribution batches:', logErr);
    }

    return {
      total: report.totalTargeted,
      sent: report.totalSentAssignments,
      report
    };
  } catch (error: any) {
    logger.error('Error distributing assignments:', error);
    throw new Error(error.message || 'حدث خطأ أثناء توزيع ملفات التكاليف على الطلاب');
  }
};

// ============================================
// 130 EGP Unified File (one file for all buyers)
// ============================================

export const upload130UnifiedFile = async (
  file: File,
  adminId: string,
  folderPath: string = '',
  onProgress?: (current: number, total: number) => void
): Promise<AssignmentFileMeta> => {
  try {
    if (!adminId) {
      const currentUser = auth.currentUser;
      if (currentUser) {
        adminId = currentUser.uid;
      } else {
        throw new Error('يجب تسجيل الدخول كمسؤول لرفع الملفات');
      }
    }

    const uploadResults = await uploadMultipleToCloudStorage([file], onProgress);
    const result = uploadResults[0];

    const filesCollection = collection(db, 'assignments', 'unified130', 'files');
    const fileDocRef = doc(filesCollection);

    const meta: AssignmentFileMeta = {
      id: fileDocRef.id,
      name: result.fileName,
      url: result.url,
      track: 'track1' as TrackKey, // placeholder, not relevant for 130
      storagePath: result.fileId || result.url,
      folderPath,
      uploadedAt: serverTimestamp()
    };

    await setDoc(fileDocRef, {
      ...meta,
      adminId,
      provider: result.provider,
      bucket: 'cloud-storage',
      folderPath,
      uploadedAt: serverTimestamp()
    });

    return meta;
  } catch (error: any) {
    logger.error('Error uploading 130 unified file:', error);
    throw new Error(error.message || 'حدث خطأ أثناء رفع الملف الموحد');
  }
};

export const get130UnifiedFiles = async (): Promise<AssignmentFileMeta[]> => {
  try {
    const filesCollection = collection(db, 'assignments', 'unified130', 'files');
    const snapshot = await getDocs(filesCollection);

    return snapshot.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data.name,
        url: data.url,
        track: 'track1' as TrackKey,
        storagePath: data.storagePath,
        folderPath: typeof data.folderPath === 'string' ? data.folderPath : '',
        uploadedAt: data.uploadedAt
      };
    });
  } catch (error: any) {
    logger.error('Error fetching 130 unified files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب الملفات الموحدة');
  }
};

export const createAssignmentFolderForTrack = async (
  track: TrackKey,
  name: string,
  parentPath: string = ''
): Promise<AssignmentFolderMeta> => {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('اسم المجلد مطلوب');
  const safeName = cleanName.replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!safeName) throw new Error('اسم المجلد غير صالح');
  const path = parentPath ? `${parentPath}/${safeName}` : safeName;
  const folderRef = doc(collection(db, 'assignments', track, 'folders'));
  const folder: AssignmentFolderMeta = {
    id: folderRef.id,
    name: safeName,
    path,
    parentPath
  };
  await setDoc(folderRef, {
    ...folder,
    createdAt: serverTimestamp()
  });
  return folder;
};

export const getAssignmentFoldersForTrack = async (track: TrackKey): Promise<AssignmentFolderMeta[]> => {
  const snapshot = await getDocs(collection(db, 'assignments', track, 'folders'));
  return snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: String(data.name || ''),
      path: String(data.path || ''),
      parentPath: String(data.parentPath || ''),
      createdAt: data.createdAt
    };
  });
};

export const deleteAssignmentFolderForTrack = async (track: TrackKey, folderPath: string): Promise<{ deletedFiles: string[] }> => {
  const target = String(folderPath || '').trim();
  if (!target) throw new Error('مسار المجلد غير صالح');

  const filesCollection = collection(db, 'assignments', track, 'files');
  const foldersCollection = collection(db, 'assignments', track, 'folders');

  const [filesSnap, foldersSnap] = await Promise.all([getDocs(filesCollection), getDocs(foldersCollection)]);

  const fileIdsToDelete: string[] = [];
  const deleteFilePromises: Promise<void>[] = [];
  const deleteFolderPromises: Promise<void>[] = [];

  filesSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const fp = String(data.folderPath || '');
    const isInside = fp === target || fp.startsWith(`${target}/`);
    if (!isInside) return;
    fileIdsToDelete.push(d.id);
    deleteFilePromises.push(
      (async () => {
        const storagePath = data?.storagePath as string | undefined;
        const provider = data?.provider as string | undefined;
        await deleteDoc(d.ref);
        if (storagePath) {
          try {
            if (provider === 'supabase') {
              const { error } = await supabase.storage.from(ASSIGNMENTS_BUCKET).remove([storagePath]);
              if (error) logger.error('Error removing folder file from Supabase:', error);
            } else {
              await deleteObject(ref(storage, storagePath));
            }
          } catch (storageError) {
            logger.error('Error deleting folder file from storage:', storageError);
          }
        }
      })()
    );
  });

  foldersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const p = String(data.path || '');
    if (p === target || p.startsWith(`${target}/`)) {
      deleteFolderPromises.push(deleteDoc(d.ref));
    }
  });

  await Promise.all([...deleteFilePromises, ...deleteFolderPromises]);
  return { deletedFiles: fileIdsToDelete };
};

export const create130UnifiedFolder = async (name: string, parentPath: string = ''): Promise<AssignmentFolderMeta> => {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('اسم المجلد مطلوب');
  const safeName = cleanName.replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!safeName) throw new Error('اسم المجلد غير صالح');
  const path = parentPath ? `${parentPath}/${safeName}` : safeName;
  const folderRef = doc(collection(db, 'assignments', 'unified130', 'folders'));
  const folder: AssignmentFolderMeta = {
    id: folderRef.id,
    name: safeName,
    path,
    parentPath
  };
  await setDoc(folderRef, {
    ...folder,
    createdAt: serverTimestamp()
  });
  return folder;
};

export const get130UnifiedFolders = async (): Promise<AssignmentFolderMeta[]> => {
  const snapshot = await getDocs(collection(db, 'assignments', 'unified130', 'folders'));
  return snapshot.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: String(data.name || ''),
      path: String(data.path || ''),
      parentPath: String(data.parentPath || ''),
      createdAt: data.createdAt
    };
  });
};

export const delete130UnifiedFolder = async (folderPath: string): Promise<{ deletedFiles: string[] }> => {
  const target = String(folderPath || '').trim();
  if (!target) throw new Error('مسار المجلد غير صالح');

  const filesCollection = collection(db, 'assignments', 'unified130', 'files');
  const foldersCollection = collection(db, 'assignments', 'unified130', 'folders');

  const [filesSnap, foldersSnap] = await Promise.all([getDocs(filesCollection), getDocs(foldersCollection)]);

  const fileIdsToDelete: string[] = [];
  const deleteFilePromises: Promise<void>[] = [];
  const deleteFolderPromises: Promise<void>[] = [];

  filesSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const fp = String(data.folderPath || '');
    const isInside = fp === target || fp.startsWith(`${target}/`);
    if (!isInside) return;
    fileIdsToDelete.push(d.id);
    deleteFilePromises.push(
      (async () => {
        const storagePath = data?.storagePath as string | undefined;
        const provider = data?.provider as string | undefined;
        await deleteDoc(d.ref);
        if (storagePath) {
          try {
            if (provider === 'supabase') {
              const { error } = await supabase.storage.from(ASSIGNMENTS_BUCKET).remove([storagePath]);
              if (error) logger.error('Error removing 130 folder file from Supabase:', error);
            } else {
              await deleteObject(ref(storage, storagePath));
            }
          } catch (storageError) {
            logger.error('Error deleting 130 folder file from storage:', storageError);
          }
        }
      })()
    );
  });

  foldersSnap.docs.forEach((d) => {
    const data = d.data() as any;
    const p = String(data.path || '');
    if (p === target || p.startsWith(`${target}/`)) {
      deleteFolderPromises.push(deleteDoc(d.ref));
    }
  });

  await Promise.all([...deleteFilePromises, ...deleteFolderPromises]);
  return { deletedFiles: fileIdsToDelete };
};

export const delete130UnifiedFiles = async (fileIds: string[]): Promise<void> => {
  try {
    const filesCollection = collection(db, 'assignments', 'unified130', 'files');

    const deletePromises = fileIds.map(async (fileId) => {
      const fileDocRef = doc(filesCollection, fileId);
      const snap = await getDoc(fileDocRef);
      if (!snap.exists()) return;

      const data = snap.data() as any;
      const storagePath = data?.storagePath as string | undefined;
      const provider = data?.provider as string | undefined;

      await deleteDoc(fileDocRef);

      if (storagePath) {
        try {
          if (provider === 'supabase') {
            const { error } = await supabase.storage
              .from(ASSIGNMENTS_BUCKET)
              .remove([storagePath]);
            if (error) logger.error('Error removing from Supabase:', error);
          } else {
            await deleteObject(ref(storage, storagePath));
          }
        } catch (storageError) {
          logger.error('Error deleting 130 file from storage:', storageError);
        }
      }
    });

    await Promise.all(deletePromises);
  } catch (error: any) {
    logger.error('Error deleting 130 unified files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حذف الملفات الموحدة');
  }
};

export const distribute130UnifiedFiles = async (
  fileIds?: string[],
  targetAssignmentOrId?: string | { assignmentId?: string; assignmentName?: string; price?: number },
  onProgress?: (processed: number, total: number, currentStudentName?: string) => void
): Promise<{ total: number; sent: number }> => {
  try {
    // 1) Get 130 unified files
    let files = await get130UnifiedFiles();
    if (fileIds && fileIds.length > 0) {
      const fileIdSet = new Set(fileIds);
      files = files.filter((f) => fileIdSet.has(f.id));
    }
    if (files.length === 0) {
      throw new Error('لا توجد ملفات موحدة مرفوعة');
    }

    // 2) Get all students who bought the unified tier or specified assignment
    let queryTarget: any = { category: 'unified', legacyTier: '130' };
    let label = 'خدمة التربية العملي (الملف الموحد)';
    if (typeof targetAssignmentOrId === 'string' && targetAssignmentOrId) {
      queryTarget = { assignmentId: targetAssignmentOrId, category: 'unified', legacyTier: '130' };
    } else if (targetAssignmentOrId && typeof targetAssignmentOrId === 'object') {
      queryTarget = {
        assignmentId: targetAssignmentOrId.assignmentId,
        assignmentName: targetAssignmentOrId.assignmentName,
        tierPrice: targetAssignmentOrId.price,
        category: 'unified',
        legacyTier: '130'
      };
      if (targetAssignmentOrId.assignmentName) label = targetAssignmentOrId.assignmentName;
    }

    const tierStudentIds = await getStudentIdsByTier(queryTarget);
    if (tierStudentIds.size === 0) {
      throw new Error(`لا يوجد طلاب مشتركين في ${label} حالياً`);
    }

    // 3) Get student data (only for the targeted tier students)
    const studentsMap = await getStudentsByIds(Array.from(tierStudentIds));
    const students: { id: string; data: StudentData }[] = Object.entries(studentsMap).map(([id, data]) => ({ id, data }));

    if (students.length === 0) {
      throw new Error(`لا يوجد طلاب مشتركين في ${label} حالياً`);
    }

    // 4) Send ALL files to ALL students (same file for everyone)
    let processedCount = 0;
    const totalCount = students.length;

    for (const student of students) {
      const existingFiles = student.data.assignedFiles || [];
      const existingIdSet = new Set(existingFiles.map((f: any) => f.id).filter(Boolean));

      let updatedFiles = [...existingFiles];
      let hasNewFiles = false;

      for (const file of files) {
        const isAlreadyAssigned = existingIdSet.has(file.id);

        if (!isAlreadyAssigned) {
          const folderName = (file as any).folderPath
            ? ((file as any).folderPath.split('/').filter(Boolean).pop() || (file as any).folderPath)
            : '';

          const assigned: AssignedFile = {
            id: file.id,
            name: file.name,
            customName: file.name, // Same file for everyone, no custom naming
            url: file.url,
            track: 'unified130' as any,
            assignedAt: new Date().toISOString(),
            folderPath: (file as any).folderPath || '',
            folderName: folderName || ''
          };
          updatedFiles.push(assigned);
          hasNewFiles = true;
        }
      }

      if (hasNewFiles) {
        await updateStudentData(student.id, {
          assignedFiles: updatedFiles,
          assignedFile: updatedFiles[updatedFiles.length - 1]
        } as any);
      }

      processedCount++;
      if (onProgress) {
        try {
          onProgress(processedCount, totalCount, student.data.fullNameArabic || 'طالب');
        } catch {
          // ignore
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return { total: totalCount, sent: processedCount };
  } catch (error: any) {
    logger.error('Error distributing 130 unified files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء توزيع الملفات الموحدة');
  }
};

export const deleteAssignmentFilesForTrack = async (
  track: TrackKey,
  fileIds: string[]
): Promise<void> => {
  try {
    const filesCollection = collection(db, 'assignments', track, 'files');

    const deletePromises = fileIds.map(async (fileId) => {
      const fileDocRef = doc(filesCollection, fileId);
      const snap = await getDoc(fileDocRef);
      if (!snap.exists()) return;

      const data = snap.data() as any;
      const storagePath = data?.storagePath as string | undefined;
      const provider = data?.provider as string | undefined;

      await deleteDoc(fileDocRef);

      if (storagePath) {
        try {
          if (provider === 'supabase') {
            const { error } = await supabase.storage
              .from(ASSIGNMENTS_BUCKET)
              .remove([storagePath]);
            if (error) logger.error('Error removing from Supabase:', error);
          } else {
            await deleteObject(ref(storage, storagePath));
          }
        } catch (storageError) {
          logger.error('Error deleting file from storage:', storageError);
        }
      }
    });

    await Promise.all(deletePromises);
  } catch (error: any) {
    logger.error('Error deleting assignment files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حذف ملفات التكاليف');
  }
};

/**
 * حذف ملفات محددة من جميع الطلاب (assignedFiles array)
 * يُستخدم عند حذف ملفات من المسارات أو ملفات الـ 130 الموحدة
 * لضمان عدم بقاء روابط معطلة لدى الطلاب
 */
export const removeAssignedFilesFromAllStudents = async (fileIds: string[]): Promise<number> => {
  try {
    if (!fileIds || fileIds.length === 0) return 0;

    const fileIdSet = new Set(fileIds);
    const studentsRef = collection(db, 'students');
    // Fetch ONLY students who currently have assigned files (assignedFile != null)
    const q = query(studentsRef, where('assignedFile', '!=', null));
    const studentsSnap = await getDocs(q);

    let updatedCount = 0;
    const batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 500; // Firestore batch limit

    for (const studentDoc of studentsSnap.docs) {
      const data = studentDoc.data();
      const assignedFiles: any[] = data.assignedFiles || [];

      if (assignedFiles.length === 0) continue;

      // تصفية الملفات المحذوفة
      const filteredFiles = assignedFiles.filter((f: any) => !fileIdSet.has(f.id));

      // إذا تم حذف ملف أو أكثر من هذا الطالب
      if (filteredFiles.length < assignedFiles.length) {
        const updateData: any = {
          assignedFiles: filteredFiles,
          updatedAt: serverTimestamp()
        };

        // تحديث assignedFile (للتوافق القديم)
        if (filteredFiles.length > 0) {
          updateData.assignedFile = filteredFiles[filteredFiles.length - 1];
        } else {
          // لا توجد ملفات متبقية - حذف الحقل القديم
          updateData.assignedFile = null;
        }

        batch.update(studentDoc.ref, updateData);
        updatedCount++;
        batchCount++;

        // Firestore batch limit is 500
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    logger.log(`Removed files from ${updatedCount} students`);
    return updatedCount;
  } catch (error: any) {
    logger.error('Error removing assigned files from students:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حذف الملفات من حسابات الطلاب');
  }
};

// ============================================
// سجل وسحب الملفات الموزعة على الطلاب (File Revocation)
// ============================================

export interface DistributedFileSummary {
  fileId: string;
  fileName: string;
  customNameExample?: string;
  track: string;
  assignedAt: string; // ISO string
  formattedDate: string; // e.g. "14 أكتوبر 2026"
  formattedTime: string; // e.g. "05:18 م"
  studentCount: number;
  studentIds: string[];
}

/**
 * Helper لجلب الطلاب المرشحين لفحص التكليفات الموزعة بأمان تام ودون الاعتماد فقط على فهارس غير منشأة
 */
const fetchCandidatesForDistributedInspection = async (
  track: TrackKey | 'unified130'
): Promise<Array<{ id: string; data: DocumentData }>> => {
  const studentsRef = collection(db, 'students');
  const seenMap = new Map<string, DocumentData>();

  // 1. إذا كان مسار محدد (track1, track2, track3)، استعلام مباشر بحقل track
  if (track !== 'unified130') {
    const trackVariantsMap: Record<TrackKey, string[]> = {
      track1: ['track1', 'الأول', 'الاول', 'المسار الأول', 'المسار الاول', 'الأولى', '1'],
      track2: ['track2', 'الثاني', 'المسار الثاني', 'الثانية', '2'],
      track3: ['track3', 'الثالث', 'المسار الثالث', 'الثالثة', '3']
    };
    const variants = trackVariantsMap[track as TrackKey] || [track];
    try {
      const qTrack = query(studentsRef, where('track', 'in', variants));
      const snapTrack = await getDocs(qTrack);
      snapTrack.docs.forEach((d) => seenMap.set(d.id, d.data()));
    } catch (e) {
      logger.warn('fetchCandidates: query by track error (non-fatal)', e);
    }
  }

  // 2. الاستعلام بحقل assignedFile != null (لـ unified130 والمسارات الأخرى)
  try {
    const qAssigned = query(studentsRef, where('assignedFile', '!=', null));
    const snapAssigned = await getDocs(qAssigned);
    snapAssigned.docs.forEach((d) => seenMap.set(d.id, d.data()));
  } catch (e) {
    logger.warn('fetchCandidates: query by assignedFile != null error or missing index', e);
  }

  // 3. إذا لم يتم العثور على أي طالب بعد (Fallback)، جلب مجموعة الطلاب بالكامل للتأكد
  if (seenMap.size === 0) {
    try {
      const snapAll = await getDocs(query(studentsRef));
      snapAll.docs.forEach((d) => seenMap.set(d.id, d.data()));
    } catch (e) {
      logger.error('fetchCandidates: fallback query students error', e);
    }
  }

  return Array.from(seenMap.entries()).map(([id, data]) => ({ id, data }));
};

/**
 * جلب ملخص الملفات الموزعة حالياً على الطلاب لمسار معين (أو ملفات الـ 130)
 * يعتمد على الاستعلام المباشر لمستندات الطلاب النشطة فقط لتفادي إجهاد قاعدة البيانات
 */
export const getDistributedFilesForTrack = async (
  track: TrackKey | 'unified130'
): Promise<DistributedFileSummary[]> => {
  try {
    const candidates = await fetchCandidatesForDistributedInspection(track);

    // إذا كان المسار هو 130، نجلب معرفات ملفات الـ 130 المرفوعة لضمان مطابقتها بدقة
    let unified130IdSet = new Set<string>();
    if (track === 'unified130') {
      try {
        const uFiles = await get130UnifiedFiles();
        unified130IdSet = new Set(uFiles.map((f) => f.id));
      } catch {
        // fallback
      }
    }

    const map = new Map<
      string,
      {
        fileId: string;
        fileName: string;
        customNameExample?: string;
        track: string;
        assignedAt: string;
        studentIds: Set<string>;
      }
    >();

    candidates.forEach((candidate) => {
      const studentId = candidate.id;
      const data = candidate.data;
      const assignedFiles: AssignedFile[] = Array.isArray(data.assignedFiles) ? data.assignedFiles : [];
      if (assignedFiles.length === 0 && data.assignedFile) {
        assignedFiles.push(data.assignedFile);
      }

      const studentTrackKey = trackToKey(data.track || null);

      assignedFiles.forEach((file) => {
        if (!file || !file.id) return;

        let belongsToThisTrack = false;
        if (track === 'unified130') {
          belongsToThisTrack = file.track === 'unified130' || (file as any).is130 === true || unified130IdSet.has(file.id);
        } else {
          belongsToThisTrack = file.track === track || (!file.track && studentTrackKey === track);
        }

        if (!belongsToThisTrack) return;

        const groupKey = file.id;
        if (!map.has(groupKey)) {
          map.set(groupKey, {
            fileId: file.id,
            fileName: file.name || file.customName || 'ملف غير معنون',
            customNameExample: file.customName,
            track: file.track || track,
            assignedAt: file.assignedAt || new Date().toISOString(),
            studentIds: new Set<string>()
          });
        }

        const entry = map.get(groupKey)!;
        entry.studentIds.add(studentId);

        if (file.assignedAt && (!entry.assignedAt || file.assignedAt > entry.assignedAt)) {
          entry.assignedAt = file.assignedAt;
        }
      });
    });

    const result: DistributedFileSummary[] = Array.from(map.values()).map((entry) => {
      let formattedDate = '';
      let formattedTime = '';
      try {
        const d = new Date(entry.assignedAt);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          formattedTime = d.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        }
      } catch {
        formattedDate = entry.assignedAt;
      }

      return {
        fileId: entry.fileId,
        fileName: entry.fileName,
        customNameExample: entry.customNameExample,
        track: entry.track,
        assignedAt: entry.assignedAt,
        formattedDate,
        formattedTime,
        studentCount: entry.studentIds.size,
        studentIds: Array.from(entry.studentIds)
      };
    });

    // ترتيب من الأحدث إرسالاً إلى الأقدم
    result.sort((a, b) => {
      const timeA = new Date(a.assignedAt).getTime() || 0;
      const timeB = new Date(b.assignedAt).getTime() || 0;
      return timeB - timeA;
    });

    return result;
  } catch (error: any) {
    logger.error('Error getting distributed files for track:', error);
    throw new Error(error.message || 'حدث خطأ أثناء فحص الملفات الموزعة');
  }
};

export interface DistributedFolderSummary {
  folderKey: string;
  folderPath: string;
  folderName: string;
  subFolderName?: string;
  track: string;
  assignedAt: string;
  dateString: string;
  formattedDate: string;
  formattedTime: string;
  isToday: boolean;
  studentCount: number;
  studentIds: string[];
  fileIds: string[];
  filesCount: number;
}

/**
 * جلب ملخص المجلدات الموزعة على الطلاب مصنفة حسب المجلد واليوم/التاريخ
 * يتيح سحب فولدر كامل بتاريخ معين ويوم معين
 */
export const getDistributedFoldersForTrack = async (
  track: TrackKey | 'unified130'
): Promise<DistributedFolderSummary[]> => {
  try {
    const candidates = await fetchCandidatesForDistributedInspection(track);

    let allTrackFiles: AssignmentFileMeta[] = [];
    if (track !== 'unified130') {
      try {
        allTrackFiles = await getAssignmentFilesForTrack(track as TrackKey);
      } catch {}
    } else {
      try {
        allTrackFiles = await get130UnifiedFiles();
      } catch {}
    }

    const fileToFolderMap = new Map<string, string>();
    allTrackFiles.forEach((f) => {
      if (f.folderPath) fileToFolderMap.set(f.id, f.folderPath);
    });

    const todayDateString = new Date().toISOString().split('T')[0];

    const map = new Map<
      string,
      {
        folderKey: string;
        folderPath: string;
        folderName: string;
        subFolderName?: string;
        track: string;
        assignedAt: string;
        dateString: string;
        studentIds: Set<string>;
        fileIds: Set<string>;
      }
    >();

    candidates.forEach((candidate) => {
      const studentId = candidate.id;
      const data = candidate.data;
      const assignedFiles: AssignedFile[] = Array.isArray(data.assignedFiles) ? data.assignedFiles : [];
      if (assignedFiles.length === 0 && data.assignedFile) {
        assignedFiles.push(data.assignedFile);
      }

      const studentTrackKey = trackToKey(data.track || null);

      assignedFiles.forEach((file) => {
        if (!file || !file.id) return;

        let belongsToThisTrack = false;
        if (track === 'unified130') {
          belongsToThisTrack = file.track === 'unified130' || (file as any).is130 === true;
        } else {
          belongsToThisTrack = file.track === track || (!file.track && studentTrackKey === track);
        }
        if (!belongsToThisTrack) return;

        const rawFp = file.folderPath || fileToFolderMap.get(file.id) || file.folderName || 'تكليفات بدون مجلد';
        const mainFolderName = rawFp.includes('/') ? rawFp.split('/')[0].trim() : rawFp.trim();
        const subFolderName = rawFp.includes('/') ? rawFp.split('/').slice(1).join('/').trim() : '';

        let dateString = 'unknown-date';
        const rawAssignedAt = file.assignedAt || '';
        if (rawAssignedAt) {
          try {
            dateString = new Date(rawAssignedAt).toISOString().split('T')[0];
          } catch {
            dateString = rawAssignedAt.substring(0, 10);
          }
        }

        const groupKey = `${mainFolderName}:::${dateString}`;
        if (!map.has(groupKey)) {
          map.set(groupKey, {
            folderKey: groupKey,
            folderPath: mainFolderName,
            folderName: mainFolderName,
            subFolderName,
            track: file.track || track,
            assignedAt: rawAssignedAt || new Date().toISOString(),
            dateString,
            studentIds: new Set<string>(),
            fileIds: new Set<string>()
          });
        }

        const entry = map.get(groupKey)!;
        entry.studentIds.add(studentId);
        entry.fileIds.add(file.id);
        if (rawAssignedAt && (!entry.assignedAt || rawAssignedAt > entry.assignedAt)) {
          entry.assignedAt = rawAssignedAt;
        }
      });
    });

    const result: DistributedFolderSummary[] = Array.from(map.values()).map((entry) => {
      let formattedDate = entry.dateString;
      let formattedTime = '';
      const isToday = entry.dateString === todayDateString;

      try {
        const d = new Date(entry.assignedAt);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          formattedTime = d.toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        }
      } catch {
        formattedDate = entry.dateString;
      }

      return {
        folderKey: entry.folderKey,
        folderPath: entry.folderPath,
        folderName: entry.folderName,
        subFolderName: entry.subFolderName,
        track: entry.track,
        assignedAt: entry.assignedAt,
        dateString: entry.dateString,
        formattedDate,
        formattedTime,
        isToday,
        studentCount: entry.studentIds.size,
        studentIds: Array.from(entry.studentIds),
        fileIds: Array.from(entry.fileIds),
        filesCount: entry.fileIds.size
      };
    });

    result.sort((a, b) => {
      const timeA = new Date(a.assignedAt).getTime() || 0;
      const timeB = new Date(b.assignedAt).getTime() || 0;
      return timeB - timeA;
    });

    return result;
  } catch (error: any) {
    logger.error('Error getting distributed folders for track:', error);
    throw new Error(error.message || 'حدث خطأ أثناء فحص المجلدات الموزعة');
  }
};

/**
 * سحب مجلد كامل موزع على الطلاب بتاريخ معين أو في كافة التواريخ
 */
export const revokeDistributedFolderFromStudents = async (params: {
  track: TrackKey | 'unified130';
  folderPath: string;
  dateString?: string;
  studentIds?: string[];
  fileIds?: string[];
  onProgress?: (revokedStudents: number, total: number) => void;
}): Promise<{ updatedStudentsCount: number; revokedFilesCount: number }> => {
  try {
    const { track, folderPath, dateString, studentIds: targetStudentIds, fileIds: targetFileIds, onProgress } = params;

    let allTrackFiles: AssignmentFileMeta[] = [];
    if (track !== 'unified130') {
      try {
        allTrackFiles = await getAssignmentFilesForTrack(track as TrackKey);
      } catch {}
    } else {
      try {
        allTrackFiles = await get130UnifiedFiles();
      } catch {}
    }
    const fileToFolderMap = new Map<string, string>();
    allTrackFiles.forEach((f) => {
      if (f.folderPath) fileToFolderMap.set(f.id, f.folderPath);
    });

    const targetFileIdSet = targetFileIds && targetFileIds.length > 0 ? new Set(targetFileIds) : null;

    let studentDocs: any[] = [];
    if (targetStudentIds && targetStudentIds.length > 0) {
      const uniqueStudentIds = Array.from(new Set(targetStudentIds));
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueStudentIds.length; i += 30) {
        chunks.push(uniqueStudentIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const docsSnap = await Promise.all(chunk.map((id) => getDoc(doc(db, 'students', id))));
        docsSnap.forEach((ds) => {
          if (ds.exists()) studentDocs.push(ds);
        });
      }
    } else {
      const q = query(collection(db, 'students'), where('assignedFile', '!=', null));
      const snap = await getDocs(q);
      studentDocs = snap.docs;
    }

    let batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 25;
    let updatedStudentsCount = 0;
    let totalRevokedFiles = 0;
    let processed = 0;
    const totalDocs = studentDocs.length;

    for (const docSnap of studentDocs) {
      const data = docSnap.data();
      const existingFiles: AssignedFile[] = Array.isArray(data.assignedFiles) ? data.assignedFiles : [];
      if (existingFiles.length === 0 && data.assignedFile) {
        existingFiles.push(data.assignedFile);
      }

      let removedForStudent = 0;
      const remainingFiles = existingFiles.filter((f) => {
        if (!f || !f.id) return false;

        const resolvedFolder = f.folderPath || fileToFolderMap.get(f.id) || f.folderName || '';
        const folderMatches =
          resolvedFolder === folderPath ||
          f.folderName === folderPath ||
          resolvedFolder.startsWith(`${folderPath}/`);

        let dateMatches = true;
        if (dateString && dateString !== 'all') {
          const fileDate = f.assignedAt ? f.assignedAt.substring(0, 10) : '';
          dateMatches = fileDate === dateString;
        }

        const idMatches = targetFileIdSet ? targetFileIdSet.has(f.id) : true;

        if (folderMatches && dateMatches && idMatches) {
          removedForStudent++;
          return false;
        }
        return true;
      });

      if (removedForStudent > 0) {
        totalRevokedFiles += removedForStudent;
        updatedStudentsCount++;

        const updatePayload: any = {
          assignedFiles: remainingFiles,
          assignedFile: remainingFiles.length > 0 ? remainingFiles[remainingFiles.length - 1] : null,
          updatedAt: serverTimestamp()
        };

        batch.update(doc(db, 'students', docSnap.id), updatePayload);
        batchCount++;

        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          await new Promise((r) => setTimeout(r, 15));
        }
      }

      processed++;
      if (onProgress) {
        onProgress(processed, totalDocs);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return { updatedStudentsCount, revokedFilesCount: totalRevokedFiles };
  } catch (error: any) {
    logger.error('Error revoking distributed folder:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب المجلد من حسابات الطلاب');
  }
};

/**
 * سحب كافة المجلدات المرسلة في تاريخ أو يوم معين
 */
export const revokeAllFoldersForDate = async (
  track: TrackKey | 'unified130',
  dateString: string,
  onProgress?: (revokedStudents: number, total: number) => void
): Promise<{ updatedStudentsCount: number; revokedFilesCount: number }> => {
  try {
    const folders = await getDistributedFoldersForTrack(track);
    const targetFolders = folders.filter((f) => f.dateString === dateString);
    if (targetFolders.length === 0) {
      return { updatedStudentsCount: 0, revokedFilesCount: 0 };
    }

    let totalUpdated = 0;
    let totalFiles = 0;

    for (const folder of targetFolders) {
      const res = await revokeDistributedFolderFromStudents({
        track,
        folderPath: folder.folderPath,
        dateString,
        studentIds: folder.studentIds,
        fileIds: folder.fileIds,
        onProgress
      });
      totalUpdated += res.updatedStudentsCount;
      totalFiles += res.revokedFilesCount;
    }

    return { updatedStudentsCount: totalUpdated, revokedFilesCount: totalFiles };
  } catch (error: any) {
    logger.error('Error revoking all folders for date:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب مجلدات هذا اليوم');
  }
};

/**
 * سحب ملف محدد تم توزيعه من حسابات كافة الطلاب الذين استلموه
 * يستخدم writeBatch المقسم على 450 عملية لتفادي حدود Firestore
 */
export const revokeDistributedFileFromStudents = async (
  fileId: string,
  targetStudentIds?: string[],
  onProgress?: (revokedCount: number, total: number) => void
): Promise<number> => {
  try {
    if (!fileId) return 0;

    let studentDocs: any[] = [];
    if (targetStudentIds && targetStudentIds.length > 0) {
      // جلب مستندات الطلاب المحددين فقط لتوفير القراءات
      const chunks: string[][] = [];
      for (let i = 0; i < targetStudentIds.length; i += 30) {
        chunks.push(targetStudentIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const docsSnap = await Promise.all(chunk.map((id) => getDoc(doc(db, 'students', id))));
        docsSnap.forEach((ds) => {
          if (ds.exists()) studentDocs.push(ds);
        });
      }
    } else {
      const q = query(collection(db, 'students'), where('assignedFile', '!=', null));
      const snap = await getDocs(q);
      studentDocs = snap.docs;
    }

    let updatedCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 450;
    const total = studentDocs.length;

    for (let i = 0; i < studentDocs.length; i++) {
      const sDoc = studentDocs[i];
      const data = sDoc.data();
      const assignedFiles: any[] = data.assignedFiles || [];

      const filtered = assignedFiles.filter((f: any) => f.id !== fileId);
      const wasInAssignedFile = data.assignedFile && data.assignedFile.id === fileId;

      if (filtered.length !== assignedFiles.length || wasInAssignedFile) {
        const updateData: any = {
          assignedFiles: filtered,
          updatedAt: serverTimestamp()
        };
        if (filtered.length > 0) {
          updateData.assignedFile = filtered[filtered.length - 1];
        } else {
          updateData.assignedFile = null;
        }

        batch.update(sDoc.ref, updateData);
        updatedCount++;
        batchCount++;

        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    logger.log(`Revoked file ${fileId} from ${updatedCount} students`);
    return updatedCount;
  } catch (error: any) {
    logger.error('Error revoking distributed file from students:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب الملف من الطلاب');
  }
};

/**
 * سحب عدة ملفات محددة تم توزيعها من حسابات كافة الطلاب الذين استلموها
 * يدعم التحديد المتعدد والسحب بدفعة واحدة مع writeBatch
 */
export const revokeMultipleDistributedFilesFromStudents = async (
  fileIds: string[],
  targetStudentIds?: string[],
  onProgress?: (revokedCount: number, total: number) => void
): Promise<{ updatedStudentsCount: number; removedFilesCount: number }> => {
  try {
    if (!fileIds || fileIds.length === 0) {
      return { updatedStudentsCount: 0, removedFilesCount: 0 };
    }
    const fileIdSet = new Set(fileIds);

    let studentDocs: any[] = [];
    if (targetStudentIds && targetStudentIds.length > 0) {
      const uniqueStudentIds = Array.from(new Set(targetStudentIds));
      const chunks: string[][] = [];
      for (let i = 0; i < uniqueStudentIds.length; i += 30) {
        chunks.push(uniqueStudentIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const docsSnap = await Promise.all(chunk.map((id) => getDoc(doc(db, 'students', id))));
        docsSnap.forEach((ds) => {
          if (ds.exists()) studentDocs.push(ds);
        });
      }
    } else {
      const q = query(collection(db, 'students'), where('assignedFile', '!=', null));
      const snap = await getDocs(q);
      studentDocs = snap.docs;
    }

    let updatedStudentsCount = 0;
    let totalRemovedFiles = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 450;
    const total = studentDocs.length;

    for (let i = 0; i < studentDocs.length; i++) {
      const sDoc = studentDocs[i];
      const data = sDoc.data();
      const assignedFiles: any[] = data.assignedFiles || [];

      const filtered = assignedFiles.filter((f: any) => !fileIdSet.has(f.id));
      const wasInAssignedFile = data.assignedFile && fileIdSet.has(data.assignedFile.id);
      const diffCount = assignedFiles.length - filtered.length;

      if (diffCount > 0 || wasInAssignedFile) {
        totalRemovedFiles += diffCount > 0 ? diffCount : 1;
        const updateData: any = {
          assignedFiles: filtered,
          updatedAt: serverTimestamp()
        };
        if (filtered.length > 0) {
          updateData.assignedFile = filtered[filtered.length - 1];
        } else {
          updateData.assignedFile = null;
        }

        batch.update(sDoc.ref, updateData);
        updatedStudentsCount++;
        batchCount++;

        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    logger.log(`Revoked ${fileIds.length} files from ${updatedStudentsCount} students (removed ${totalRemovedFiles} assignments)`);
    return { updatedStudentsCount, removedFilesCount: totalRemovedFiles };
  } catch (error: any) {
    logger.error('Error revoking multiple distributed files from students:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب الملفات المحددة من الطلاب');
  }
};

/**
 * سحب كل الملفات الموزعة في مسار معين من كافة الطلاب
 */
export const revokeAllDistributedFilesForTrack = async (
  track: TrackKey | 'unified130',
  onProgress?: (processed: number, total: number) => void
): Promise<{ updatedStudents: number; removedFilesCount: number }> => {
  try {
    const q = query(collection(db, 'students'), where('assignedFile', '!=', null));
    const snap = await getDocs(q);

    let unified130IdSet = new Set<string>();
    if (track === 'unified130') {
      try {
        const uFiles = await get130UnifiedFiles();
        unified130IdSet = new Set(uFiles.map((f) => f.id));
      } catch {
        // fallback
      }
    }

    let updatedStudents = 0;
    let removedFilesCount = 0;
    let batch = writeBatch(db);
    let batchCount = 0;
    const MAX_BATCH = 450;
    const total = snap.docs.length;

    for (let i = 0; i < snap.docs.length; i++) {
      const sDoc = snap.docs[i];
      const data = sDoc.data();
      const assignedFiles: any[] = data.assignedFiles || [];
      const studentTrackKey = trackToKey(data.track || null);

      if (assignedFiles.length === 0 && !data.assignedFile) continue;

      const filtered = assignedFiles.filter((file: any) => {
        let isThisTrack = false;
        if (track === 'unified130') {
          isThisTrack = file.track === 'unified130' || (file as any).is130 === true || unified130IdSet.has(file.id);
        } else {
          isThisTrack = file.track === track || (!file.track && studentTrackKey === track);
        }
        return !isThisTrack;
      });

      const removedCount = assignedFiles.length - filtered.length;
      const lastAssignedIsThisTrack =
        data.assignedFile &&
        (track === 'unified130'
          ? data.assignedFile.track === 'unified130' || (data.assignedFile as any).is130 === true || unified130IdSet.has(data.assignedFile.id)
          : data.assignedFile.track === track || (!data.assignedFile.track && studentTrackKey === track));

      if (removedCount > 0 || lastAssignedIsThisTrack) {
        removedFilesCount += removedCount > 0 ? removedCount : 1;
        const updateData: any = {
          assignedFiles: filtered,
          updatedAt: serverTimestamp()
        };
        if (filtered.length > 0) {
          updateData.assignedFile = filtered[filtered.length - 1];
        } else {
          updateData.assignedFile = null;
        }

        batch.update(sDoc.ref, updateData);
        updatedStudents++;
        batchCount++;

        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    logger.log(`Revoked all files for ${track} from ${updatedStudents} students (${removedFilesCount} files)`);
    return { updatedStudents, removedFilesCount };
  } catch (error: any) {
    logger.error('Error revoking all distributed files for track:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب ملفات المسار من الطلاب');
  }
};

export interface StudentWithAssignedFiles {
  id: string;
  fullNameArabic: string;
  phone?: string;
  nationalID?: string;
  track?: string;
  assignedFiles: AssignedFile[];
}

/**
 * جلب قائمة الطلاب الذين لديهم ملفات مسندة حالياً مع إمكانية التصفية حسب المسار
 */
export const getStudentsWithAssignedFiles = async (
  trackFilter?: TrackKey | 'unified130'
): Promise<StudentWithAssignedFiles[]> => {
  try {
    const candidates = await fetchCandidatesForDistributedInspection(trackFilter || 'track1');

    let unified130IdSet = new Set<string>();
    if (trackFilter === 'unified130') {
      try {
        const uFiles = await get130UnifiedFiles();
        unified130IdSet = new Set(uFiles.map((f) => f.id));
      } catch {
        // ignore
      }
    }

    const students: StudentWithAssignedFiles[] = [];

    candidates.forEach((candidate) => {
      const data = candidate.data;
      let assignedFiles: AssignedFile[] = Array.isArray(data.assignedFiles) ? data.assignedFiles : [];
      if (assignedFiles.length === 0 && data.assignedFile) {
        assignedFiles.push(data.assignedFile);
      }

      if (assignedFiles.length === 0) return;

      const studentTrackKey = trackToKey(data.track || null);

      if (trackFilter) {
        if (trackFilter === 'unified130') {
          assignedFiles = assignedFiles.filter(
            (f) => f.track === 'unified130' || (f as any).is130 === true || unified130IdSet.has(f.id)
          );
        } else {
          assignedFiles = assignedFiles.filter(
            (f) => f.track === trackFilter || (!f.track && studentTrackKey === trackFilter)
          );
        }
      }

      if (assignedFiles.length > 0) {
        students.push({
          id: candidate.id,
          fullNameArabic: data.fullNameArabic || 'طالب بدون اسم',
          phone: data.phone,
          nationalID: data.nationalID,
          track: data.track,
          assignedFiles
        });
      }
    });

    return students;
  } catch (error: any) {
    logger.error('Error getting students with assigned files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب بيانات الطلاب');
  }
};

/**
 * سحب ملف محدد من حساب طالب واحد بالاسم
 */
export const revokeSingleFileFromStudent = async (
  studentId: string,
  fileId: string
): Promise<void> => {
  try {
    const studentRef = doc(db, 'students', studentId);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) throw new Error('لم يتم العثور على حساب الطالب');

    const data = snap.data();
    const assignedFiles: AssignedFile[] = Array.isArray(data.assignedFiles) ? data.assignedFiles : [];
    const filtered = assignedFiles.filter((f) => f.id !== fileId);

    const updateData: any = {
      assignedFiles: filtered,
      updatedAt: new Date().toISOString()
    };
    if (filtered.length > 0) {
      updateData.assignedFile = filtered[filtered.length - 1];
    } else {
      updateData.assignedFile = null;
    }

    await updateStudentData(studentId, updateData);
  } catch (error: any) {
    logger.error('Error revoking single file from student:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب الملف من الطالب');
  }
};

/**
 * سحب كافة الملفات من حساب طالب واحد بالاسم
 */
export const revokeAllFilesFromStudent = async (
  studentId: string,
  trackFilter?: TrackKey | 'unified130'
): Promise<number> => {
  try {
    const studentRef = doc(db, 'students', studentId);
    const snap = await getDoc(studentRef);
    if (!snap.exists()) throw new Error('لم يتم العثور على حساب الطالب');

    const data = snap.data();
    const assignedFiles: AssignedFile[] = Array.isArray(data.assignedFiles) ? data.assignedFiles : [];

    let filtered: AssignedFile[] = [];
    if (trackFilter) {
      const studentTrackKey = trackToKey(data.track || null);
      let unified130IdSet = new Set<string>();
      if (trackFilter === 'unified130') {
        try {
          const uFiles = await get130UnifiedFiles();
          unified130IdSet = new Set(uFiles.map((f) => f.id));
        } catch {
          // ignore
        }
      }

      filtered = assignedFiles.filter((f) => {
        if (trackFilter === 'unified130') {
          return !(f.track === 'unified130' || (f as any).is130 === true || unified130IdSet.has(f.id));
        } else {
          return !(f.track === trackFilter || (!f.track && studentTrackKey === trackFilter));
        }
      });
    }

    const removedCount = assignedFiles.length - filtered.length;

    const updateData: any = {
      assignedFiles: filtered,
      updatedAt: new Date().toISOString()
    };
    if (filtered.length > 0) {
      updateData.assignedFile = filtered[filtered.length - 1];
    } else {
      updateData.assignedFile = null;
    }

    await updateStudentData(studentId, updateData);
    return removedCount > 0 ? removedCount : assignedFiles.length;
  } catch (error: any) {
    logger.error('Error revoking all files from student:', error);
    throw new Error(error.message || 'حدث خطأ أثناء سحب كافة ملفات الطالب');
  }
};

// Get all students (for admin view)
export const getAllStudents = async (): Promise<StudentData[]> => {
  try {
    const q = query(collection(db, 'students'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
    });
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب البيانات');
  }
};

/** عدد مستندات الطلاب دون تنزيل المحتوى — سريع للواجهة */
export const getStudentsCollectionCount = async (): Promise<number> => {
  try {
    const snapshot = await getCountFromServer(query(collection(db, 'students')));
    return snapshot.data().count;
  } catch (error: any) {
    logger.error('getStudentsCollectionCount:', error);
    throw new Error(error.message || 'فشل حساب عدد المستخدمين');
  }
};

const mapStudentDoc = (docSnap: QueryDocumentSnapshot<DocumentData>): StudentData => {
  const data = docSnap.data();
  const fullNameArabic = data.fullNameArabic || data.full_name_arabic || data.full_name || '';
  const fullNameEnglish = data.fullNameEnglish || data.full_name_english || data.vehicleNameEnglish || '';
  const whatsappNumber = data.whatsappNumber || data.whatsapp_number || data.phone || data.phoneNumber || data.mobile || '';
  const nationalID = data.nationalID || data.national_id || '';
  const diplomaType = data.diplomaType || data.diploma_type || '';
  const diplomaYear = data.diplomaYear || data.diploma_year || '';

  return {
    ...data,
    id: docSnap.id,
    fullNameArabic,
    fullNameEnglish,
    vehicleNameEnglish: data.vehicleNameEnglish || fullNameEnglish,
    whatsappNumber,
    nationalID,
    diplomaType,
    diplomaYear,
    course: data.course || data.track || data.track_name || '',
    track: data.track || data.track_name || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  } as StudentData;
};

/**
 * صفحة من مستخدمي الطلاب (ترتيب مستقر documentId) — للتحميل التدريجي بدل لقطة واحدة ثقيلة.
 */
export const fetchStudentsPageByDocumentId = async (
  pageSize: number,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
): Promise<{
  students: StudentData[];
  lastSnapshot: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> => {
  const coll = collection(db, 'students');
  const q = lastDoc
    ? query(coll, orderBy(documentId()), startAfter(lastDoc), limit(pageSize))
    : query(coll, orderBy(documentId()), limit(pageSize));
  const snap = await getDocs(q);
  const students = snap.docs.map(mapStudentDoc);
  const lastSnapshot = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  const hasMore = snap.docs.length === pageSize;
  return { students, lastSnapshot, hasMore };
};

// Real-time listener for all students
export const subscribeToAllStudents = (
  callback: (students: StudentData[]) => void,
  onError?: (error: any) => void
): (() => void) => {
  const q = query(collection(db, 'students'));

  return onSnapshot(q, (querySnapshot) => {
    const students: StudentData[] = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;
    });
    logger.log('subscribeToAllStudents: Found', students.length, 'students');
    callback(students);
  }, (error) => {
    logger.error('Error in students subscription:', error);
    if (onError) {
      onError(error);
    }
  });
};

// Service Preferences (Order and Profits)
export const getAdminPreferences = async (): Promise<any> => {
  try {
    const docSnap = await getDoc(doc(db, 'config', 'adminPreferences'));
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return { serviceOrder: [], profitCosts: {} };
  } catch (error) {
    logger.error('Error fetching admin preferences:', error);
    return { serviceOrder: [], profitCosts: {} };
  }
};

export const updateAdminPreferences = async (config: any): Promise<void> => {
  try {
    await setDoc(doc(db, 'config', 'adminPreferences'), config, { merge: true });
  } catch (error: any) {
    logger.error('Error updating admin preferences:', error);
    throw new Error(error?.message ? `حدث خطأ أثناء حفظ التفضيلات: ${error.message}` : 'حدث خطأ أثناء حفظ التفضيلات');
  }
};

export const subscribeToAdminPreferences = (
  onUpdate: (config: any) => void
): (() => void) => {
  const docRef = doc(db, 'config', 'adminPreferences');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data());
      } else {
        onUpdate({ serviceOrder: [], profitCosts: {} });
      }
    },
    (error) => {
      logger.error('Error in admin preferences subscription:', error);
    }
  );
};

// Search for a student by any field (Optimized to reduce Firestore Reads while guaranteeing 100% result accuracy)
// Search for a student by any field (Optimized to reduce Firestore Reads while guaranteeing 100% result accuracy)
export const searchStudent = async (searchTerm: string, cachedStudents?: StudentData[]): Promise<StudentData[]> => {
  try {
    const searchTrimmed = searchTerm.trim();
    if (!searchTrimmed) {
      return [];
    }

    const searchLower = searchTrimmed.toLowerCase();
    const searchNorm = normalizeArabicText(searchTrimmed);
    const isNumeric = /^\d+$/.test(searchTrimmed);

    const filterStudent = (student: StudentData): boolean => {
      if (!student) return false;
      const s = student as any;

      const arabicName = String(s.fullNameArabic || s.full_name_arabic || s.full_name || '');
      const arabicNameNorm = normalizeArabicText(arabicName);

      const englishName = String(s.vehicleNameEnglish || s.fullNameEnglish || s.full_name_english || '').toLowerCase();
      const email = String(s.email || '').toLowerCase();
      const whatsapp = String(s.whatsappNumber || s.phone || s.phoneNumber || s.mobile || '');
      const natId = String(s.nationalID || s.national_id || '');
      const diploma = String(s.diplomaType || s.diploma_type || s.diplomaYear || s.diploma_year || '').toLowerCase();
      const course = String(s.course || s.track || s.track_name || '').toLowerCase();
      const idStr = String(s.id || '').toLowerCase();

      let addrStr = '';
      if (s.address) {
        if (typeof s.address === 'object') {
          addrStr = `${s.address.governorate || ''} ${s.address.city || ''} ${s.address.street || ''} ${s.address.building || ''} ${s.address.siteNumber || ''} ${s.address.landmark || ''}`;
        } else {
          addrStr = String(s.address);
        }
      }
      const addrNorm = normalizeArabicText(addrStr);

      const isTextSearch = !isNumeric && !searchTrimmed.includes('@');

      if (isTextSearch) {
        return (
          arabicNameNorm.startsWith(searchNorm) ||
          arabicName.toLowerCase().startsWith(searchLower) ||
          englishName.startsWith(searchLower)
        );
      }

      return (
        arabicNameNorm.startsWith(searchNorm) ||
        englishName.startsWith(searchLower) ||
        email.includes(searchLower) ||
        whatsapp.includes(searchTrimmed) ||
        natId.includes(searchTrimmed) ||
        diploma.includes(searchLower) ||
        course.includes(searchLower) ||
        addrNorm.includes(searchNorm) ||
        idStr.includes(searchLower)
      );
    };

    const matchedDocsMap = new Map<string, StudentData>();

    // 1. Add any matches from local memory cache first (0 Reads)
    if (cachedStudents && cachedStudents.length > 0) {
      cachedStudents.filter(filterStudent).forEach(s => {
        if (s?.id) matchedDocsMap.set(s.id, s);
      });
    }

    // Avoid firing 4-8 Firestore queries on a single character
    if (searchTrimmed.length < 2) {
      return Array.from(matchedDocsMap.values());
    }

    // 2. ALWAYS execute targeted queries on Firestore to fetch matches outside local cache
    const studentsRef = collection(db, 'students');
    const queryPromises: Promise<any>[] = [];

    // Search via searchKeywords array-contains (deduplicated)
    queryPromises.push(
      getDocs(query(studentsRef, where('searchKeywords', 'array-contains', searchLower), limit(50)))
    );
    if (searchNorm && searchNorm !== searchLower) {
      queryPromises.push(
        getDocs(query(studentsRef, where('searchKeywords', 'array-contains', searchNorm), limit(50)))
      );
    }

    if (isNumeric) {
      // Search by nationalID or whatsappNumber prefix
      queryPromises.push(
        getDocs(query(studentsRef, where('nationalID', '>=', searchTrimmed), where('nationalID', '<=', searchTrimmed + '\uf8ff'), limit(50)))
      );
      queryPromises.push(
        getDocs(query(studentsRef, where('whatsappNumber', '>=', searchTrimmed), where('whatsappNumber', '<=', searchTrimmed + '\uf8ff'), limit(50)))
      );
    } else if (searchTrimmed.includes('@')) {
      // Search by email prefix
      queryPromises.push(
        getDocs(query(studentsRef, where('email', '>=', searchLower), where('email', '<=', searchLower + '\uf8ff'), limit(50)))
      );
    } else {
      const containsEnglish = /[a-zA-Z]/.test(searchTrimmed);

      if (containsEnglish) {
        // English name & Email prefix queries (TitleCase & lowercase)
        const capitalized = searchTrimmed.charAt(0).toUpperCase() + searchTrimmed.slice(1);
        queryPromises.push(
          getDocs(query(studentsRef, where('vehicleNameEnglish', '>=', capitalized), where('vehicleNameEnglish', '<=', capitalized + '\uf8ff'), limit(50)))
        );
        queryPromises.push(
          getDocs(query(studentsRef, where('vehicleNameEnglish', '>=', searchLower), where('vehicleNameEnglish', '<=', searchLower + '\uf8ff'), limit(50)))
        );
        queryPromises.push(
          getDocs(query(studentsRef, where('fullNameEnglish', '>=', capitalized), where('fullNameEnglish', '<=', capitalized + '\uf8ff'), limit(50)))
        );
        queryPromises.push(
          getDocs(query(studentsRef, where('fullNameEnglish', '>=', searchLower), where('fullNameEnglish', '<=', searchLower + '\uf8ff'), limit(50)))
        );
        queryPromises.push(
          getDocs(query(studentsRef, where('email', '>=', searchLower), where('email', '<=', searchLower + '\uf8ff'), limit(50)))
        );
      } else {
        // Arabic name queries (prefix fallback for untokenized docs)
        queryPromises.push(
          getDocs(query(studentsRef, where('fullNameArabic', '>=', searchTrimmed), where('fullNameArabic', '<=', searchTrimmed + '\uf8ff'), limit(50)))
        );
        queryPromises.push(
          getDocs(query(studentsRef, where('full_name_arabic', '>=', searchTrimmed), where('full_name_arabic', '<=', searchTrimmed + '\uf8ff'), limit(50)))
        );

        // Normalize Alef / Hamza (أ, إ, آ, ا) to catch user spelling variations
        const normalizedAlef = searchTrimmed.replace(/^[أإآا]/, '');
        if (normalizedAlef && normalizedAlef !== searchTrimmed) {
          ['أ', 'إ', 'آ', 'ا'].forEach(prefix => {
            const variant = prefix + normalizedAlef;
            queryPromises.push(
              getDocs(query(studentsRef, where('fullNameArabic', '>=', variant), where('fullNameArabic', '<=', variant + '\uf8ff'), limit(50)))
            );
          });
        }
      }
    }

    const querySnapshots = await Promise.all(queryPromises);
    querySnapshots.forEach(snap => {
      if (snap && snap.docs) {
        snap.docs.forEach((d: any) => {
          const data = d.data() as Record<string, any>;
          const student = {
            ...data,
            id: d.id,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          } as StudentData;

          if (filterStudent(student)) {
            matchedDocsMap.set(d.id, student);
          }
        });
      }
    });

    return Array.from(matchedDocsMap.values());
  } catch (error: any) {
    logger.error('Search error:', error);
    return [];
  }
};


// Validate file type (images only for security)
const isValidImageType = (fileType: string): boolean => {
  const allowedTypes = ['JPEG', 'JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF'];
  return allowedTypes.includes(fileType.toUpperCase());
};

// Calculate document size in bytes (for debugging)
const calculateDocumentSize = (obj: any): number => {
  return new Blob([JSON.stringify(obj)]).size;
};

// Safe conversion of data URL to Blob without fetch() (prevents "Failed to fetch" on mobile/WebViews)
const safeDataUrlToBlob = (dataUrl: string): Blob => {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('رابط البيانات غير صالح');
  }
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binStr = atob(parts[1]);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

// Client-side image compression to speed up upload and prevent timeouts on weak mobile connections
const compressImageForUpload = async (blobOrFile: Blob | File, maxWidth = 1280, quality = 0.82): Promise<Blob> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return blobOrFile;
  }
  // Only compress images, skip PDF
  if (blobOrFile.type === 'application/pdf' || blobOrFile.type.includes('pdf')) {
    return blobOrFile;
  }
  // If already small (<= 250 KB), return as is
  if (blobOrFile.size <= 250 * 1024) {
    return blobOrFile;
  }

  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(blobOrFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(blobOrFile);
          return;
        }

        // فحص سريع لجودة المحتوى (منع رفع الصور السوداء بالكامل أو البيضاء الفارغة)
        try {
          const sampleSize = 32;
          const sCanvas = document.createElement('canvas');
          sCanvas.width = sampleSize;
          sCanvas.height = sampleSize;
          const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
          if (sCtx) {
            sCtx.drawImage(img, 0, 0, sampleSize, sampleSize);
            const pData = sCtx.getImageData(0, 0, sampleSize, sampleSize).data;
            let totB = 0;
            let minB = 255;
            let maxB = 0;
            const pCount = pData.length / 4;
            for (let i = 0; i < pData.length; i += 4) {
              const b = 0.299 * pData[i] + 0.587 * pData[i + 1] + 0.114 * pData[i + 2];
              totB += b;
              if (b < minB) minB = b;
              if (b > maxB) maxB = b;
            }
            const avgB = totB / pCount;
            if (avgB < 15 && maxB < 40) {
              reject(new Error('الصورة المرفقة مظلمة أو سوداء تماماً، يرجى تشغيل الإضاءة أو إعادة التقاط الصورة بوضوح.'));
              return;
            }
            if (avgB > 245 && minB > 225) {
              reject(new Error('الصورة المرفقة فارغة أو بيضاء تماماً، يرجى التأكد من اختيار الصورة أو الإيصال الصحيح.'));
              return;
            }
          }
        } catch {
          // في حال حدوث أي خطأ في فحص الـ Canvas نكمل بشكل طبيعي
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob && compressedBlob.size < blobOrFile.size) {
              resolve(compressedBlob);
            } else {
              resolve(blobOrFile);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blobOrFile);
      };
      img.src = url;
    } catch {
      resolve(blobOrFile);
    }
  });
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Upload file to Cloudinary with multi-layer fallback (Cloudinary -> Firebase Storage -> Supabase -> Safe Data URL)
// Guarantees zero "Failed to fetch" blockers for users across all networks & devices.
export const uploadFileToCloudinary = async (file: UploadedFile, studentId: string, serviceId: string): Promise<string> => {
  try {
    // Security: Validate file type
    if (!isValidImageType(file.type)) {
      throw new Error(`نوع الملف غير مدعوم. مسموح برفع الصور فقط (JPG, PNG, WEBP, إلخ)`);
    }

    // Security: Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`حجم الملف كبير جداً. الحد الأقصى هو ${MAX_FILE_SIZE_MB} ميجابايت.`);
    }

    let rawBlob: File | Blob;

    // 1. Get raw file or blob safely without fetch()
    if (file.file && file.file instanceof Blob) {
      rawBlob = file.file;
    } else if (file.url && file.url.startsWith('data:')) {
      rawBlob = safeDataUrlToBlob(file.url);
    } else if (file.preview && file.preview.startsWith('data:')) {
      rawBlob = safeDataUrlToBlob(file.preview);
    } else {
      throw new Error('تعذر قراءة ملف الإيصال المرفق');
    }

    // 2. Compress image if needed for fast and reliable mobile upload
    const fileToUpload = await compressImageForUpload(rawBlob, 1280, 0.82);

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const publicId = `serviceRequests/${studentId}/${serviceId}/${timestamp}_${sanitizedFileName}`;

    // 3. Upload to Cloudinary (100% Cloudinary Free Tier Only)
    // Direct /auto/upload endpoint avoids any HTTP 301/307 redirects that cause mobile CORS "Failed to fetch"
    const maxAttempts = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', fileToUpload, file.name);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('public_id', publicId);
        formData.append('folder', 'serviceRequests');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

        const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          let optimizedUrl = data.secure_url || data.url;
          if (file.type.toUpperCase() !== 'PDF' && optimizedUrl) {
            const uploadIndex = optimizedUrl.indexOf('/upload/');
            if (uploadIndex > 0) {
              optimizedUrl = optimizedUrl.substring(0, uploadIndex + 8) + 'c_limit,w_1280,q_auto:good,f_auto/' + optimizedUrl.substring(uploadIndex + 8);
            }
          }
          if (optimizedUrl) {
            return optimizedUrl;
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.error?.message || `فشل الرفع إلى Cloudinary (كود ${response.status})`;
          lastError = new Error(errMsg);
        }
      } catch (err: any) {
        lastError = err;
        logger.warn(`Cloudinary upload attempt ${attempt} failed:`, err?.message || err);
        if (attempt < maxAttempts) {
          // Wait 500ms before retry
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    throw lastError || new Error('فشل رفع الملف إلى Cloudinary. يرجى التأكد من اتصال الإنترنت.');
  } catch (error: any) {
    logger.error('Error in uploadFileToCloudinary:', error);
    throw new Error(error.message || 'حدث خطأ أثناء رفع الملف');
  }
};

// Service Request Functions
export const addServiceRequest = async (request: ServiceRequest): Promise<string> => {
  try {
    // التحقق الصارم من الخدمة 5: حل وتسليم التكليفات (لا يجوز رفع الطلب بدون تحديد تكليف واحد على الأقل)
    if (String(request.serviceId) === '5') {
      const selected = request.data?.selectedAssignments;
      if (!selected || !Array.isArray(selected) || selected.length === 0) {
        throw new Error('لا يمكن تقديم طلب خدمة حل التكليفات دون تحديد تكليف واحد على الأقل.');
      }
    }

    // Each service has its own collection
    const collectionName = `serviceRequests_${request.serviceId}`;
    const requestRef = doc(collection(db, collectionName));

    // Upload files to Cloudinary and get URLs
    let documentUrls: Array<{ name: string; url: string; size: number; type: string }> = [];

    if (request.documents && request.documents.length > 0) {
      const uploadPromises = request.documents.map(async (file) => {
        try {
          const url = await uploadFileToCloudinary(file, request.studentId, request.serviceId);
          return {
            name: file.name,
            url: url, // Cloudinary URL (optimized)
            size: file.size,
            type: file.type
          };
        } catch (error) {
          logger.error(`Error uploading file ${file.name}:`, error);
          throw error;
        }
      });

      documentUrls = await Promise.all(uploadPromises);
    }

    // Deep sanitize data to prevent any File object or unsupported value from crashing Firestore
    const sanitizeForFirestore = (obj: any): any => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj !== 'object') return obj;

      // Preserve Firestore FieldValue and Sentinel (e.g. serverTimestamp) & Dates
      if (obj instanceof Date) return obj;
      if (
        obj._methodName ||
        (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'ServerTimestampTransform')) ||
        typeof obj.toMillis === 'function'
      ) {
        return obj;
      }

      // Detect File or Blob using multiple robust checks (cross-realm / prototype-safe)
      const isFileOrBlob =
        (typeof File !== 'undefined' && obj instanceof File) ||
        (typeof Blob !== 'undefined' && obj instanceof Blob) ||
        obj?.constructor?.name === 'File' ||
        obj?.constructor?.name === 'Blob' ||
        Object.prototype.toString.call(obj) === '[object File]' ||
        Object.prototype.toString.call(obj) === '[object Blob]' ||
        (typeof obj.name === 'string' && typeof obj.size === 'number' && (typeof obj.slice === 'function' || obj.lastModified !== undefined));

      if (isFileOrBlob) {
        return {
          name: obj.name || 'file',
          size: obj.size || 0,
          type: obj.type || ''
        };
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
      }

      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue;
        // Strip custom File property (such as .file on UploadedFile)
        if (k === 'file' && (
          (typeof File !== 'undefined' && v instanceof File) ||
          v?.constructor?.name === 'File' ||
          Object.prototype.toString.call(v) === '[object File]'
        )) {
          continue;
        }
        clean[k] = sanitizeForFirestore(v);
      }
      return clean;
    };

    // Prepare request data with only links (no base64, no sensitive data)
    const requestData = {
      ...request,
      id: requestRef.id,
      data: sanitizeForFirestore(request.data),
      documents: documentUrls, // Only URLs and metadata - no base64 data
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Fully sanitize the whole payload before passing to setDoc to guarantee zero unsupported field errors
    const safeRequestData = sanitizeForFirestore(requestData);

    // Debug: Calculate document size before saving
    const documentSize = calculateDocumentSize(safeRequestData);
    const maxSize = 1024 * 1024; // 1 MB limit

    if (documentSize > maxSize) {
      logger.warn(`Document size (${(documentSize / 1024).toFixed(2)} KB) is large. Consider splitting data.`);
      // Still save, but log warning
    }

    logger.log(`Saving document with size: ${(documentSize / 1024).toFixed(2)} KB`);

    // Save request - only links, no base64, optimized and secure
    await setDoc(requestRef, safeRequestData);
    void incrementPlatformRequestsCount();

    const svcName =
      SERVICES.find((s) => s.id === String(request.serviceId))?.nameAr || `خدمة #${request.serviceId}`;
    const rawAmt =
      request.data?.price ??
      request.data?.totalPrice ??
      request.data?.amount ??
      request.data?.cost ??
      request.data?.fees;
    const parsedRev = rawAmt ? parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0 : 0;
    PlatformTelemetryEmitter.emit({
      kind: parsedRev > 0 ? 'service_sale' : 'service_traffic',
      serviceId: String(request.serviceId),
      serviceName: svcName,
      count: 1,
      revenue: parsedRev,
      tokenUnits: 10,
      source: 'service_request_submit',
      category: 'service',
      actionName: 'SERVICE_REQUEST_SUBMITTED',
      actorUid: request.studentId || 'student',
      logMessage: `New request on "${svcName}"${parsedRev > 0 ? ` (${parsedRev} EGP)` : ''}`
    });
    if (String(request.serviceId) === '1' && request.studentId) {
      try {
        await setDoc(
          doc(db, 'students', request.studentId),
          { routeRegistrationCompleted: true, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        logger.error('routeRegistrationCompleted update failed', e);
      }
    }

    // إرسال إشعار واتساب تلقائي عند تقديم طلب جديد
    try {
      const rd = request.data || {};
      const whatsappNumber = rd.whatsapp_number || rd.phone_whatsapp || '';
      const studentName = rd.full_name_arabic || rd.full_name || '';
      const nationalID = rd.national_id || '';
      triggerWhatsAppNotification(requestRef.id, request.serviceId, request.status || 'pending', {
        whatsappNumber,
        studentName,
        nationalID
      });
    } catch (e) {
      logger.error('Error triggering WhatsApp notification on request creation:', e);
    }

    return requestRef.id;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء إضافة الطلب');
  }
};

export const getServiceRequests = async (studentId?: string): Promise<ServiceRequest[]> => {
  try {
    let q;
    if (studentId) {
      q = query(collection(db, 'serviceRequests'), where('studentId', '==', studentId));
    } else {
      q = query(collection(db, 'serviceRequests'));
    }

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as ServiceRequest;
    });
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب الطلبات');
  }
};

// Real-time listener for service requests
export const subscribeToServiceRequests = (
  studentId: string | null,
  callback: (requests: ServiceRequest[]) => void
): (() => void) => {
  // Subscribe to all service collections and merge results
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const unsubscribes: (() => void)[] = [];
  const requestsByService = new Map<string, ServiceRequest[]>();
  const loadedServices = new Set<string>();
  let initialLoadComplete = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const flushCallback = () => {
    const merged: ServiceRequest[] = [];
    requestsByService.forEach(reqs => merged.push(...reqs));
    callback(merged);
  };

  serviceIds.forEach(serviceId => {
    const collectionName = `serviceRequests_${serviceId}`;
    let q;
    if (studentId) {
      q = query(collection(db, collectionName), where('studentId', '==', studentId));
    } else {
      q = query(collection(db, collectionName));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: ServiceRequest[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as ServiceRequest;
      });

      requestsByService.set(serviceId, requests);
      loadedServices.add(serviceId);

      if (!initialLoadComplete) {
        if (loadedServices.size === serviceIds.length) {
          initialLoadComplete = true;
          flushCallback();
        }
      } else {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushCallback, 50);
      }
    }, (error) => {
      logger.error(`Error in service requests subscription for ${serviceId}:`, error);
      loadedServices.add(serviceId);
      if (!initialLoadComplete && loadedServices.size === serviceIds.length) {
        initialLoadComplete = true;
        flushCallback();
      }
    });

    unsubscribes.push(unsubscribe);
  });

  // Return function to unsubscribe from all
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribes.forEach(unsub => unsub());
  };
};

// Admin Functions
export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  const role = await checkAdminRole(userId);
  return role === 'primary_admin';
};

export const getAllServiceRequests = async (): Promise<ServiceRequest[]> => {
  try {
    const q = query(collection(db, 'serviceRequests'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as ServiceRequest;
    });
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب الطلبات');
  }
};

export const subscribeToAllServiceRequests = (
  callback: (requests: ServiceRequest[]) => void
): (() => void) => {
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const unsubscribes: (() => void)[] = [];
  const requestsByService = new Map<string, ServiceRequest[]>();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const flushCallback = () => {
    const merged: ServiceRequest[] = [];
    requestsByService.forEach(reqs => merged.push(...reqs));
    callback(merged);
  };

  const scheduleFlush = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    /** دمج تحديثات الـ 11 مجموعة في أقل عدد ممكن من إعادة الرسم */
    debounceTimer = setTimeout(flushCallback, 8);
  };

  serviceIds.forEach(serviceId => {
    const collectionName = `serviceRequests_${serviceId}`;
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: ServiceRequest[] = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as ServiceRequest;
      });
      requestsByService.set(serviceId, requests);
      scheduleFlush();
    }, (error) => {
      logger.error(`Error in service requests subscription for ${serviceId}:`, error);
      // لا نمسح البيانات عند الخطأ - نحتفظ بالبيانات السابقة لتجنب اختفاء الطلبات
      if (!requestsByService.has(serviceId)) {
        requestsByService.set(serviceId, []);
      }
      scheduleFlush();
    });

    unsubscribes.push(unsubscribe);
  });

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubscribes.forEach(unsub => unsub());
  };
};

/** حساب العدد الكلي الفعلي لطلبات خدمة معينة دون تنزيل المستندات */
export const getServiceRequestsCount = async (serviceId: string): Promise<number> => {
  try {
    const collectionName = `serviceRequests_${serviceId}`;
    const snapshot = await getCountFromServer(query(collection(db, collectionName)));
    return snapshot.data().count;
  } catch (error: any) {
    logger.error(`getServiceRequestsCount for service ${serviceId}:`, error);
    return 0;
  }
};

/** جلب صفحة من طلبات خدمة معينة مرتبة حسب أحدث تاريخ للتحميل التدريجي */
export const fetchServiceRequestsPage = async (
  serviceId: string,
  pageSize: number = 50,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null
): Promise<{
  requests: ServiceRequest[];
  lastSnapshot: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> => {
  try {
    const collectionName = `serviceRequests_${serviceId}`;
    const coll = collection(db, collectionName);
    const q = lastDoc
      ? query(coll, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize))
      : query(coll, orderBy('createdAt', 'desc'), limit(pageSize));
    const snap = await getDocs(q);
    const requests: ServiceRequest[] = snap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as ServiceRequest;
    });
    const lastSnapshot = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    const hasMore = snap.docs.length === pageSize;
    return { requests, lastSnapshot, hasMore };
  } catch (error: any) {
    logger.error(`fetchServiceRequestsPage for service ${serviceId}:`, error);
    return { requests: [], lastSnapshot: null, hasMore: false };
  }
};

/** حساب إجمالي وطلبات الانتظار لكل خدمة بدون تنزيل المستندات */
export const getAllServicesCountsSummary = async (): Promise<
  Record<string, { pending: number; total: number }>
> => {
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const summary: Record<string, { pending: number; total: number }> = {};

  await Promise.all(
    serviceIds.map(async (serviceId) => {
      const coll = collection(db, `serviceRequests_${serviceId}`);
      try {
        const [totalSnap, pendingSnap] = await Promise.all([
          getCountFromServer(query(coll)),
          getCountFromServer(query(coll, where('status', '==', 'pending')))
        ]);
        summary[serviceId] = {
          total: totalSnap.data().count,
          pending: pendingSnap.data().count
        };
      } catch (err) {
        logger.error(`getAllServicesCountsSummary error for service ${serviceId}:`, err);
        summary[serviceId] = { total: 0, pending: 0 };
      }
    })
  );

  return summary;
};

/** اشتراك محدود بأحدث N طلب لخدمة واحدة فقط بدل تحميل كل المجموعات */
export const subscribeToServiceRequestsPageLimited = (
  serviceId: string,
  pageSize: number = 50,
  onUpdate: (
    requests: ServiceRequest[],
    lastSnapshot: QueryDocumentSnapshot<DocumentData> | null,
    hasMore: boolean
  ) => void
): (() => void) => {
  const collectionName = `serviceRequests_${serviceId}`;
  const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(pageSize));
  return onSnapshot(
    q,
    (snap) => {
      const requests: ServiceRequest[] = snap.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as ServiceRequest;
      });
      const lastSnapshot = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      const hasMore = snap.docs.length === pageSize;
      onUpdate(requests, lastSnapshot, hasMore);
    },
    (error) => {
      logger.error(`Error in limited subscription for service ${serviceId}:`, error);
      onUpdate([], null, false);
    }
  );
};

/** جلب كافة طلبات خدمة واحدة عند الطلب (للبحث الشامل أو التصدير) */
export const fetchAllServiceRequestsForService = async (
  serviceId: string
): Promise<ServiceRequest[]> => {
  try {
    const q = query(collection(db, `serviceRequests_${serviceId}`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as ServiceRequest;
    });
  } catch (error: any) {
    logger.error(`fetchAllServiceRequestsForService error for ${serviceId}:`, error);
    return [];
  }
};

/** جلب كافة الطلبات عبر كل الخدمات لمرة واحدة عند طلب الإحصائيات الكاملة */
export const fetchAllServicesRequestsOnce = async (): Promise<ServiceRequest[]> => {
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const pages = await Promise.all(serviceIds.map((id) => fetchAllServiceRequestsForService(id)));
  return pages.flat();
};

export const updateServiceRequestStatus = async (
  requestId: string,
  status: ServiceRequestWorkflowStatus,
  serviceId: string
): Promise<void> => {
  try {
    const collectionName = `serviceRequests_${serviceId}`;
    await setDoc(
      doc(db, collectionName, requestId),
      {
        status,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    if (status === 'completed') {
      const svcName = SERVICES.find((s) => s.id === String(serviceId))?.nameAr || `خدمة #${serviceId}`;
      PlatformTelemetryEmitter.emit({
        kind: 'service_sale',
        serviceId: String(serviceId),
        serviceName: svcName,
        count: 1,
        revenue: 0,
        tokenUnits: 5,
        source: 'admin_status_complete',
        category: 'service',
        actionName: 'SERVICE_ORDER_COMPLETED',
        logMessage: `Request ${requestId} on "${svcName}" marked completed`
      });
    }
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث حالة الطلب');
  }
};

export const updateServiceRequestData = async (
  requestId: string,
  serviceId: string,
  data: any
): Promise<void> => {
  try {
    const collectionName = `serviceRequests_${serviceId}`;
    await setDoc(
      doc(db, collectionName, requestId),
      {
        data,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث بيانات الطلب');
  }
};

export const deleteServiceRequest = async (
  requestId: string,
  serviceId: string
): Promise<void> => {
  try {
    const collectionName = `serviceRequests_${serviceId}`;
    await deleteDoc(doc(db, collectionName, requestId));
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء حذف الطلب');
  }
};

/**
 * تنظيف وحذف الطلبات المكتملة فقط التي مر عليها أكثر من 3 أشهر من الفايرستور،
 * دون المساس بحسابات الطلاب إطلاقاً (Students remain 100% untouched).
 * يستخدم Batched Writes (500 حذف في كل دفعة) مع yield بين الدفعات لتفادي التجميد.
 */
export const cleanOldCompletedRequests = async (): Promise<{ deletedCount: number }> => {
  // Helper: yield to browser event loop so UI doesn't freeze
  const yieldToMain = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  try {
    const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const threeMonthsAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const serviceId of serviceIds) {
      const collectionName = `serviceRequests_${serviceId}`;
      const coll = collection(db, collectionName);
      const q = query(coll, where('status', '==', 'completed'));

      // Yield before each network call so the browser stays responsive
      await yieldToMain();
      const snap = await getDocs(q);

      const docsToDelete: any[] = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const createdVal = data.createdAt;
        let createdMs = 0;
        if (createdVal?.toDate && typeof createdVal.toDate === 'function') {
          createdMs = createdVal.toDate().getTime();
        } else if (typeof createdVal?.seconds === 'number') {
          createdMs = createdVal.seconds * 1000;
        } else if (createdVal) {
          const d = new Date(createdVal);
          createdMs = isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if (createdMs > 0 && createdMs < threeMonthsAgoMs) {
          docsToDelete.push(docSnap);
        }
      });

      // Delete in batches of 500 (Firestore limit per batch)
      const BATCH_SIZE = 500;
      for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
        const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await yieldToMain(); // yield before committing each batch
        await batch.commit();
        deletedCount += chunk.length;
        await yieldToMain(); // yield after committing so UI can repaint
      }
    }

    logger.log(`cleanOldCompletedRequests: Successfully deleted ${deletedCount} completed requests older than 3 months.`);
    return { deletedCount };
  } catch (error: any) {
    logger.error('Error cleaning old completed requests:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تنظيف الطلبات القديمة المكتملة');
  }
};

// Book Service Configuration
export const getBookServiceConfig = async (): Promise<BookServiceConfig | null> => {
  try {
    const docRef = doc(db, 'config', 'bookService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as BookServiceConfig;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات الكتب');
  }
};

export const updateBookServiceConfig = async (config: BookServiceConfig): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'config', 'bookService'),
      {
        ...config,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات الكتب');
  }
};

// ============================================
// Shared Service Config Cache & Listener Manager
// يمنع تكرار الاشتراكات والاستعلامات لنفس الإعدادات ويحفظها في الذاكرة
// ============================================
const sharedConfigCache = new Map<string, any>();
const sharedConfigListeners = new Map<string, Set<(data: any) => void>>();
const sharedConfigUnsubscribes = new Map<string, () => void>();

function subscribeToSharedConfig<T>(
  docId: string,
  onUpdate: (data: T | null) => void,
  transform?: (data: any) => T
): () => void {
  // إذا كانت القيمة مخزنة في الذاكرة نسلمها فوراً للمكون بدون أي ريكويست وبسرعة 0 مللي ثانية
  if (sharedConfigCache.has(docId)) {
    const cached = sharedConfigCache.get(docId);
    onUpdate(cached ? (transform ? transform(cached) : cached) : null);
  }

  if (!sharedConfigListeners.has(docId)) {
    sharedConfigListeners.set(docId, new Set());
  }
  const listeners = sharedConfigListeners.get(docId)!;
  listeners.add(onUpdate);

  // إذا لم يكن هناك استماع مفتوح للوثيقة، نفتح استماعاً واحداً مشتركاً فقط
  if (!sharedConfigUnsubscribes.has(docId)) {
    const docRef = doc(db, 'config', docId);
    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        const rawData = docSnap.exists() ? docSnap.data() : null;
        sharedConfigCache.set(docId, rawData);
        const transformed = rawData ? (transform ? transform(rawData) : rawData) : null;
        listeners.forEach((listener) => {
          try {
            listener(transformed);
          } catch (e) {
            logger.error(`Error in ${docId} config listener callback:`, e);
          }
        });
      },
      (error) => {
        logger.error(`Error in shared config subscription for ${docId}:`, error);
      }
    );
    sharedConfigUnsubscribes.set(docId, unsub);
  }

  return () => {
    listeners.delete(onUpdate);
  };
}

export const subscribeToBookServiceConfig = (
  onUpdate: (config: BookServiceConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<BookServiceConfig>('bookService', onUpdate);
};

// Fees Service Configuration
export const getFeesServiceConfig = async (): Promise<FeesServiceConfig | null> => {
  try {
    const docRef = doc(db, 'config', 'feesService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as FeesServiceConfig;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات المصروفات');
  }
};

export const updateFeesServiceConfig = async (config: FeesServiceConfig): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'config', 'feesService'),
      {
        ...config,
        updatedAt: serverTimestamp()
      },
      { merge: false }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات المصروفات');
  }
};

export const subscribeToFeesServiceConfig = (
  onUpdate: (config: FeesServiceConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<FeesServiceConfig>('feesService', onUpdate);
};

// Assignments Service Configuration
export const getAssignmentsServiceConfig = async (): Promise<AssignmentsServiceConfig | null> => {
  try {
    const docRef = doc(db, 'config', 'assignmentsService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AssignmentsServiceConfig;
    }
    return null;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات التكليفات');
  }
};

export const updateAssignmentsServiceConfig = async (config: AssignmentsServiceConfig): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'config', 'assignmentsService'),
      {
        ...config,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات التكليفات');
  }
};

export const subscribeToAssignmentsServiceConfig = (
  onUpdate: (config: AssignmentsServiceConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<AssignmentsServiceConfig>('assignmentsService', onUpdate);
};

// Certificates Service Configuration
export const getCertificatesServiceConfig = async (): Promise<CertificatesServiceConfig | null> => {
  try {
    logger.log('Fetching certificates config from Firebase...');
    const docRef = doc(db, 'config', 'certificatesService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as CertificatesServiceConfig;
      logger.log('Certificates config loaded:', {
        hasCertificates: !!data.certificates,
        certificatesCount: data.certificates?.length || 0,
        certificates: data.certificates?.map(c => ({
          id: c.id,
          name: c.name,
          hasImage: !!c.imageUrl,
          imageLength: c.imageUrl?.length || 0
        }))
      });
      return data;
    } else {
      logger.log('Certificates config document does not exist');
      return null;
    }
  } catch (error: any) {
    logger.error('Error fetching certificates config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات الشهادات');
  }
};

export const updateCertificatesServiceConfig = async (config: CertificatesServiceConfig): Promise<void> => {
  try {
    // Clean the config to remove undefined values
    const cleanConfig = {
      certificates: config.certificates.map(c => ({
        id: c.id,
        name: c.name,
        price: c.price,
        imageUrl: c.imageUrl || '',
        description: c.description || '',
        fields: c.fields || []
      })),
      paymentMethods: config.paymentMethods
    };

    logger.log('Saving certificates config to Firebase:', {
      hasCertificates: !!cleanConfig.certificates,
      certificatesCount: cleanConfig.certificates?.length || 0,
      certificates: cleanConfig.certificates?.map(c => ({
        id: c.id,
        name: c.name,
        hasImage: !!c.imageUrl,
        imageLength: c.imageUrl?.length || 0
      }))
    });

    await setDoc(
      doc(db, 'config', 'certificatesService'),
      {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      },
      { merge: false } // استخدام merge: false للتأكد من الكتابة الكاملة
    );

    logger.log('Certificates config saved to Firebase successfully');
  } catch (error: any) {
    logger.error('Error saving certificates config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات الشهادات');
  }
};

export const subscribeToCertificatesServiceConfig = (
  onUpdate: (config: CertificatesServiceConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<CertificatesServiceConfig>('certificatesService', onUpdate);
};

// Digital Transformation Service Configuration
export const getDigitalTransformationConfig = async (): Promise<DigitalTransformationConfig | null> => {
  try {
    logger.log('Fetching digital transformation config from Firebase...');
    const docRef = doc(db, 'config', 'digitalTransformationService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      // Handle backward compatibility: convert string examLanguage to array
      const config: DigitalTransformationConfig = {
        ...data,
        examLanguage: Array.isArray(data.examLanguage)
          ? data.examLanguage
          : (data.examLanguage ? [data.examLanguage] : [])
      };
      logger.log('Digital transformation config loaded:', {
        hasTypes: !!config.transformationTypes,
        typesCount: config.transformationTypes?.length || 0,
        languagesCount: config.examLanguage?.length || 0
      });
      return config;
    } else {
      logger.log('Digital transformation config document does not exist');
      return null;
    }
  } catch (error: any) {
    logger.error('Error fetching digital transformation config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات التحول الرقمي');
  }
};

export const updateDigitalTransformationConfig = async (config: DigitalTransformationConfig): Promise<void> => {
  try {
    // Clean the config to remove undefined values
    const cleanConfig = {
      transformationTypes: config.transformationTypes.map(t => ({
        id: t.id,
        name: t.name || '',
        price: t.price || 0
      })),
      examLanguage: Array.isArray(config.examLanguage) ? config.examLanguage : (config.examLanguage ? [config.examLanguage] : []),
      paymentMethods: config.paymentMethods
    };

    logger.log('Saving digital transformation config to Firebase:', {
      hasTypes: !!cleanConfig.transformationTypes,
      typesCount: cleanConfig.transformationTypes?.length || 0,
      languagesCount: cleanConfig.examLanguage?.length || 0
    });

    await setDoc(
      doc(db, 'config', 'digitalTransformationService'),
      {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    logger.log('Digital transformation config saved to Firebase successfully');
  } catch (error: any) {
    logger.error('Error saving digital transformation config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات التحول الرقمي');
  }
};

export const subscribeToDigitalTransformationConfig = (
  onUpdate: (config: DigitalTransformationConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<DigitalTransformationConfig>(
    'digitalTransformationService',
    onUpdate,
    (data) => ({
      ...data,
      examLanguage: Array.isArray(data.examLanguage)
        ? data.examLanguage
        : (data.examLanguage ? [data.examLanguage] : [])
    })
  );
};

// Final Review Service Configuration
export const getFinalReviewConfig = async (): Promise<FinalReviewConfig | null> => {
  try {
    logger.log('Fetching final review config from Firebase...');
    const docRef = doc(db, 'config', 'finalReviewService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as FinalReviewConfig;
      logger.log('Final review config loaded:', {
        serviceName: data.serviceName,
        paymentAmount: data.paymentAmount
      });
      return data;
    } else {
      logger.log('Final review config document does not exist');
      return null;
    }
  } catch (error: any) {
    logger.error('Error fetching final review config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات المراجعة النهائية');
  }
};

export const updateFinalReviewConfig = async (config: FinalReviewConfig): Promise<void> => {
  try {
    const cleanConfig = {
      serviceName: config.serviceName || 'المراجعة النهائية',
      paymentAmount: config.paymentAmount || 500,
      paymentMethods: config.paymentMethods
    };

    logger.log('Saving final review config to Firebase:', cleanConfig);

    await setDoc(
      doc(db, 'config', 'finalReviewService'),
      {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      },
      { merge: false }
    );

    logger.log('Final review config saved to Firebase successfully');
  } catch (error: any) {
    logger.error('Error saving final review config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات المراجعة النهائية');
  }
};

export const subscribeToFinalReviewConfig = (
  onUpdate: (config: FinalReviewConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<FinalReviewConfig>('finalReviewService', onUpdate);
};

// Statement and Enrollment Service Configuration (Service 12)
export const getStatementEnrollmentConfig = async (): Promise<StatementEnrollmentConfig | null> => {
  try {
    logger.log('Fetching statement & enrollment config from Firebase...');
    const docRef = doc(db, 'config', 'statementEnrollmentService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as StatementEnrollmentConfig;
      return data;
    } else {
      return null;
    }
  } catch (error: any) {
    logger.error('Error fetching statement & enrollment config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات إفادة وإثبات قيد');
  }
};

export const updateStatementEnrollmentConfig = async (config: StatementEnrollmentConfig): Promise<void> => {
  try {
    const cleanConfig = {
      serviceName: config.serviceName || 'التقديم علي افادة و اثبات قيد',
      paymentAmount: config.paymentAmount || 400,
      paymentMethods: config.paymentMethods
    };

    logger.log('Saving statement & enrollment config to Firebase:', cleanConfig);

    await setDoc(
      doc(db, 'config', 'statementEnrollmentService'),
      {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      },
      { merge: false }
    );

    logger.log('Statement & enrollment config saved to Firebase successfully');
  } catch (error: any) {
    logger.error('Error saving statement & enrollment config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات إفادة وإثبات قيد');
  }
};

export const subscribeToStatementEnrollmentConfig = (
  onUpdate: (config: StatementEnrollmentConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<StatementEnrollmentConfig>('statementEnrollmentService', onUpdate);
};

// Graduation Project Service Configuration
export const getGraduationProjectConfig = async (): Promise<GraduationProjectConfig | null> => {
  try {
    logger.log('Fetching graduation project config from Firebase...');
    const docRef = doc(db, 'config', 'graduationProjectService');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as GraduationProjectConfig;
      logger.log('Graduation project config loaded:', {
        serviceName: data.serviceName,
        featuresCount: data.features?.length || 0
      });
      return data;
    } else {
      logger.log('Graduation project config document does not exist');
      return null;
    }
  } catch (error: any) {
    logger.error('Error fetching graduation project config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب إعدادات مشروع التخرج');
  }
};

export const updateGraduationProjectConfig = async (config: GraduationProjectConfig): Promise<void> => {
  try {
    const cleanConfig = {
      serviceName: config.serviceName || 'مشروع التخرج',
      features: config.features || [],
      prices: config.prices || [],
      paymentMethods: config.paymentMethods
    };

    logger.log('Saving graduation project config to Firebase:', cleanConfig);

    await setDoc(
      doc(db, 'config', 'graduationProjectService'),
      {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      },
      { merge: false }
    );

    logger.log('Graduation project config saved to Firebase successfully');
  } catch (error: any) {
    logger.error('Error saving graduation project config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات مشروع التخرج');
  }
};

export const subscribeToGraduationProjectConfig = (
  onUpdate: (config: GraduationProjectConfig | null) => void
): (() => void) => {
  return subscribeToSharedConfig<GraduationProjectConfig>('graduationProjectService', onUpdate);
};

// Save Digital Transformation Code
export const saveDigitalTransformationCode = async (data: any): Promise<void> => {
  try {
    const collectionRef = collection(db, 'digitalTransformationCodes');

    // Check if doc exists for this requestId
    if (data.requestId) {
      const q = query(collectionRef, where('requestId', '==', data.requestId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Update existing document
        const existingDoc = snapshot.docs[0];
        await setDoc(existingDoc.ref, {
          ...data,
          updatedAt: serverTimestamp()
        }, { merge: true });
        logger.log('Digital transformation code updated successfully');
        return;
      }
    }

    // Create new document if none exists
    const docRef = doc(collectionRef);
    await setDoc(docRef, {
      ...data,
      id: docRef.id,
      updatedAt: serverTimestamp()
    });

    logger.log('Digital transformation code saved successfully');
  } catch (error: any) {
    logger.error('Error saving digital transformation code:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حفظ كود التحول الرقمي');
  }
};


// Get Digital Transformation Codes
export const getDigitalTransformationCodes = async (): Promise<any[]> => {
  try {
    const q = query(collection(db, 'digitalTransformationCodes'), orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error: any) {
    logger.error('Error fetching digital transformation codes:', error);
    return [];
  }
};

// Subscribe to Digital Transformation Codes (Real-time)
export const subscribeToDigitalTransformationCodes = (
  onUpdate: (codes: any[]) => void,
  onError?: (error: any) => void
) => {
  try {
    const q = query(
      collection(db, 'digitalTransformationCodes'),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const codes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        onUpdate(codes);
      },
      (error) => {
        logger.error('Error subscribing to digital transformation codes:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    logger.error('Error setting up subscription:', error);
    if (onError) onError(error);
    return () => { };
  }
};

/**
 * اشتراك ذكي ومحدد في أكواد التحول الرقمي والدفع الإلكتروني لطلبات طالب معين فقط
 * يوفر أكثر من 99% من قراءات الفايربيز ويمنع تحميل آلاف الأكواد العامة لكل طالب
 */
export const subscribeToCodesForRequests = (
  requestIds: string[],
  onUpdate: (dtCodes: any[], epCodes: any[]) => void
): (() => void) => {
  if (!requestIds || requestIds.length === 0) {
    onUpdate([], []);
    return () => { };
  }

  // فايربيز تدعم حتى 30 عنصراً في استعلام in
  const safeIds = Array.from(new Set(requestIds.filter(Boolean))).slice(0, 30);
  if (safeIds.length === 0) {
    onUpdate([], []);
    return () => { };
  }

  const qDt = query(
    collection(db, 'digitalTransformationCodes'),
    where('requestId', 'in', safeIds)
  );

  const qEp = query(
    collection(db, 'electronicPaymentCodes'),
    where('requestId', 'in', safeIds)
  );

  let currentDt: any[] = [];
  let currentEp: any[] = [];

  const unsubDt = onSnapshot(
    qDt,
    (snap) => {
      currentDt = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onUpdate(currentDt, currentEp);
    },
    (err) => logger.warn('Error subscribing to student DT codes:', err)
  );

  const unsubEp = onSnapshot(
    qEp,
    (snap) => {
      currentEp = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onUpdate(currentDt, currentEp);
    },
    (err) => logger.warn('Error subscribing to student EP codes:', err)
  );

  return () => {
    unsubDt();
    unsubEp();
  };
};

/**
 * تحسين رابط الصورة المرفوعة من Cloudinary تلقائياً ليناسب شاشات الموبايل
 * يقلل الحجم بنسبة 80% مع جودة وسرعة تحميل فائقة
 */
export const getOptimizedImageUrl = (url: string | undefined | null, maxWidth = 1000): string => {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('cloudinary.com') || url.includes('.pdf') || url.includes('/raw/')) {
    return url;
  }
  const uploadIndex = url.indexOf('/image/upload/');
  if (uploadIndex === -1) return url;

  const prefix = url.substring(0, uploadIndex + 14);
  let rest = url.substring(uploadIndex + 14);

  // إزالة أي تحويلات سابقة مكررة
  rest = rest.replace(/^(c_limit[^/]*\/|w_\d+\/|q_auto[^/]*\/|f_auto\/)+/, '');

  return `${prefix}c_limit,w_${maxWidth},q_auto:good,f_auto/${rest}`;
};

// ============================================
// Electronic Payment Codes (أكواد الدفع الإلكتروني)
// ============================================

// Save Electronic Payment Code
export const saveElectronicPaymentCode = async (data: any): Promise<void> => {
  try {
    const collectionRef = collection(db, 'electronicPaymentCodes');

    // Check if doc exists for this requestId
    if (data.requestId) {
      const q = query(collectionRef, where('requestId', '==', data.requestId));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // Update existing document
        const existingDoc = snapshot.docs[0];
        await setDoc(existingDoc.ref, {
          ...data,
          updatedAt: serverTimestamp()
        }, { merge: true });
        logger.log('Electronic payment code updated successfully');
        return;
      }
    }

    // Create new document if none exists
    const docRef = doc(collectionRef);
    await setDoc(docRef, {
      ...data,
      id: docRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    logger.log('Electronic payment code saved successfully');
  } catch (error: any) {
    logger.error('Error saving electronic payment code:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حفظ كود الدفع الإلكتروني');
  }
};

// Get Electronic Payment Codes
export const getElectronicPaymentCodes = async (): Promise<any[]> => {
  try {
    const q = query(collection(db, 'electronicPaymentCodes'), orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error: any) {
    logger.error('Error fetching electronic payment codes:', error);
    return [];
  }
};

// Subscribe to Electronic Payment Codes (Real-time)
export const subscribeToElectronicPaymentCodes = (
  onUpdate: (codes: any[]) => void,
  onError?: (error: any) => void
) => {
  try {
    const q = query(
      collection(db, 'electronicPaymentCodes'),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const codes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        onUpdate(codes);
      },
      (error) => {
        logger.error('Error subscribing to electronic payment codes:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    logger.error('Error setting up subscription (electronic payment codes):', error);
    if (onError) onError(error);
    return () => { };
  }
};

export const deleteDigitalTransformationCode = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, 'digitalTransformationCodes', id);
    await deleteDoc(docRef);
    logger.log('Digital transformation code deleted successfully');
  } catch (error: any) {
    logger.error('Error deleting digital transformation code:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حذف كود التحول الرقمي');
  }
};

export const deleteElectronicPaymentCode = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, 'electronicPaymentCodes', id);
    await deleteDoc(docRef);
    logger.log('Electronic payment code deleted successfully');
  } catch (error: any) {
    logger.error('Error deleting electronic payment code:', error);
    throw new Error(error.message || 'حدث خطأ أثناء حذف كود الدفع الإلكتروني');
  }
};

// ============================================
// Latest News (أخر الأخبار)
// ============================================

export const getLatestNews = async (): Promise<{ content: string; updatedAt?: any } | null> => {
  try {
    const docRef = doc(db, 'config', 'latestNews');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as { content: string; updatedAt?: any };
    }
    return null;
  } catch (error: any) {
    logger.error('Error fetching latest news:', error);
    return null;
  }
};

export const updateLatestNews = async (content: string): Promise<void> => {
  try {
    const docRef = doc(db, 'config', 'latestNews');
    await setDoc(docRef, {
      content,
      updatedAt: serverTimestamp()
    }, { merge: true });
    logger.log('Latest news updated successfully');
  } catch (error: any) {
    logger.error('Error updating latest news:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث أخر الأخبار');
  }
};

export const sendQuickNotification = async (content: string): Promise<void> => {
  try {
    const docRef = doc(db, 'config', 'quickNotification');
    await setDoc(docRef, {
      content,
      timestamp: serverTimestamp(),
      id: Math.random().toString(36).substring(7) // To trigger change even if content is same
    }, { merge: true });
    logger.log('Quick notification sent successfully');
  } catch (error: any) {
    logger.error('Error sending quick notification:', error);
    throw new Error(error.message || 'حدث خطأ أثناء إرسال الرسالة السريعة');
  }
};

export const subscribeToQuickNotification = (
  onUpdate: (data: { content: string; timestamp?: any; id: string } | null) => void,
  onError?: (error: any) => void
) => {
  try {
    const docRef = doc(db, 'config', 'quickNotification');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as { content: string; timestamp?: any; id: string });
      } else {
        onUpdate(null);
      }
    }, (error) => {
      logger.error('Error subscribing to quick notification:', error);
      if (onError) onError(error);
    });
  } catch (error: any) {
    logger.error('Error in quick notification subscription:', error);
    if (onError) onError(error);
    return () => { };
  }
};

export const subscribeToLatestNews = (
  onUpdate: (news: { content: string; updatedAt?: any } | null) => void,
  onError?: (error: any) => void
) => {
  try {
    const docRef = doc(db, 'config', 'latestNews');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as { content: string; updatedAt?: any });
      } else {
        onUpdate(null);
      }
    }, (error) => {
      logger.error('Error subscribing to latest news:', error);
      if (onError) onError(error);
    });
  } catch (error: any) {
    logger.error('Error in news subscription:', error);
    if (onError) onError(error);
    return () => { };
  }
};

// ============================================
// Service Settings (Enable/Disable Services)
// ============================================

// Clear Latest News (Stop Publishing)
export const clearLatestNews = async (): Promise<void> => {
  try {
    const docRef = doc(db, 'config', 'latestNews');
    await setDoc(docRef, {
      content: '',
      updatedAt: serverTimestamp()
    }, { merge: true });
    logger.log('Latest news cleared successfully');
  } catch (error: any) {
    logger.error('Error clearing latest news:', error);
    throw new Error(error.message || 'حدث خطأ أثناء إيقاف نشر الأخبار');
  }
};

// Clear Quick Notification (Stop Publishing)
export const clearQuickNotification = async (): Promise<void> => {
  try {
    const docRef = doc(db, 'config', 'quickNotification');
    await setDoc(docRef, {
      content: '',
      timestamp: serverTimestamp(),
      id: ''
    }, { merge: true });
    logger.log('Quick notification cleared successfully');
  } catch (error: any) {
    logger.error('Error clearing quick notification:', error);
    throw new Error(error.message || 'حدث خطأ أثناء إيقاف الرسائل السريعة');
  }
};

export const getServiceSettings = async (): Promise<ServiceSettings> => {
  try {
    const docRef = doc(db, 'config', 'services');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as ServiceSettings;
    }
    return {};
  } catch (error: any) {
    logger.error('Error fetching service settings:', error);
    return {};
  }
};

export const updateServiceSettings = async (settings: ServiceSettings): Promise<void> => {
  try {
    const docRef = doc(db, 'config', 'services');
    await setDoc(docRef, settings, { merge: true });
    logger.log('Service settings updated successfully');
  } catch (error: any) {
    logger.error('Error updating service settings:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات الخدمات');
  }
};

export const subscribeToServiceSettings = (
  onUpdate: (settings: ServiceSettings) => void,
  onError?: (error: any) => void
) => {
  try {
    const docRef = doc(db, 'config', 'services');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as ServiceSettings);
      } else {
        onUpdate({});
      }
    }, (error) => {
      logger.error('Error subscribing to service settings:', error);
      if (onError) onError(error);
    });
  } catch (error: any) {
    logger.error('Error in service settings subscription:', error);
    if (onError) onError(error);
    return () => { };
  }
};

/**
 * إحصائيات المنصة الحية (المشتركين والطلبات)
 */
export interface PlatformStatsData {
  totalStudents: number;
  totalRequests: number;
}

export const subscribeToPlatformStats = (
  callback: (stats: PlatformStatsData) => void
): (() => void) => {
  try {
    const statsDocRef = doc(db, 'configs', 'platformStats');
    return onSnapshot(
      statsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          callback({
            totalStudents: Number(data.totalStudents || 0),
            totalRequests: Number(data.totalRequests || 0)
          });
        } else {
          callback({ totalStudents: 0, totalRequests: 0 });
        }
      },
      (error) => {
        logger.warn('subscribeToPlatformStats notice:', error?.message);
      }
    );
  } catch (error) {
    logger.warn('subscribeToPlatformStats error:', error);
    return () => {};
  }
};

export const incrementPlatformRequestsCount = async (): Promise<void> => {
  try {
    const statsDocRef = doc(db, 'configs', 'platformStats');
    await setDoc(
      statsDocRef,
      {
        totalRequests: increment(1),
        lastRequestAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e: any) {
    logger.warn('incrementPlatformRequestsCount notice:', e?.message);
  }
};

export const incrementPlatformStudentsCount = async (): Promise<void> => {
  try {
    const statsDocRef = doc(db, 'configs', 'platformStats');
    await setDoc(
      statsDocRef,
      {
        totalStudents: increment(1),
        lastStudentAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e: any) {
    logger.warn('incrementPlatformStudentsCount notice:', e?.message);
  }
};

