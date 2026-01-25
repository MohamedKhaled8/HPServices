export interface StudentData {
  id?: string;
  fullNameArabic: string;
  vehicleNameEnglish: string;
  whatsappNumber: string;
  diplomaYear: string;
  diplomaType: string;
  track: string;
  nationalID: string;
  address: {
    governorate: string;
    city: string;
    street: string;
    building: string;
    siteNumber: string;
    landmark?: string;
  };
  course: string;
  email: string;
  password?: string;
  createdAt?: string;
  college?: string;
  department?: string;
  grade?: string;
}

export interface Service {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  fields: ServiceField[];
  paymentMethods: string[];
  features?: string[]; // المميزات - اختياري
  requiredDocuments?: string[]; // المستندات المطلوبة - اختياري
}

export interface ServiceField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'readonly' | 'editable';
  required: boolean;
  options?: string[];
  hasOther?: boolean; // للـ dropdown مع خيار Other
  defaultValue?: string; // القيمة الافتراضية من بيانات المستخدم
}

export interface ServiceRequest {
  id?: string;
  studentId: string;
  serviceId: string;
  data: Record<string, any>;
  documents: UploadedFile[];
  paymentMethod?: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // base64 for preview, or storage URL after upload
  preview?: string;
  file?: File; // Actual file object for upload
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface AdminData {
  id?: string;
  email: string;
  isAdmin: boolean;
  createdAt?: string;
}

export interface BookServiceConfig {
  serviceName: string;
  prices: {
    [key: string]: number; // "1": 1750, "2": 3440, etc.
  };
  paymentMethods: {
    instaPay: string;
    cashWallet: string;
  };
}

export interface FeesServiceConfig {
  prices: {
    [year: string]: number; // "2026": 5000, "2027": 5500, etc.
  };
}

export interface AssignmentItem {
  id: string;
  name: string;
  price: number;
}

export interface AssignmentsServiceConfig {
  serviceName: string;
  assignments: AssignmentItem[];
  paymentMethods: {
    instaPay: string;
    cashWallet: string;
  };
}

export interface CertificateField {
  name: string;
  label: string;
  type: 'text' | 'date' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface CertificateItem {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  description?: string;
  fields?: CertificateField[];
}

export interface CertificatesServiceConfig {
  certificates: CertificateItem[];
  paymentMethods: {
    instaPay: string;
    cashWallet: string;
  };
}

export interface DigitalTransformationType {
  id: string;
  name: string; // اسم المدينة أو النص المخصص
  price: number;
}

export interface DigitalTransformationConfig {
  transformationTypes: DigitalTransformationType[];
  examLanguage: string[]; // قائمة لغات الامتحان
  paymentMethods: {
    instaPay: string;
    cashWallet: string;
  };
}

export interface FinalReviewConfig {
  serviceName: string; // اسم السيكشن - يمكن تغييره من الأدمن
  paymentAmount: number; // مبلغ الدفع (500 جنيه افتراضياً)
  paymentMethods: {
    instaPay: string;
    cashWallet: string;
  };
}

export interface GraduationProjectPrice {
  id: string;
  price: number; // السعر فقط
}

export interface GraduationProjectConfig {
  serviceName: string;
  features: string[]; // المميزات
  prices: GraduationProjectPrice[]; // الأسعار المتعددة
  paymentMethods: {
    instaPay: string;
    cashWallet: string;
  };
}
