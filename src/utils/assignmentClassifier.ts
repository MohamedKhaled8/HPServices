import { AssignmentDeliveryType } from '../types';

export type AssignmentCategory = 'personalized' | 'plain' | 'unified';

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
