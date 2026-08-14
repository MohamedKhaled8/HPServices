import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SERVICES } from '../constants/services';
import { supabase, ASSIGNMENTS_BUCKET } from '../config/supabaseClient';

export interface BackupCollectionSummary {
  name: string;
  count: number;
}

export interface FullBackupPayload {
  metadata: {
    app: string;
    version: string;
    exportedAt: string;
    timestamp: number;
    totalDocuments: number;
    collectionsSummary: BackupCollectionSummary[];
  };
  collections: Record<string, Array<{ id: string; [key: string]: any }>>;
}

/**
 * قائمة جميع المجموعات التي تغطي 100% من بيانات الموقع بدون استثناء
 */
const getTargetCollectionNames = (): string[] => {
  const baseCollections = [
    'students',
    'serviceRequests', // المباشرة والقديمة
    'digitalTransformationCodes',
    'electronicPaymentCodes',
    'siteSettings',
    'serviceConfigs',
    'notifications',
    'activityLogs'
  ];

  // دعم كافة مجموعات الخدمات الديناميكية (serviceRequests_1 إلى serviceRequests_25)
  const serviceCollections: string[] = [];
  SERVICES.forEach((service) => {
    serviceCollections.push(`serviceRequests_${service.id}`);
  });
  // إضافة فئات احتياطية تحسباً لأي خدمة جديدة
  for (let i = 1; i <= 25; i++) {
    const colName = `serviceRequests_${i}`;
    if (!serviceCollections.includes(colName)) {
      serviceCollections.push(colName);
    }
  }

  return Array.from(new Set([...baseCollections, ...serviceCollections]));
};

/**
 * تصدير كافة بيانات الموقع 100% في ملف شمول تراكمي
 */
export const generateFullDatabaseBackup = async (
  onProgress?: (statusText: string, percentage: number) => void
): Promise<FullBackupPayload> => {
  const collectionNames = getTargetCollectionNames();
  const collectionsData: Record<string, Array<{ id: string; [key: string]: any }>> = {};
  const collectionsSummary: BackupCollectionSummary[] = [];
  let totalDocumentsCount = 0;

  const totalSteps = collectionNames.length;

  for (let i = 0; i < collectionNames.length; i++) {
    const colName = collectionNames[i];
    const progressPercent = Math.round(((i + 1) / totalSteps) * 90);
    
    if (onProgress) {
      onProgress(`جاري فحص وتصدير مجموعة: ${colName}...`, progressPercent);
    }

    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const docsList = snap.docs.map((docSnap) => {
          const rawData = docSnap.data();
          // تحويل الـ Timestamp للـ JSON بشكل نظيف
          const cleanData: { id: string; [key: string]: any } = { id: docSnap.id };
          for (const key in rawData) {
            if (rawData[key] && typeof rawData[key] === 'object' && 'seconds' in rawData[key]) {
              cleanData[key] = {
                _type: 'timestamp',
                seconds: rawData[key].seconds,
                nanoseconds: rawData[key].nanoseconds
              };
            } else {
              cleanData[key] = rawData[key];
            }
          }
          return cleanData;
        });

        collectionsData[colName] = docsList;
        collectionsSummary.push({
          name: colName,
          count: docsList.length
        });
        totalDocumentsCount += docsList.length;
      }
    } catch (err) {
      console.warn(`تعذر استخراج المجموعة ${colName} (قد تكون فارغة):`, err);
    }
  }

  // دعم مجلدات ومستندات التكليفات subcollections
  try {
    const tracks = ['track1', 'track2', 'track3', 'unified130'];
    for (const track of tracks) {
      const filesSnap = await getDocs(collection(db, 'assignments', track, 'files'));
      if (!filesSnap.empty) {
        const key = `assignments_${track}_files`;
        collectionsData[key] = filesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        collectionsSummary.push({ name: key, count: filesSnap.docs.length });
        totalDocumentsCount += filesSnap.docs.length;
      }
      const foldersSnap = await getDocs(collection(db, 'assignments', track, 'folders'));
      if (!foldersSnap.empty) {
        const key = `assignments_${track}_folders`;
        collectionsData[key] = foldersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        collectionsSummary.push({ name: key, count: foldersSnap.docs.length });
        totalDocumentsCount += foldersSnap.docs.length;
      }
    }
  } catch (err) {
    console.warn('تعذر استخراج ملفات ومجلدات التكليفات:', err);
  }

  if (onProgress) {
    onProgress('تجهيز حزمة النسخة الاحتياطية النهائية...', 98);
  }

  const payload: FullBackupPayload = {
    metadata: {
      app: 'HP Services Platform',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      totalDocuments: totalDocumentsCount,
      collectionsSummary
    },
    collections: collectionsData
  };

  if (onProgress) {
    onProgress('تم اكتمال إنشاء النسخة الاحتياطية بنجاح!', 100);
  }

  return payload;
};

/**
 * تنزيل النسخة الاحتياطية كملف JSON محلي على جهاز الأدمن
 */
export const downloadBackupAsJSON = (payload: FullBackupPayload): void => {
  const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `hp_services_FULL_BACKUP_${dateStr}.json`;
  const jsonStr = JSON.stringify(payload, null, 2);

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * الحصول على اسم الـ Bucket المتاح في Supabase Storage (الافتراضي هو ASSIGNMENTS_BUCKET = 'assignments')
 */
const CANDIDATE_BUCKETS = [ASSIGNMENTS_BUCKET, 'assignments', 'assignments-files', 'backups'];

const getStorageBucket = async (): Promise<string> => {
  for (const bucketName of CANDIDATE_BUCKETS) {
    try {
      const { error } = await supabase.storage.from(bucketName).list('', { limit: 1 });
      if (!error || !error.message.toLowerCase().includes('not found')) {
        return bucketName;
      }
    } catch {
      // التجربة للباكيت التالي
    }
  }
  return ASSIGNMENTS_BUCKET;
};

/**
 * حفظ النسخة الاحتياطية تلقائياً في Supabase Storage
 */
export const uploadBackupToSupabase = async (
  payload: FullBackupPayload
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const dateStr = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `backups/backup_${dateStr}.json`;
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });

    let bucketName = ASSIGNMENTS_BUCKET;
    let res = await supabase.storage
      .from(bucketName)
      .upload(filename, blob, {
        contentType: 'application/json',
        upsert: true
      });

    if (res.error && res.error.message.toLowerCase().includes('not found')) {
      bucketName = await getStorageBucket();
      res = await supabase.storage
        .from(bucketName)
        .upload(filename, blob, {
          contentType: 'application/json',
          upsert: true
        });
    }

    if (res.error) {
      if (res.error.message.toLowerCase().includes('not found')) {
        throw new Error(`لم يتم العثور على Bucket في Supabase باسم "${bucketName}". يرجى التأكد من إنشاء Bucket باسم "${ASSIGNMENTS_BUCKET}" في لوحة تحكم Supabase Dashboard -> Storage.`);
      }
      throw res.error;
    }

    return { success: true, path: res.data?.path || filename };
  } catch (err: any) {
    console.error('خطأ في حفظ الباك أب على Supabase:', err);
    return { success: false, error: err.message || 'فشل الحفظ السحابي' };
  }
};

export interface SupabaseBackupFile {
  name: string;
  path: string;
  created_at: string;
  size: number;
}

/**
 * جلب قائمة جميع النسخ الاحتياطية المحفوظة في Supabase Storage
 */
export const listSupabaseBackups = async (): Promise<SupabaseBackupFile[]> => {
  try {
    let bucketName = ASSIGNMENTS_BUCKET;
    let res = await supabase.storage
      .from(bucketName)
      .list('backups', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (res.error && res.error.message.toLowerCase().includes('not found')) {
      bucketName = await getStorageBucket();
      res = await supabase.storage
        .from(bucketName)
        .list('backups', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });
    }

    if (res.error) {
      throw res.error;
    }

    if (!res.data) return [];

    return res.data
      .filter((file) => file.name.endsWith('.json'))
      .map((file) => ({
        name: file.name,
        path: `backups/${file.name}`,
        created_at: file.created_at || file.updated_at || new Date().toISOString(),
        size: file.metadata?.size || 0
      }));
  } catch (err) {
    console.error('خطأ في جلب قائمة النسخ الاحتياطية من Supabase:', err);
    return [];
  }
};

/**
 * حذف نسخة احتياطية من Supabase Storage
 */
export const deleteSupabaseBackup = async (
  filename: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const filePath = filename.startsWith('backups/') ? filename : `backups/${filename}`;
    let bucketName = ASSIGNMENTS_BUCKET;
    let res = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (res.error && res.error.message.toLowerCase().includes('not found')) {
      bucketName = await getStorageBucket();
      res = await supabase.storage
        .from(bucketName)
        .remove([filePath]);
    }

    if (res.error) {
      throw res.error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('خطأ في حذف النسخة الاحتياطية من Supabase:', err);
    return { success: false, error: err.message || 'فشل حذف الملف من Supabase' };
  }
};

/**
 * تنزيل وتجهيز محتوى النسخة الاحتياطية من Supabase للاسترجاع الفوري
 */
export const fetchSupabaseBackupPayload = async (
  filename: string
): Promise<FullBackupPayload | null> => {
  try {
    const filePath = filename.startsWith('backups/') ? filename : `backups/${filename}`;
    let bucketName = ASSIGNMENTS_BUCKET;
    let res = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (res.error && res.error.message.toLowerCase().includes('not found')) {
      bucketName = await getStorageBucket();
      res = await supabase.storage
        .from(bucketName)
        .download(filePath);
    }

    if (res.error) {
      throw res.error;
    }

    if (!res.data) return null;

    const text = await res.data.text();
    return JSON.parse(text) as FullBackupPayload;
  } catch (err) {
    console.error('خطأ في جلب ملف النسخة الاحتياطية من Supabase:', err);
    return null;
  }
};

/**
 * استرجاع قواعد البيانات 100% من ملف الباك أب (Disaster Restore)
 */
export const restoreFullDatabaseBackup = async (
  payload: FullBackupPayload,
  onProgress?: (statusText: string, percentage: number) => void
): Promise<{ success: boolean; restoredCount: number; error?: string }> => {
  try {
    if (!payload.collections || typeof payload.collections !== 'object') {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف.');
    }

    const collectionEntries = Object.entries(payload.collections);
    let totalRestored = 0;
    const totalCols = collectionEntries.length;

    for (let colIdx = 0; colIdx < totalCols; colIdx++) {
      const [colName, docs] = collectionEntries[colIdx];
      const progressPercent = Math.round(((colIdx + 1) / totalCols) * 100);

      if (onProgress) {
        onProgress(`جاري استرجاع المجموعة: ${colName} (${docs.length} مستند)...`, progressPercent);
      }

      if (!Array.isArray(docs) || docs.length === 0) continue;

      // تقسيم المستندات إلى دفعات (Batches) كل 400 مستند (Firebase Firestore limit is 500)
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const item of chunk) {
          const docId = item.id;
          if (!docId) continue;

          // معالجة البيانات وإعادة تحويل الـ Timestamps
          const cleanItem: Record<string, any> = {};
          for (const key in item) {
            if (key === 'id') continue;
            const val = item[key];
            if (val && typeof val === 'object' && val._type === 'timestamp') {
              cleanItem[key] = new Date(val.seconds * 1000);
            } else {
              cleanItem[key] = val;
            }
          }

          // تحديد المسار سواء مجموعة رئيسية أو فرعية
          if (colName.startsWith('assignments_')) {
            const parts = colName.split('_'); // assignments_track1_files
            const track = parts[1];
            const subType = parts[2]; // files or folders
            const docRef = doc(db, 'assignments', track, subType, docId);
            batch.set(docRef, cleanItem, { merge: true });
          } else {
            const docRef = doc(db, colName, docId);
            batch.set(docRef, cleanItem, { merge: true });
          }

          totalRestored++;
        }

        await batch.commit();
      }
    }

    if (onProgress) {
      onProgress('تمت عملية الاسترجاع بنجاح لجميع البيانات!', 100);
    }

    return { success: true, restoredCount: totalRestored };
  } catch (err: any) {
    console.error('خطأ أثناء استرجاع النسخة الاحتياطية:', err);
    return { success: false, restoredCount: 0, error: err.message || 'حدث خطأ غير متوقع' };
  }
};
