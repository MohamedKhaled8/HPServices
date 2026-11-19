import type { AssignmentDeliveryType, StudentData } from '../types/index.ts';

export type AssignmentCategory = 'personalized' | 'plain' | 'unified';

/**
 * قائمة التخصصات القياسية المعتمدة في المنصة
 */
export const STANDARD_SPECIALIZATIONS = [
  'لغة عربية',
  'رياضيات',
  'لغة إنجليزية',
  'علوم',
  'دراسات اجتماعية',
  'حاسب آلي وتكنولوجيا تعليم',
  'علم نفس واجتماع',
  'فلسفة ومنطق',
  'تاريخ وجغرافيا',
  'لغة فرنسية',
  'تربية فنية',
  'تربية موسيقية',
  'تربية رياضية',
  'مواد تجارية',
  'زراعي / صناعي',
  'تعليم ابتدائي / طفولة',
  'شريعة ودراسات إسلامية',
  'عام / أخرى'
] as const;

/**
 * دالة تطبيع موحدة للتخصصات لمعالجة الفروق اللفظية والإملائية
 * مثل: (عربي = لغة عربية)، (انجليزي = لغة إنجليزية)، (دراسات = دراسات اجتماعية)
 */
export const normalizeSpecialization = (raw?: string | null): string => {
  if (!raw) return 'عام / أخرى';
  const clean = raw.trim().toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\-_/\\,.]/g, ' ')
    .replace(/\s+/g, ' ');

  if (!clean || clean === 'اخرى' || clean === 'اخري' || clean === 'other' || clean === 'اختر التخصص' || clean === 'اختر') {
    return 'عام / أخرى';
  }

  if (clean.includes('عرب')) return 'لغة عربية';
  if (clean.includes('انجليز') || clean.includes('انقليز') || clean.includes('english')) return 'لغة إنجليزية';
  if (clean.includes('رياض') || clean.includes('حساب') || clean.includes('جبر') || clean.includes('هندسه') || clean.includes('math')) return 'رياضيات';
  if (clean.includes('كيمياء') || clean.includes('فيزياء') || clean.includes('احياء') || clean.includes('بيولوج') || clean.includes('علوم') || clean.includes('science')) return 'علوم';
  if (clean.includes('دراسات') || clean.includes('تاريخ') || clean.includes('جغرافيا') || clean.includes('اجتماع')) return 'دراسات اجتماعية';
  if (clean.includes('حاسب') || clean.includes('تكنولوج') || clean.includes('كمبيوتر') || clean.includes('it')) return 'حاسب آلي وتكنولوجيا تعليم';
  if (clean.includes('نفس')) return 'علم نفس واجتماع';
  if (clean.includes('فلسف') || clean.includes('منطق')) return 'فلسفة ومنطق';
  if (clean.includes('فرنس') || clean.includes('french')) return 'لغة فرنسية';
  if (clean.includes('فن') || clean.includes('رسم')) return 'تربية فنية';
  if (clean.includes('موسيق')) return 'تربية موسيقية';
  if (clean.includes('بدن') || clean.includes('تربيه رياض') || clean.includes('رياضه')) return 'تربية رياضية';
  if (clean.includes('تجار') || clean.includes('محاسب') || clean.includes('اداره اعمال')) return 'مواد تجارية';
  if (clean.includes('زراع') || clean.includes('صناع')) return 'زراعي / صناعي';
  if (clean.includes('طفول') || clean.includes('ابتدائ') || clean.includes('رياض اطفال')) return 'تعليم ابتدائي / طفولة';
  if (clean.includes('شريع') || clean.includes('اصول دين') || clean.includes('اسلام')) return 'شريعة ودراسات إسلامية';

  return raw.trim();
};

/**
 * تحديد تخصص الطالب وفق الهرمية المعتمدة:
 * 1. تخصص طلب الخدمة 5 (data.educational_specialization) إذا وجد
 * 2. تخصص حساب الطالب (student.course)
 * 3. تخصص المؤهل الأساسي (student.department)
 */
export const resolveStudentSpecialization = (
  student: Partial<StudentData> | null | undefined,
  requestData?: any
): string => {
  if (!student && !requestData) return 'عام / أخرى';

  const fromReq = requestData?.educational_specialization || requestData?.specialization;
  if (fromReq && typeof fromReq === 'string' && fromReq.trim() && !fromReq.includes('اختر')) {
    const normalizedReq = normalizeSpecialization(fromReq);
    if (normalizedReq !== 'عام / أخرى') return normalizedReq;
  }

  if (student?.course && typeof student.course === 'string' && student.course.trim()) {
    const normalizedCourse = normalizeSpecialization(student.course);
    if (normalizedCourse !== 'عام / أخرى') return normalizedCourse;
  }

  if (student?.educational_specialization && typeof student.educational_specialization === 'string' && student.educational_specialization.trim()) {
    const normalizedEdu = normalizeSpecialization(student.educational_specialization);
    if (normalizedEdu !== 'عام / أخرى') return normalizedEdu;
  }

  if (student?.department && typeof student.department === 'string' && student.department.trim()) {
    const normalizedDept = normalizeSpecialization(student.department);
    if (normalizedDept !== 'عام / أخرى') return normalizedDept;
  }

  return 'عام / أخرى';
};

/**
 * التحقق مما إذا كان تخصص الطالب يطابق أحد التخصصات المستهدفة
 */
export const isSpecializationMatch = (
  studentSpecialization: string,
  targetSpecializations?: string[]
): boolean => {
  if (!targetSpecializations || targetSpecializations.length === 0) return true;
  if (targetSpecializations.includes('all') || targetSpecializations.includes('الكل') || targetSpecializations.includes('جميع التخصصات')) {
    return true;
  }

  const normStudent = normalizeSpecialization(studentSpecialization);

  return targetSpecializations.some((target) => {
    if (target === 'all' || target === 'الكل' || target === 'جميع التخصصات') return true;
    const normTarget = normalizeSpecialization(target);
    return (
      normStudent === normTarget ||
      normStudent.includes(normTarget) ||
      normTarget.includes(normStudent)
    );
  });
};

/**
 * دالة ذكية لتصنيف أي تكليف إلى إحدى الفئات الثلاث:
 * 1. personalized: حل وتسليم التكليفات (يُرسل باسم الطالب وبياناته)
 * 2. plain: حل PDF فقط (يُرسل باسم الملف الأصلي بدون بيانات الطالب)
 * 3. unified: التربية العملي / ملف موحد (يُرسل موحداً للمشتركين فيه)
 */
export const classifyAssignment = (item: {
  name?: string;
  price?: number;
  deliveryType?: AssignmentDeliveryType | string;
}): AssignmentCategory => {
  if (item.deliveryType === 'personalized') return 'personalized';
  if (item.deliveryType === 'plain') return 'plain';
  if (item.deliveryType === 'unified') return 'unified';

  const name = String(item.name || '').trim().toLowerCase();
  const price = Number(item.price || 0);

  // 1. ملفات التربية العملي (Unified / 130 EGP)
  if (name.includes('عملي') || name.includes('تربية') || price === 130) {
    return 'unified';
  }

  // 2. حل PDF فقط (Plain / 200 EGP)
  if (name.includes('pdf') || name.includes('فقط') || name.includes('بدون') || price === 200) {
    return 'plain';
  }

  // 3. حل وتسليم التكليفات (Personalized / 300 or 500 EGP)
  if (
    name.includes('تسليم') ||
    name.includes('بيانات') ||
    name.includes('اسم') ||
    price === 500 ||
    price === 300
  ) {
    return 'personalized';
  }

  // Default fallback
  return 'personalized';
};

/**
 * التحقق مما إذا كان تكليفان متعارضين (مثل حل وتسليم vs حل pdf فقط)
 * بحيث لا يستطيع الطالب الجمع بين باقتين للحل نفسه، لكن يمكنه الجمع بين الحل والعملي.
 */
export const areAssignmentsMutuallyExclusive = (
  itemA: { name?: string; price?: number; deliveryType?: string },
  itemB: { name?: string; price?: number; deliveryType?: string }
): boolean => {
  const catA = classifyAssignment(itemA);
  const catB = classifyAssignment(itemB);

  // العملي مستقل تماماً ويمكن اختياره مع أي باقة
  if (catA === 'unified' || catB === 'unified') return false;

  // حل وتسليم يتعارض مع حل pdf فقط
  return (
    (catA === 'personalized' && catB === 'plain') ||
    (catA === 'plain' && catB === 'personalized')
  );
};
