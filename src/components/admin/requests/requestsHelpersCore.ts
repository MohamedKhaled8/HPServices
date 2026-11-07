import { normalizeWorkflowStatus } from '../../../utils/adminRequestsUtils.ts';
import type { ServiceRequestWorkflowStatus } from '../../../types/index.ts';

/** مفاتيح حقول data الشائعة — Set لاستبعاد O(n) لكل مفتاح داخل الحلقات */
export const REQUEST_SPREADSHEET_STANDARD_KEYS = new Set<string>([
  'full_name_arabic', 'full_name', 'full_name_english', 'student_names', 'names', 'student_names_array',
  'national_id', 'nationalID',
  'whatsapp_number', 'phone_whatsapp', 'leader_whatsapp', 'phone', 'whatsappNumber',
  'email',
  'address', 'address_details', 'deliveryAddress',
  'diploma_type', 'diplomaType', 'diploma_year', 'diplomaYear',
  'track', 'track_category', 'track_name', 'track_other', 'educational_specialization', 'faculty', 'department',
  'receiptUrl', 'receipt_upload', 'selectedCertificate', 'selectedExamLanguage', 'names_array', 'tracks_array',
  'notes', 'status', 'createdAt', 'updatedAt', 'id', 'studentId', 'serviceId',
  'fawryCode', 'fawry_code', 'fawry_number', 'serialNumber', 'orderNumber', 'transaction_id', 'totalPrice', 'price'
]);

export const workflowStatusLabelAr = (s: string | undefined): string => {
  switch (normalizeWorkflowStatus(s)) {
    case 'pending': return 'قيد الانتظار';
    case 'submitted': return 'تم التقديم';
    case 'receipt_sent': return 'تم إرسال الإيصال';
    case 'completed': return 'مكتمل';
    case 'rejected': return 'مرفوض';
    default: return 'قيد الانتظار';
  }
};

export const workflowStatusRank = (s: string | undefined): number => {
  const order: Record<ServiceRequestWorkflowStatus, number> = {
    pending: 0,
    submitted: 1,
    receipt_sent: 2,
    completed: 3,
    rejected: 4
  };
  return order[normalizeWorkflowStatus(s)] ?? 0;
};

export const translateKey = (key: string): string => {
  const keys: Record<string, string> = {
    fullNameArabic: 'الاسم بالعربية',
    fullNameEnglish: 'الاسم بالإنجليزية',
    nationalID: 'رقم الهوية',
    track: 'المسار',
    whatsappNumber: 'رقم الواتساب',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    faculty: 'الكلية',
    department: 'القسم',
    level: 'المستوى الدراسي',
    universityId: 'رقم الكارنيه / الجامعي',
    serviceName: 'اسم الخدمة',
    numberOfCopies: 'عدد النسخ',
    deliveryAddress: 'عنوان التوصيل',
    paymentMethod: 'طريقة الدفع',
    paymentStatus: 'حالة الدفع',
    fawryCode: 'كود فوري',
    phoneNumber: 'رقم الهاتف',
    selectedCertificate: 'الشهادة المختارة',
    examLanguage: 'لغة الامتحان',
    transformationType: 'نوع التحول الرقمي',
    receiptUrl: 'إيصال الدفع',
    notes: 'ملاحظات إضافية',
    college_other: 'الكلية (أخرى)',
    department_other: 'القسم (أخر)',
    track_category: 'فئة المسار المختار',
    track_name: 'اسم المسار الخاص بالطالب',
    educational_specialization_other: 'التخصص التعليمي (أخر)',
    student_type: 'نوع الطالب',
    academic_year: 'العام الدراسي',
    number_of_copies: 'عدد النسخ',
    phone_whatsapp: 'رقم للتواصل والشحن',
    address_details: 'العنوان بالتفصيل',
    diploma_type: 'نوع الدبلومة',
    names: 'الأسماء',
    transfer_phone_number: 'الرقم المحول منه',
    wantsMalazem: 'تم طلب إضافة ملازم؟ (+200 ج.م)',
    selectedExamLanguage: 'لغة الامتحان المختارة',
    full_name_english: 'الاسم بالإنجليزية',
    totalPrice: 'السعر الإجمالي',
    transformation_type: 'نوع التحول الرقمي',
    project_topic: 'موضوع المشروع',
    project_feature: 'الميزة المختارة',
    project_price: 'سعر المشروع',
    exam_language: 'لغة الامتحان',
    phone: 'رقم الهاتف',
    faculty_other: 'كلية أخرى',
    whatsapp_number: 'رقم الواتساب',
    educational_specialization: 'التخصص التعليمي',
    national_id: 'الرقم القومي',
    tracks: 'المسارات',
    tracks_array: 'المسارات'
  };
  return keys[key] || key;
};

export const getServiceNameHelper = (
  serviceId: string,
  bookServiceName?: string,
  assignmentsServiceName?: string,
  finalReviewServiceName?: string
): string => {
  if (!serviceId) return 'خدمة غير معروفة';
  if (serviceId === '3' && bookServiceName) {
    return bookServiceName;
  }
  if (serviceId === '5' && assignmentsServiceName) {
    return assignmentsServiceName;
  }
  if (serviceId === '8' && finalReviewServiceName) {
    return finalReviewServiceName;
  }
  const serviceNames: Record<string, string> = {
    '1': 'سجل بياناتك',
    '2': 'العميل المميز',
    '3': 'شحن الكتب الدراسية',
    '4': 'دفع المصروفات الدراسية',
    '5': 'حل وتسليم تكليفات',
    '6': 'شهادات اونلاين',
    '7': 'التقديم علي التحول الرقمي',
    '8': 'المراجعة النهائية',
    '9': 'مشروع التخرج',
    '10': 'استخراج مستندات',
    '11': 'استلام و شحن التحول الرقمي',
    '12': 'التقديم علي افادة و اثبات قيد'
  };
  return serviceNames[serviceId] || `خدمة ${serviceId}`;
};

export const normPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const d = String(phone).replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
};
