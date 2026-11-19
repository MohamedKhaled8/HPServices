import {
  doc,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { StudentData, AssignedFile, TrackKey, AssignmentFileMeta } from '../types';
import { getAssignmentFilesForTrack } from './firebaseService';
import { resolveStudentSpecialization } from '../utils/assignmentClassifier';
import { logger } from '../utils/logger';
import {
  getTrackKey,
  trackKeyToDisplayName,
  computeSynchronizedAssignedFiles
} from '../utils/studentTrackSyncCore';

export {
  getTrackKey,
  trackKeyToDisplayName,
  groupFilesIntoAssignmentUnits,
  computeSynchronizedAssignedFiles
} from '../utils/studentTrackSyncCore';

export type {
  AssignmentUnit,
  ComputeSyncOptions,
  ComputeSyncResult
} from '../utils/studentTrackSyncCore';

export interface TrackSyncResult {
  synced: boolean;
  action:
    | 'synced'
    | 'no_change'
    | 'no_new_files_preserved'
    | 'student_had_no_files';
  oldTrackKey: TrackKey | null;
  newTrackKey: TrackKey | null;
  oldTrackName: string | null;
  newTrackName: string;
  removedFilesCount: number;
  addedFilesCount: number;
  assignedFiles: AssignedFile[];
  assignedFile?: AssignedFile | null;
  message: string;
}

/**
 * الخدمة المركزية الموحدة لمزامنة ملفات الطالب عند تغيير المسار الدراسي
 * تُستدعى تلقائياً سواء كان التغيير من لوحة تحكم الأدمن أو من حساب الطالب في صفحته الشخصية
 */
export const syncStudentAssignmentsOnTrackChange = async (
  studentId: string,
  newTrackInput: string,
  knownOldTrackInput?: string | null
): Promise<TrackSyncResult> => {
  const newTrackKey = getTrackKey(newTrackInput);

  if (!newTrackKey) {
    logger.warn(`Invalid or empty new track: "${newTrackInput}"`);
    return {
      synced: false,
      action: 'no_change',
      oldTrackKey: null,
      newTrackKey: null,
      oldTrackName: knownOldTrackInput || null,
      newTrackName: newTrackInput || '',
      removedFilesCount: 0,
      addedFilesCount: 0,
      assignedFiles: [],
      message: 'لم يتم تحديد مسار دراسي صحيح'
    };
  }

  const newTrackName = trackKeyToDisplayName(newTrackKey);

  // 1) قراءة مستند الطالب الحالي من قاعدة البيانات
  const studentRef = doc(db, 'students', studentId);
  const studentSnap = await getDoc(studentRef);

  if (!studentSnap.exists()) {
    throw new Error('لم يتم العثور على حساب الطالب');
  }

  const studentData = studentSnap.data() as StudentData;
  const currentTrackKey = getTrackKey(knownOldTrackInput || studentData.track || null);
  const oldTrackName = studentData.track || knownOldTrackInput || null;

  // إذا لم يتغير المسار الفعلي
  if (currentTrackKey === newTrackKey) {
    const existing = Array.isArray(studentData.assignedFiles)
      ? studentData.assignedFiles
      : studentData.assignedFile
      ? [studentData.assignedFile]
      : [];
    return {
      synced: false,
      action: 'no_change',
      oldTrackKey: currentTrackKey,
      newTrackKey,
      oldTrackName,
      newTrackName,
      removedFilesCount: 0,
      addedFilesCount: 0,
      assignedFiles: existing,
      assignedFile: existing[existing.length - 1] || null,
      message: 'المسار الدراسي لم يتغير'
    };
  }

  const existingFiles: AssignedFile[] = Array.isArray(studentData.assignedFiles)
    ? studentData.assignedFiles
    : studentData.assignedFile
    ? [studentData.assignedFile]
    : [];

  // 2) جلب قائمة ملفات المسار القديم للتحقق الدقيق من المعرفات
  let oldTrackFileIds = new Set<string>();
  if (currentTrackKey) {
    try {
      const oldFilesMeta = await getAssignmentFilesForTrack(currentTrackKey);
      oldTrackFileIds = new Set(oldFilesMeta.map((f) => f.id));
    } catch (err) {
      logger.warn('Failed to fetch old track files list (non-fatal):', err);
    }
  }

  // فحص الملفات التابعة للمسار القديم المسندة للطالب حالياً
  const isOldTrackFile = (f: AssignedFile): boolean => {
    if (!f) return false;
    if (f.track === 'unified130' || (f as any).is130 === true) return false;
    if (f.track && getTrackKey(f.track) === currentTrackKey) return true;
    if (f.id && oldTrackFileIds.has(f.id)) return true;
    return false;
  };

  const oldTrackFilesOnStudent = existingFiles.filter(isOldTrackFile);

  // 3) التحقق مما إذا كان الطالب مشتركاً في التكليفات (لديه ملفات مسندة أو طلب خدمة 5 معتمد)
  let hasApprovedService5 = false;
  try {
    const q = query(
      collection(db, 'serviceRequests_5'),
      where('studentId', '==', studentId)
    );
    const reqSnap = await getDocs(q);
    hasApprovedService5 = reqSnap.docs.some((d) => {
      const s = d.data().status;
      return s === 'completed' || s === 'receipt_sent';
    });
  } catch (err) {
    logger.warn('Failed to check serviceRequests_5 (non-fatal):', err);
  }

  // إذا لم يكن لدى الطالب أي ملفات سابقة للمسار ولم يكن مشتركاً في الخدمة
  if (oldTrackFilesOnStudent.length === 0 && !hasApprovedService5) {
    await updateDoc(studentRef, {
      track: newTrackName,
      track_name: newTrackName,
      updatedAt: serverTimestamp()
    });

    return {
      synced: false,
      action: 'student_had_no_files',
      oldTrackKey: currentTrackKey,
      newTrackKey,
      oldTrackName,
      newTrackName,
      removedFilesCount: 0,
      addedFilesCount: 0,
      assignedFiles: existingFiles,
      assignedFile: existingFiles[existingFiles.length - 1] || null,
      message: 'تم تحديث المسار بنجاح (لا توجد تكليفات سابقة للطالب لمزامنتها)'
    };
  }

  // 4) جلب ملفات المسار الجديد والتحقق من وجودها (القواعد 6 و 7)
  const newTrackFiles = await getAssignmentFilesForTrack(newTrackKey);

  if (newTrackFiles.length === 0) {
    // ممنوع حذف الملفات الحالية وترك الطالب بدون ملفات
    logger.warn(
      `No files available for track ${newTrackKey}. Preserving existing student assignments.`
    );
    await updateDoc(studentRef, {
      track: newTrackName,
      track_name: newTrackName,
      updatedAt: serverTimestamp()
    });

    return {
      synced: false,
      action: 'no_new_files_preserved',
      oldTrackKey: currentTrackKey,
      newTrackKey,
      oldTrackName,
      newTrackName,
      removedFilesCount: 0,
      addedFilesCount: 0,
      assignedFiles: existingFiles,
      assignedFile: existingFiles[existingFiles.length - 1] || null,
      message: `تم تغيير المسار إلى (${newTrackName}) ولكن تم الإبقاء على ملفاتك الحالية لعدم وجود ملفات مرفوعة للمسار الجديد حتى الآن`
    };
  }

  // 5) حساب الملفات المتزامنة باستخدام الدالة النقية
  const syncComputation = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: currentTrackKey,
    newTrackKey,
    newTrackFiles,
    oldTrackFileIds,
    studentId,
    studentNameArabic: studentData.fullNameArabic,
    studentSpecialization: resolveStudentSpecialization(studentData)
  });

  const finalFiles = syncComputation.updatedAssignedFiles;
  const lastAssigned = finalFiles.length > 0 ? finalFiles[finalFiles.length - 1] : null;
  const newFileIdSet = new Set(syncComputation.addedFiles.map((a) => a.id));

  // 6) تنفيذ عملية التحديث الذري بأمان كامل عبر Transaction (القواعد 8 و 9 و 10)
  await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(studentRef);
    if (!freshSnap.exists()) {
      throw new Error('لم يتم العثور على حساب الطالب');
    }

    const freshData = freshSnap.data() as StudentData;
    const freshExisting = Array.isArray(freshData.assignedFiles)
      ? freshData.assignedFiles
      : freshData.assignedFile
      ? [freshData.assignedFile]
      : [];

    // تصفية ملفات المسار القديم مع استبعاد أي تكرار
    const freshKept = freshExisting
      .filter((f) => !isOldTrackFile(f))
      .filter((f) => !newFileIdSet.has(f.id));

    const atomicMergedFiles = [...freshKept, ...syncComputation.addedFiles];
    const atomicLastFile =
      atomicMergedFiles.length > 0
        ? atomicMergedFiles[atomicMergedFiles.length - 1]
        : null;

    transaction.update(studentRef, {
      assignedFiles: atomicMergedFiles,
      assignedFile: atomicLastFile,
      track: newTrackName,
      track_name: newTrackName,
      updatedAt: serverTimestamp()
    });
  });

  logger.log(
    `Track sync success for student ${studentId}: removed ${syncComputation.removedFiles.length} files from ${currentTrackKey}, added ${syncComputation.addedFiles.length} files for ${newTrackKey}`
  );

  return {
    synced: true,
    action: 'synced',
    oldTrackKey: currentTrackKey,
    newTrackKey,
    oldTrackName,
    newTrackName,
    removedFilesCount: syncComputation.removedFiles.length,
    addedFilesCount: syncComputation.addedFiles.length,
    assignedFiles: finalFiles,
    assignedFile: lastAssigned,
    message: `تمت مزامنة الملفات بنجاح للمسار الجديد (${newTrackName})`
  };
};
