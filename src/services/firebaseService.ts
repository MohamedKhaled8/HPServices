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
  writeBatch
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { auth, db, storage, firebaseConfig } from '../config/firebase';
import { supabase, ASSIGNMENTS_BUCKET } from '../config/supabaseClient';
import { CLOUDINARY_CONFIG, UPLOAD_PRESET } from '../config/cloudinary';
import { uploadMultipleToCloudStorage, CloudProvider } from './cloudStorageService';
import { StudentData, ServiceRequest, UploadedFile, BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig, DigitalTransformationConfig, FinalReviewConfig, GraduationProjectConfig, AssignedFile, ServiceSettings } from '../types';
import { logger } from '../utils/logger';
import { checkRateLimit } from '../utils/security';

const MAX_FILE_SIZE_MB = 10; // Max 10MB per file
const MAX_DOC_SIZE_KB = 1024; // 1MB Firestore doc limit warning

export type TrackKey = 'track1' | 'track2' | 'track3';

interface AssignmentFileMeta {
  id: string;
  name: string;
  url: string;
  track: TrackKey;
  storagePath: string;
  uploadedAt?: any;
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
      // Security: Password is NOT stored here anymore (Managed by Firebase Auth)
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'students', user.uid), studentDataWithId);

    return user;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء التسجيل');
  }
};

export const getStudentEmailByNationalID = async (nationalID: string): Promise<string | null> => {
  try {
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('nationalID', '==', nationalID));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data().email;
    }
    return null;
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
    let email = identifier;

    // Check if input is a 14-digit National ID
    if (/^\d{14}$/.test(identifier)) {
      const foundEmail = await getStudentEmailByNationalID(identifier);
      if (foundEmail) {
        email = foundEmail;
      } else {
        throw new Error('رقم الهوية غير مسجل في النظام');
      }
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    // تحسين رسائل الخطأ
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

    // 3. Update Firestore (Admin View)
    await updateStudentData(user.uid, { password: newPassword } as any);

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
const FIRESTORE_IN_LIMIT = 10;
export const getStudentsByIds = async (userIds: string[]): Promise<Record<string, StudentData>> => {
  const result: Record<string, StudentData> = {};
  if (userIds.length === 0) return result;
  try {
    for (let i = 0; i < userIds.length; i += FIRESTORE_IN_LIMIT) {
      const chunk = userIds.slice(i, i + FIRESTORE_IN_LIMIT);
      const q = query(
        collection(db, 'students'),
        where(documentId(), 'in', chunk)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        result[docSnap.id] = {
          ...data,
          id: docSnap.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        } as StudentData;
      });
    }
    return result;
  } catch (error: any) {
    logger.error('Error getting students by ids:', error);
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

export const updateStudentData = async (userId: string, data: Partial<StudentData>): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'students', userId),
      {
        ...data,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء تحديث البيانات');
  }
};

export const deleteStudentData = async (userId: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // 1) حذف مستند الطالب الأساسي
    batch.delete(doc(db, 'students', userId));

    // 2) حذف جميع طلبات الخدمات الخاصة به من مجموعات serviceRequests_1..11
    const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
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
        uploadedAt: serverTimestamp()
      };

      await setDoc(fileDocRef, {
        ...meta,
        adminId,
        provider: result.provider, // 'google-drive' or 'mega'
        bucket: 'cloud-storage', // Placeholder
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
        uploadedAt: data.uploadedAt
      };
    });
  } catch (error: any) {
    logger.error('Error fetching assignment files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب ملفات التكاليف');
  }
};

export type ServiceTier = '500' | '300';

// Helper: Get student IDs who bought a specific assignment tier (by price) with accepted requests
const getStudentIdsByTier = async (tierPrice: number): Promise<Set<string>> => {
  const collectionName = `serviceRequests_5`; // Service 5 = assignments
  const requestsSnap = await getDocs(collection(db, collectionName));
  const studentIds = new Set<string>();

  requestsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    // Only include completed/accepted requests
    if (data.status !== 'completed') return;

    const selectedData = data.data?.selectedAssignmentsData || [];
    const hasThisTier = selectedData.some((a: any) => a.price === tierPrice);

    if (hasThisTier) {
      studentIds.add(data.studentId);
    }
  });

  return studentIds;
};

export const distributeAssignmentsForTrack = async (
  track: TrackKey,
  fileIds?: string[],
  serviceTier?: ServiceTier
): Promise<void> => {
  try {
    // 1) Get all files for this track (or only selected ones)
    let files = await getAssignmentFilesForTrack(track);
    if (fileIds && fileIds.length > 0) {
      const fileIdSet = new Set(fileIds);
      files = files.filter((f) => fileIdSet.has(f.id));
    }
    if (files.length === 0) {
      throw new Error('لا توجد ملفات مرفوعة لهذا المسار');
    }

    // 2) Get students filtered by tier (if specified) AND track
    const studentsRef = collection(db, 'students');
    const studentsSnap = await getDocs(studentsRef);
    let allStudentsInTrack: { id: string; data: StudentData }[] = [];

    studentsSnap.forEach((docSnap) => {
      const data = docSnap.data() as StudentData;
      const studentTrackKey = trackToKey(data.track || null);
      if (studentTrackKey === track) {
        allStudentsInTrack.push({ id: docSnap.id, data });
      }
    });

    let students = allStudentsInTrack;

    // If a tier is specified, filter by students who bought that tier
    if (serviceTier) {
      const tierPrice = serviceTier === '500' ? 500 : 300;
      const tierStudentIds = await getStudentIdsByTier(tierPrice);
      students = allStudentsInTrack.filter(s => tierStudentIds.has(s.id));
    }

    if (students.length === 0) {
      const tierLabel = serviceTier === '500' ? 'خدمة الـ 500' : serviceTier === '300' ? 'خدمة الـ 300' : 'هذا المسار';
      throw new Error(`لا يوجد طلاب مشتركين في ${tierLabel} في هذا المسار حالياً`);
    }

    // 3) Shuffle files randomly
    const shuffledFiles = [...files].sort(() => Math.random() - 0.5);

    // 4) Assign one file per student (allow reuse if files < students)
    let fileIndex = 0;
    for (const student of students) {
      const file = shuffledFiles[fileIndex];

      // Extract file extension from original file name
      const fileExtension = file.name.includes('.')
        ? file.name.substring(file.name.lastIndexOf('.'))
        : '';

      // Extract file name without extension for display
      const fileNameWithoutExt = file.name.includes('.')
        ? file.name.substring(0, file.name.lastIndexOf('.'))
        : file.name;

      // Create custom file name based on tier
      const studentName = (student.data.fullNameArabic || 'طالب').replace(/\s+/g, '_').replace(/[^\u0600-\u06FF\w.-]/g, '_');

      let customFileName: string;
      if (serviceTier === '300') {
        // 300 EGP: file title only (no student name)
        customFileName = file.name;
      } else {
        // 500 EGP (or no tier specified - backward compatible): student name + file title
        customFileName = `${studentName}_-_${fileNameWithoutExt}${fileExtension}`;
      }

      const assigned: AssignedFile = {
        id: file.id,
        name: file.name, // الاسم الأصلي للملف
        customName: customFileName, // الاسم المخصص حسب نوع الخدمة
        url: file.url,
        track,
        assignedAt: new Date().toISOString()
      };

      // Get existing assigned files or initialize empty array
      const existingFiles = student.data.assignedFiles || [];

      // Check if this file is already assigned (by ID) to avoid duplicates
      const isAlreadyAssigned = existingFiles.some(f => f.id === file.id);

      if (!isAlreadyAssigned) {
        // Add new file to the array
        const updatedFiles = [...existingFiles, assigned];

        await updateStudentData(student.id, {
          assignedFiles: updatedFiles,
          assignedFile: assigned // Keep last file for backward compatibility
        } as any);
      }

      fileIndex = (fileIndex + 1) % shuffledFiles.length;
    }
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
      uploadedAt: serverTimestamp()
    };

    await setDoc(fileDocRef, {
      ...meta,
      adminId,
      provider: result.provider,
      bucket: 'cloud-storage',
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
        uploadedAt: data.uploadedAt
      };
    });
  } catch (error: any) {
    logger.error('Error fetching 130 unified files:', error);
    throw new Error(error.message || 'حدث خطأ أثناء جلب الملفات الموحدة');
  }
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

export const distribute130UnifiedFiles = async (fileIds?: string[]): Promise<void> => {
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

    // 2) Get all students who bought the 130 tier
    const tierStudentIds = await getStudentIdsByTier(130);
    if (tierStudentIds.size === 0) {
      throw new Error('لا يوجد طلاب مشتركين في خدمة الـ 130 حالياً');
    }

    // 3) Get student data
    const studentsRef = collection(db, 'students');
    const studentsSnap = await getDocs(studentsRef);
    const students: { id: string; data: StudentData }[] = [];

    studentsSnap.forEach((docSnap) => {
      if (tierStudentIds.has(docSnap.id)) {
        students.push({ id: docSnap.id, data: docSnap.data() as StudentData });
      }
    });

    if (students.length === 0) {
      throw new Error('لا يوجد طلاب مشتركين في خدمة الـ 130 حالياً');
    }

    // 4) Send ALL files to ALL students (same file for everyone)
    for (const student of students) {
      const existingFiles = student.data.assignedFiles || [];

      let updatedFiles = [...existingFiles];
      let hasNewFiles = false;

      for (const file of files) {
        const isAlreadyAssigned = existingFiles.some(f => f.id === file.id);

        if (!isAlreadyAssigned) {
          const assigned: AssignedFile = {
            id: file.id,
            name: file.name,
            customName: file.name, // Same file for everyone, no custom naming
            url: file.url,
            track: 'track1' as any, // placeholder
            assignedAt: new Date().toISOString()
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
    }
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
    const studentsSnap = await getDocs(studentsRef);

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
    throw new Error('حدث خطأ أثناء حفظ التفضيلات');
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

// Search for a student by any field
export const searchStudent = async (searchTerm: string): Promise<StudentData[]> => {
  try {
    const studentsRef = collection(db, 'students');
    const allStudents: StudentData[] = [];

    // If search term is empty, return empty array
    if (!searchTerm.trim()) {
      return [];
    }

    // Get all students (Firestore doesn't support full-text search easily)
    const querySnapshot = await getDocs(studentsRef);

    // Check if search term is a number (for national ID or phone)
    const isNumeric = /^\d+$/.test(searchTerm);
    const isNationalID = isNumeric && searchTerm.length <= 14;
    const searchLower = searchTerm.toLowerCase();
    const searchTrimmed = searchTerm.trim();

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const student = {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      } as StudentData;

      let matches = false;

      // Search in all fields
      // 1. Full Name Arabic
      if (student.fullNameArabic && student.fullNameArabic.toLowerCase().includes(searchLower)) {
        matches = true;
      }

      // 2. Full Name English
      if (student.vehicleNameEnglish && student.vehicleNameEnglish.toLowerCase().includes(searchLower)) {
        matches = true;
      }

      // 3. Email
      if (student.email && student.email.toLowerCase().includes(searchLower)) {
        matches = true;
      }

      // 4. WhatsApp Number
      if (student.whatsappNumber && student.whatsappNumber.includes(searchTrimmed)) {
        matches = true;
      }

      // 5. National ID - special handling
      if (student.nationalID) {
        if (isNationalID) {
          // If search term is less than 14 digits, it must be a prefix
          if (searchTrimmed.length < 14) {
            if (student.nationalID.startsWith(searchTrimmed)) {
              matches = true;
            }
          } else if (searchTrimmed.length === 14) {
            // Exact match for 14 digits
            if (student.nationalID === searchTrimmed) {
              matches = true;
            }
          }
        } else {
          // If not numeric, search as text
          if (student.nationalID.includes(searchTrimmed)) {
            matches = true;
          }
        }
      }

      // 6. Diploma Type
      if (student.diplomaType && student.diplomaType.toLowerCase().includes(searchLower)) {
        matches = true;
      }



      // 8. Diploma Year
      if (student.diplomaYear && student.diplomaYear.includes(searchTrimmed)) {
        matches = true;
      }

      // 9. Course
      if (student.course && student.course.toLowerCase().includes(searchLower)) {
        matches = true;
      }

      // 10. Address fields
      if (student.address) {
        if (student.address.governorate && student.address.governorate.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.city && student.address.city.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.street && student.address.street.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.building && student.address.building.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.siteNumber && student.address.siteNumber.toLowerCase().includes(searchLower)) {
          matches = true;
        }
        if (student.address.landmark && student.address.landmark.toLowerCase().includes(searchLower)) {
          matches = true;
        }
      }

      if (matches) {
        allStudents.push(student);
      }
    });

    return allStudents;
  } catch (error: any) {
    throw new Error(error.message || 'حدث خطأ أثناء البحث');
  }
};

// Validate file type (images only for security)
const isValidImageType = (fileType: string): boolean => {
  const allowedTypes = ['JPEG', 'JPG', 'PNG', 'PDF', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF'];
  return allowedTypes.includes(fileType.toUpperCase());
};

// Calculate document size in bytes (for debugging)
const calculateDocumentSize = (obj: any): number => {
  return new Blob([JSON.stringify(obj)]).size;
};

// Upload file to Cloudinary using direct API call with optimizations
export const uploadFileToCloudinary = async (file: UploadedFile, studentId: string, serviceId: string): Promise<string> => {
  try {
    // Security: Validate file type (images only)
    if (!isValidImageType(file.type)) {
      throw new Error(`نوع الملف غير مدعوم. الصيغ المقبولة: JPEG, PNG, PDF`);
    }

    // Security: Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new Error(`حجم الملف كبير جداً. الحد الأقصى هو ${MAX_FILE_SIZE_MB} ميجابايت.`);
    }

    let fileToUpload: File | Blob;

    // If we have the actual file object, use it directly
    if (file.file) {
      fileToUpload = file.file;
    } else {
      // Otherwise, convert base64 to blob (fallback for old data)
      const response = await fetch(file.url);
      fileToUpload = await response.blob();
    }

    // Create a unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const publicId = `serviceRequests/${studentId}/${serviceId}/${timestamp}_${sanitizedFileName}`;

    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('upload_preset', UPLOAD_PRESET); // Unsigned preset - secure, no API secret needed
    formData.append('public_id', publicId);
    formData.append('folder', 'serviceRequests');

    // Note: eager and flags parameters are not allowed with unsigned upload preset
    // Transformations will be applied via URL parameters when serving images

    // Upload to Cloudinary using fetch
    const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || 'فشل رفع الملف إلى Cloudinary';
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Apply transformations via URL for images (not PDFs)
    // This allows optimization without using eager parameter (which is not allowed with unsigned preset)
    let optimizedUrl = data.secure_url;
    if (file.type.toUpperCase() !== 'PDF') {
      // Apply transformations via URL: auto format, auto quality, max width 1200px
      // Cloudinary URL format: https://res.cloudinary.com/cloud_name/image/upload/v123456789/transformations/public_id.ext
      // We'll insert transformations after /upload/
      const uploadIndex = optimizedUrl.indexOf('/upload/');
      if (uploadIndex > 0) {
        // Insert transformations after /upload/
        optimizedUrl = optimizedUrl.substring(0, uploadIndex + 8) + 'q_auto:best,f_auto/' + optimizedUrl.substring(uploadIndex + 8);
      }
    }

    return optimizedUrl;
  } catch (error: any) {
    logger.error('Error uploading file to Cloudinary:', error);
    throw new Error(error.message || 'حدث خطأ أثناء رفع الملف');
  }
};

// Service Request Functions
export const addServiceRequest = async (request: ServiceRequest): Promise<string> => {
  try {
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

    // Prepare request data with only links (no base64, no sensitive data)
    const requestData = {
      ...request,
      id: requestRef.id,
      documents: documentUrls, // Only URLs and metadata - no base64 data
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Debug: Calculate document size before saving
    const documentSize = calculateDocumentSize(requestData);
    const maxSize = 1024 * 1024; // 1 MB limit

    if (documentSize > maxSize) {
      logger.warn(`Document size (${(documentSize / 1024).toFixed(2)} KB) is large. Consider splitting data.`);
      // Still save, but log warning
    }

    logger.log(`Saving document with size: ${(documentSize / 1024).toFixed(2)} KB`);

    // Save request - only links, no base64, optimized and secure
    await setDoc(requestRef, requestData);
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
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
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
  try {
    const adminDoc = await getDoc(doc(db, 'admins', userId));
    if (adminDoc.exists()) {
      const data = adminDoc.data();
      return data.isAdmin === true;
    }
    return false;
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
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
  const serviceIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
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
    debounceTimer = setTimeout(flushCallback, 40);
  };

  serviceIds.forEach(serviceId => {
    const collectionName = `serviceRequests_${serviceId}`;
    const q = query(collection(db, collectionName));

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

export const updateServiceRequestStatus = async (
  requestId: string,
  status: 'pending' | 'completed' | 'rejected',
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
      { merge: false }
    );

    logger.log('Digital transformation config saved to Firebase successfully');
  } catch (error: any) {
    logger.error('Error saving digital transformation config:', error);
    throw new Error(error.message || 'حدث خطأ أثناء تحديث إعدادات التحول الرقمي');
  }
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
      orderBy('updatedAt', 'desc')
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
      orderBy('updatedAt', 'desc')
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
