import type { TrackKey, AssignmentFileMeta, AssignedFile } from '../types/index.ts';

/**
 * تحويل مسميات المسارات المتنوعة إلى المفتاح القياسي TrackKey
 */
export const getTrackKey = (track?: string | null): TrackKey | null => {
  if (!track) return null;
  const normalized = track.trim().toLowerCase();
  if (normalized.includes('unified') || normalized.includes('130')) {
    return null;
  }
  if (
    normalized === 'track1' ||
    normalized === '1' ||
    normalized.includes('track 1') ||
    normalized.includes('مسار 1') ||
    normalized.includes('المسار 1') ||
    normalized.includes('أول') ||
    normalized.includes('اول')
  ) {
    return 'track1';
  }
  if (
    normalized === 'track2' ||
    normalized === '2' ||
    normalized.includes('track 2') ||
    normalized.includes('مسار 2') ||
    normalized.includes('المسار 2') ||
    normalized.includes('ثان')
  ) {
    return 'track2';
  }
  if (
    normalized === 'track3' ||
    normalized === '3' ||
    normalized.includes('track 3') ||
    normalized.includes('مسار 3') ||
    normalized.includes('المسار 3') ||
    normalized.includes('ثالث')
  ) {
    return 'track3';
  }
  return null;
};

/**
 * تحويل المفتاح القياسي للمسار إلى الاسم العربي الرسمي
 */
export const trackKeyToDisplayName = (key: TrackKey): string => {
  switch (key) {
    case 'track1':
      return 'الأول';
    case 'track2':
      return 'الثاني';
    case 'track3':
      return 'الثالث';
  }
};

/**
 * وحدة تكليف مستقلة (مجلد ذو نماذج بديلة، أو ملف منفرد بالجذر)
 */
export interface AssignmentUnit {
  key: string;
  unitName: string;
  folderPath?: string;
  isFolder: boolean;
  files: AssignmentFileMeta[];
}

/**
 * تجميع ملفات المسار إلى وحدات تكليف مستقلة
 */
export const groupFilesIntoAssignmentUnits = (
  files: AssignmentFileMeta[]
): AssignmentUnit[] => {
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

  return Array.from(unitMap.values());
};

export interface ComputeSyncOptions {
  existingFiles: AssignedFile[];
  oldTrackKey: TrackKey | null;
  newTrackKey: TrackKey;
  newTrackFiles: AssignmentFileMeta[];
  oldTrackFileIds?: Set<string>;
  studentId: string;
  studentNameArabic?: string;
  studentSpecialization?: string;
  isPlainNaming?: boolean;
}

export interface ComputeSyncResult {
  canSync: boolean;
  action: 'synced' | 'no_new_files_preserved' | 'no_change';
  updatedAssignedFiles: AssignedFile[];
  removedFiles: AssignedFile[];
  addedFiles: AssignedFile[];
  preservedFiles: AssignedFile[];
}

/**
 * دالة حسابية نقية (Pure Function) لحساب التغييرات في ملفات الطالب بدقة متناهية
 * تفصل منطق المعالجة عن قاعدة البيانات وتتيح اختبار كافة السيناريوهات
 */
export const computeSynchronizedAssignedFiles = (
  options: ComputeSyncOptions
): ComputeSyncResult => {
  const {
    existingFiles,
    oldTrackKey,
    newTrackKey,
    newTrackFiles,
    oldTrackFileIds,
    studentId,
    studentNameArabic,
    studentSpecialization,
    isPlainNaming: explicitPlainNaming
  } = options;

  // إذا كانت ملفات المسار الجديد فارغة -> الحفاظ على الملفات الحالية لمنع ترك الطالب بدون ملفات (القاعدة 6 و 7)
  if (!newTrackFiles || newTrackFiles.length === 0) {
    return {
      canSync: false,
      action: 'no_new_files_preserved',
      updatedAssignedFiles: [...existingFiles],
      removedFiles: [],
      addedFiles: [],
      preservedFiles: [...existingFiles]
    };
  }

  // التعرف الدقيق على الملفات التابعة للمسار القديم فقط
  const isOldTrackFile = (f: AssignedFile): boolean => {
    if (!f) return false;

    // ملفات الـ 130 الموحدة (التربية العملي) ممنوع حذفها نهائياً
    if (f.track === 'unified130' || (f as any).is130 === true) {
      return false;
    }

    // مطابقة المسار الصريح للملف
    if (f.track && getTrackKey(f.track) === oldTrackKey) {
      return true;
    }

    // مطابقة معرف الملف مع معرفات ملفات المسار القديم
    if (f.id && oldTrackFileIds && oldTrackFileIds.has(f.id)) {
      return true;
    }

    return false;
  };

  const removedFiles = existingFiles.filter(isOldTrackFile);
  const preservedFiles = existingFiles.filter((f) => !isOldTrackFile(f));

  // تحديد نمط التسمية (اسم الطالب أو الاسم المجرد) بناءً على ملفات الطالب السابقة
  let isPlainNaming = false;
  if (explicitPlainNaming !== undefined) {
    isPlainNaming = explicitPlainNaming;
  } else {
    const hasPersonalized = removedFiles.some(
      (f) => f.customName && f.customName.includes('_-_')
    );
    const hasPlain = removedFiles.some(
      (f) => f.customName && f.customName === f.name
    );
    if (hasPersonalized) {
      isPlainNaming = false;
    } else if (hasPlain) {
      isPlainNaming = true;
    } else {
      isPlainNaming = false; // الوضع الافتراضي للخدمة الكاملة
    }
  }

  // تجميع ملفات المسار الجديد في وحدات تكليف
  const units = groupFilesIntoAssignmentUnits(newTrackFiles);

  const cleanStudentName = (studentNameArabic || 'طالب')
    .replace(/\s+/g, '_')
    .replace(/[^\u0600-\u06FF\w.-]/g, '_');

  // اختيار نموذج محدد لكل وحدة تكليف بطريقة حتمية (Deterministic) لكل طالب
  const studentHash = (studentId || 'student')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const addedFiles: AssignedFile[] = units.map((unit, unitIdx) => {
    let fileToAssign: AssignmentFileMeta;
    if (unit.isFolder && unit.files.length > 0) {
      const variantIdx = (studentHash + unitIdx) % unit.files.length;
      fileToAssign = unit.files[variantIdx];
    } else {
      fileToAssign = unit.files[0];
    }

    const ext = fileToAssign.name.includes('.')
      ? fileToAssign.name.substring(fileToAssign.name.lastIndexOf('.'))
      : '';
    const base = fileToAssign.name.includes('.')
      ? fileToAssign.name.substring(0, fileToAssign.name.lastIndexOf('.'))
      : fileToAssign.name;
    const customFileName = isPlainNaming
      ? fileToAssign.name
      : `${cleanStudentName}_-_${base}${ext}`;

    return {
      id: fileToAssign.id,
      name: fileToAssign.name,
      customName: customFileName,
      url: fileToAssign.url,
      track: newTrackKey,
      assignmentId: fileToAssign.id,
      specialization: studentSpecialization || 'عام / أخرى',
      assignedAt: new Date().toISOString(),
      folderPath: fileToAssign.folderPath || '',
      folderName: unit.unitName || ''
    };
  });

  // منع تكرار تخصيص الملفات (القاعدة 5)
  const addedFileIdSet = new Set(addedFiles.map((a) => a.id));
  const cleanPreservedFiles = preservedFiles.filter((f) => !addedFileIdSet.has(f.id));

  const updatedAssignedFiles = [...cleanPreservedFiles, ...addedFiles];

  return {
    canSync: true,
    action: 'synced',
    updatedAssignedFiles,
    removedFiles,
    addedFiles,
    preservedFiles: cleanPreservedFiles
  };
};
