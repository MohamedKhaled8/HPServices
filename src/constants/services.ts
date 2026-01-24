import { Service } from '../types';

export const COLLEGES = [
  'آداب',
  'دار علوم',
  'تجارة',
  'حقوق',
  'دراسات اسلاميه',
  'اصول دين',
  'اعلام',
  'خدمة اجتماعية',
  'دراسات انسانيه',
  'زراعة',
  'السن',
  'سياحة و فنادق',
  'صيدله',
  'علوم',
  'لغات و ترجمة',
  'هندسه',
  'معهد ( اي معهد عالي 4 سنين )',
  'Other'
];

export const DEPARTMENTS = [
  'عربي',
  'دراسات',
  'رياضيات',
  'انجليزي',
  'علوم',
  'فيزياء',
  'كيمياء',
  'بيولوجي',
  'تاريخ',
  'جغرافيا',
  'علم نفس',
  'علم اجتماع',
  'فلسفه',
  'فرنسي',
  'محاسبة',
  'ادارة اعمال',
  'زراعة بكل تخصصاتها',
  'شريعة',
  'اصول دين',
  'حقوق',
  'Other'
];

export const GRADES = [
  'امتياز مع مرتبه الشرف',
  'امتياز',
  'جيد جدا',
  'جيد مرتفع',
  'جيد',
  'مقبول'
];

export const VIP_DIPLOMA_TYPES = [
  'عام تربوي',
  'خاص مناهج',
  'خاص صحة نفسية',
  'خاص ادارة',
  'خاص أصول تربية',
  'خاص علم نفس',
  'مهني مناهج',
  'مهني تربية خاصة',
  'مهني ادارة'
];

export const DIPLOMA_TYPES = [
  'عام تربوي',
  'خاص مناهج',
  'خاص صحة نفسية',
  'خاص ادارة',
  'خاص أصول تربية',
  'خاص علم نفس',
  'مهني مناهج',
  'مهني تربية خاصة',
  'مهني ادارة'
];

export const SERVICES: Service[] = [
  {
    id: '1',
    nameEn: 'Register Your Data',
    nameAr: 'سجل بياناتك',
    descriptionEn: 'Register and update your personal information',
    descriptionAr: 'سجل وحدث معلوماتك الشخصية',
    icon: 'clipboard-list',
    color: '#3B82F6',
    fields: [
      { name: 'full_name', label: 'الأسم الرباعي عربي', type: 'editable', required: true },
      { name: 'national_id', label: 'الرقم القومي', type: 'editable', required: true },
      { name: 'address', label: 'عنوان السكن بالتفصيل', type: 'editable', required: true },
      { name: 'email', label: 'الجيميل', type: 'editable', required: true },
      { name: 'whatsapp_number', label: 'رقم الواتس اب', type: 'editable', required: true },
      { name: 'college', label: 'الكلية او المعهد الي اتخرجت منه', type: 'select', required: true, options: COLLEGES, hasOther: true },
      { name: 'college_other', label: 'اذكر الكلية او المعهد', type: 'text', required: false },
      { name: 'department', label: 'القسم او الشعبة بتاعتك في المؤهل الاساسي ( برجاء كتابه ما تم كتابته علي الشهادة )', type: 'select', required: true, options: DEPARTMENTS, hasOther: true },
      { name: 'department_other', label: 'اذكر القسم او الشعبة', type: 'text', required: false },
      { name: 'grade', label: 'التقدير العام في الشهادة ( برجاء كتابه ما تم كتابته علي الشهادة )', type: 'select', required: true, options: GRADES, hasOther: false }
    ],
    paymentMethods: []
  },
  {
    id: '2',
    nameEn: 'Premium Client',
    nameAr: 'العميل المميز',
    descriptionEn: 'Get premium support and exclusive services',
    descriptionAr: 'احصل على دعم مميز وخدمات حصرية',
    icon: 'user',
    color: '#F59E0B',
    fields: [
      { name: 'full_name_arabic', label: 'الاسم رباعي باللغة العربية', type: 'editable', required: true },
      { name: 'full_name_english', label: 'الاسم رباعي باللغة الانجليزية', type: 'editable', required: true },
      { name: 'national_id', label: 'الرقم القومي', type: 'editable', required: true },
      { name: 'whatsapp_number', label: 'رقم واتس اب', type: 'editable', required: true },
      { name: 'email', label: 'جيميل', type: 'editable', required: true },
      { name: 'diploma_type', label: 'نوع الدبلومة', type: 'select', required: true, options: VIP_DIPLOMA_TYPES },
      { name: 'address', label: 'العنوان بالتفصيل', type: 'editable', required: true }
    ],
    paymentMethods: ['Vodafone', 'Etisalat', 'Orange', 'instaPay']
  },
  {
    id: '3',
    nameEn: 'School Books Shipping',
    nameAr: 'شحن الكتب الدراسية الترم الأول', // سيتم تحديثه من Admin Dashboard
    descriptionEn: 'Order and ship your school books',
    descriptionAr: 'اطلب وشحن كتبك الدراسية',
    icon: 'package',
    color: '#10B981',
    fields: [
      { name: 'number_of_copies', label: 'عدد النسخ المطلوبة (من 1 إلى 10)', type: 'text', required: true },
      { name: 'names', label: 'الأسماء الرباعية (إذا أكثر من نسخة، اكتب الأسماء تحت بعضها)', type: 'textarea', required: true },
      { name: 'tracks', label: 'المسارات والتخصصات (إذا أكثر من نسخة، اكتب المسارات بالترتيب تحت بعضها)', type: 'textarea', required: true },
      { name: 'phone_whatsapp', label: 'رقم هاتف للتواصل والشحن (واتساب وفون)', type: 'text', required: true },
      { name: 'diploma_type', label: 'نوع الدبلومة', type: 'select', required: true, options: DIPLOMA_TYPES },
      { name: 'address_details', label: 'العنوان بالتفصيل (المحافظة / المدينة / اسم الشارع / علامة مميزة / رقم العقار)', type: 'textarea', required: true },
      { name: 'payment_account', label: 'رقم الحساب أو الموبايل الذي حولت منه المبلغ', type: 'text', required: true }
    ],
    paymentMethods: ['Vodafone', 'Etisalat', 'Orange', 'instaPay']
  },
  {
    id: '4',
    nameEn: 'Pay School Fees',
    nameAr: 'دفع المصروفات الدراسية',
    descriptionEn: 'Pay your school fees securely',
    descriptionAr: 'ادفع مصروفاتك الدراسية بأمان',
    icon: 'creditcard',
    color: '#8B5CF6',
    fields: [
      { name: 'full_name_arabic', label: 'الاسم رباعي باللغة العربية', type: 'editable', required: true },
      { name: 'national_id', label: 'الرقم القومي', type: 'editable', required: true },
      { name: 'diploma_type', label: 'نوع الدبلومة', type: 'select', required: true, options: ['اختر نوع الدبلومة', 'عام تربوي', 'خاص', 'مهني'] },
      { name: 'track_category', label: 'المسار', type: 'select', required: true, options: ['اختر المسار', 'الأولى', 'الثانية', 'الثالثة', 'أخرى'] },
      { name: 'track_other', label: 'اذكر المسار', type: 'text', required: false },
      { name: 'diploma_year', label: 'سنة الدبلومة', type: 'select', required: true, options: ['اختر سنة الدبلومة'] }
    ],
    paymentMethods: ['Vodafone', 'Etisalat', 'Orange', 'instaPay']
  },
  {
    id: '5',
    nameEn: 'Solve and Deliver Assignments',
    nameAr: 'حل وتسليم تكليفات',
    descriptionEn: 'Get help with your assignments and submit them',
    descriptionAr: 'احصل على مساعدة في تكليفاتك وقم بتسليمها',
    icon: 'checklist',
    color: '#EC4899',
    fields: [
      { name: 'full_name_arabic', label: 'الاسم رباعي باللغة العربية', type: 'editable', required: true },
      { name: 'educational_specialization', label: 'تخصصك التربوي', type: 'select', required: true, options: ['اختر التخصص', 'عربي', 'رياضيات', 'دراسات', 'علوم', 'إنجليزي', 'أخرى'], hasOther: true },
      { name: 'educational_specialization_other', label: 'اذكر التخصص', type: 'text', required: false },
      { name: 'track', label: 'المسار', type: 'select', required: true, options: ['اختر المسار', 'الأولى', 'الثانية', 'الثالثة'] },
      { name: 'whatsapp_number', label: 'رقم واتساب باللغة الإنجليزية', type: 'editable', required: true }
    ],
    paymentMethods: ['Vodafone', 'Etisalat', 'Orange', 'instaPay']
  },
  {
    id: '6',
    nameEn: 'Online Certificates',
    nameAr: 'شهادات اونلاين',
    descriptionEn: 'Apply for and receive online certificates',
    descriptionAr: 'قدم طلب واحصل على شهادات إلكترونية',
    icon: 'award',
    color: '#06B6D4',
    fields: [
      { name: 'full_name_arabic', label: 'الاسم رباعي باللغة العربية', type: 'editable', required: true },
      { name: 'full_name_english', label: 'الاسم رباعي باللغة الإنجليزية', type: 'editable', required: true },
      { name: 'email', label: 'الجيميل', type: 'editable', required: true },
      { name: 'whatsapp_number', label: 'رقم واتساب', type: 'editable', required: true },
      { name: 'national_id', label: 'الرقم القومي', type: 'editable', required: true },
      { name: 'address', label: 'العنوان بالتفصيل لحد باب البيت', type: 'editable', required: true }
    ],
    paymentMethods: ['Vodafone', 'Etisalat', 'Orange', 'instaPay']
  },
  {
    id: '7',
    nameEn: 'Apply for Digital Transformation',
    nameAr: 'التقديم علي التحول الرقمي',
    descriptionEn: 'Apply for digital transformation services',
    descriptionAr: 'قدم طلب للتحول الرقمي',
    icon: 'zap',
    color: '#14B8A6',
    fields: [
      { name: 'full_name_arabic', label: 'الاسم رباعي باللغة العربية', type: 'editable', required: true },
      { name: 'full_name_english', label: 'الاسم رباعي باللغة الإنجليزية', type: 'editable', required: true },
      { name: 'national_id', label: 'الرقم القومي', type: 'editable', required: true },
      { name: 'whatsapp_number', label: 'رقم واتساب', type: 'editable', required: true },
      { name: 'email', label: 'الجيميل', type: 'editable', required: true },
      { name: 'transformation_type', label: 'اختر نوع التحول الرقمي', type: 'select', required: true }
    ],
    paymentMethods: ['Vodafone', 'Etisalat', 'Orange', 'instaPay']
  },
  {
    id: '8',
    nameEn: 'Final Review',
    nameAr: 'المراجعة النهائية',
    descriptionEn: 'Get comprehensive review for your exams',
    descriptionAr: 'احصل على مراجعة شاملة لامتحاناتك',
    icon: 'search',
    color: '#F97316',
    fields: [
      { name: 'exam_name', label: 'اسم الامتحان', type: 'text', required: true },
      { name: 'review_type', label: 'نوع المراجعة', type: 'select', required: true, options: ['شاملة', 'مركزة', 'نقاط رئيسية'] },
      { name: 'subjects', label: 'المواد', type: 'text', required: true },
      { name: 'additional_notes', label: 'ملاحظات إضافية', type: 'textarea', required: false }
    ],
    paymentMethods: ['Credit Card']
  },
  {
    id: '9',
    nameEn: 'Graduation Project',
    nameAr: 'مشروع التخرج',
    descriptionEn: 'Get help with your graduation project',
    descriptionAr: 'احصل على مساعدة في مشروع التخرج',
    icon: 'target',
    color: '#6366F1',
    fields: [
      { name: 'project_title', label: 'عنوان المشروع', type: 'text', required: true },
      { name: 'project_description', label: 'وصف المشروع', type: 'textarea', required: true },
      { name: 'team_size', label: 'حجم الفريق', type: 'number', required: true },
      { name: 'submission_date', label: 'تاريخ التقديم', type: 'text', required: true }
    ],
    paymentMethods: ['Credit Card', 'Bank Transfer']
  },
  {
    id: '10',
    nameEn: 'Extract Documents',
    nameAr: 'استخراج مستندات',
    descriptionEn: 'Request and extract official documents',
    descriptionAr: 'اطلب واستخرج المستندات الرسمية',
    icon: 'file-check',
    color: '#EF4444',
    fields: [
      { name: 'document_type', label: 'نوع المستند', type: 'select', required: true, options: ['شهادة', 'كشف درجات', 'بيان حالة', 'مستندات أخرى'] },
      { name: 'number_of_copies', label: 'عدد النسخ', type: 'number', required: true },
      { name: 'purpose', label: 'الغرض من الاستخراج', type: 'textarea', required: true }
    ],
    paymentMethods: ['Credit Card', 'Bank Transfer']
  }
];

export const GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'القليوبية',
  'الإسكندرية',
  'البرج الأحمر',
  'الإسماعيلية',
  'بورسعيد',
  'السويس',
  'الشرقية',
  'الدقهلية',
  'كفر الشيخ',
  'المنوفية',
  'الغربية',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'سوهاج',
  'أسيوط',
  'الأقصر',
  'أسوان'
];

export const DIPLOMA_YEARS = Array.from({ length: 75 }, (_, i) => (2090 - i).toString());

export const TRACKS = [
  'الأولى',
  'الثانية',
  'الثالثة'
];

export const COURSES = [
  'عربي',
  'رياضيات',
  'علوم',
  'إنجليزي',
  'دراسات اجتماعية'
];

export const PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Cash on Delivery',
  'Installment'
];
