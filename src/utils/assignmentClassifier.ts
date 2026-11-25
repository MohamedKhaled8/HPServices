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

export type StandardSpecialization = (typeof STANDARD_SPECIALIZATIONS)[number];

const ALL_SPECIALIZATIONS_TOKENS = new Set(['all', 'الكل', 'جميع التخصصات']);

const cleanSpecializationText = (raw: string): string =>
  raw
    .trim().toLowerCase()
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[-_/\\,.]/g, ' ').replace(/\s+/g, ' ').trim();

const CANONICAL_BY_CLEAN = new Map<string, StandardSpecialization>(
  STANDARD_SPECIALIZATIONS.map((spec) => [cleanSpecializationText(spec), spec])
);

const EMPTY_SPEC_TOKENS = new Set(['', 'اخرى', 'اخري', 'other', 'عام', 'اختر التخصص', 'اختر']);

const SPECIALIZATION_RULES: ReadonlyArray<
  readonly [StandardSpecialization, ReadonlyArray<string>, ((c: string) => boolean)?]
> = [
  ['شريعة ودراسات إسلامية', ['شريع', 'اصول دين', 'دراسات اسلام', 'تربيه اسلام', 'تربيه دين', 'فقه', 'عقيده', 'تفسير', 'قران', 'اسلامي', 'اسلاميه']],
  ['علم نفس واجتماع', ['نفس', 'علم اجتماع'], (c) => !c.includes('دراسات') && c.includes('اجتماع')],
  ['تاريخ وجغرافيا', ['تاريخ', 'جغرافيا']],
  ['دراسات اجتماعية', ['دراسات']],
  ['فلسفة ومنطق', ['فلسف', 'منطق']],
  ['لغة عربية', ['عرب', 'arabic']],
  ['لغة إنجليزية', ['انجليز', 'انقليز', 'english']],
  ['لغة فرنسية', ['فرنس', 'french']],
  ['تعليم ابتدائي / طفولة', ['طفول', 'ابتدائ', 'رياض اطفال', 'معلم فصل']],
  ['تربية رياضية', ['بدن', 'تربيه رياض', 'رياضه']],
  ['زراعي / صناعي', ['زراع', 'صناع']],
  ['تربية فنية', ['تربيه فنيه', 'فنيه', 'فنون', 'رسم']],
  ['تربية موسيقية', ['موسيق']],
  ['مواد تجارية', ['تجار', 'محاسب', 'اداره اعمال']],
  ['حاسب آلي وتكنولوجيا تعليم', ['حاسب', 'تكنولوج', 'كمبيوتر'], (c) => /\bit\b/.test(c)],
  ['رياضيات', ['رياض', 'حساب', 'جبر', 'هندسه', 'math']],
  ['علوم', ['كيمياء', 'فيزياء', 'احياء', 'بيولوج', 'علوم', 'science']]
];

/**
 * دالة تطبيع موحدة للتخصصات تُرجع تصنيفاً قياسياً واحداً فقط من القائمة المعتمدة (18 تخصصاً)
 */
export const normalizeSpecialization = (raw?: string | null): StandardSpecialization => {
  if (!raw) return 'عام / أخرى';
  const clean = cleanSpecializationText(raw);
  if (EMPTY_SPEC_TOKENS.has(clean)) return 'عام / أخرى';

  const exactCanonical = CANONICAL_BY_CLEAN.get(clean);
  if (exactCanonical) return exactCanonical;

  const matchedRule = SPECIALIZATION_RULES.find(
    ([, keywords, extraMatch]) =>
      keywords.some((kw) => clean.includes(kw)) || Boolean(extraMatch?.(clean))
  );
  return matchedRule ? matchedRule[0] : 'عام / أخرى';
};

/**
 * تحديد تخصص الطالب وفق الهرمية المعتمدة:
 * 1. تخصص طلب الخدمة 5 (data.educational_specialization) إذا وجد
 * 2. تخصص حساب الطالب (student.course)
 * 3. تخصص المؤهل الأساسي (student.department)
 */
export const resolveStudentSpecialization = (
  student: Partial<StudentData> | null | undefined,
  requestData?: Record<string, unknown> | null
): StandardSpecialization => {
  if (!student && !requestData) return 'عام / أخرى';

  const fromReq = requestData?.educational_specialization ?? requestData?.specialization;
  if (typeof fromReq === 'string' && fromReq.trim() && !fromReq.includes('اختر')) {
    const normalizedReq = normalizeSpecialization(fromReq);
    if (normalizedReq !== 'عام / أخرى') return normalizedReq;
  }

  const candidates = [student?.course, student?.educational_specialization, student?.department];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const normalized = normalizeSpecialization(candidate);
      if (normalized !== 'عام / أخرى') return normalized;
    }
  }

  return 'عام / أخرى';
};

/**
 * التحقق الصارم مما إذا كان التخصص القياسي للطالب يطابق أحد التخصصات المستهدفة بالمساواة التامة
 */
export const isSpecializationMatch = (
  studentSpecialization: string,
  targetSpecializations?: string[]
): boolean => {
  if (!targetSpecializations || targetSpecializations.length === 0) return true;
  if (targetSpecializations.some((t) => ALL_SPECIALIZATIONS_TOKENS.has(t.trim().toLowerCase()))) {
    return true;
  }

  const studentCanonical = normalizeSpecialization(studentSpecialization);
  const selectedCanonicalSet = new Set<StandardSpecialization>(
    targetSpecializations.map((target) => normalizeSpecialization(target))
  );

  return selectedCanonicalSet.has(studentCanonical);
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
