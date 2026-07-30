/**
 * Gemini Vision API Service for Document Data Extraction
 * يستخرج البيانات من صور المستندات (بطاقات هوية، شهادات تخرج، شهادات ميلاد، إلخ)
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface ExtractedField {
  label: string;
  value: string;
}

export interface ExtractedDocument {
  fileName: string;
  documentType: string;
  fields: ExtractedField[];
  rawText: string;
  confidence: string;
  thumbnailUrl?: string;
}

const EXTRACTION_PROMPT = `أنت خبير في استخراج البيانات من المستندات المصرية. حلل هذه الصورة بدقة شديدة جداً واستخرج كل البيانات الموجودة فيها.

المستند قد يكون: بطاقة رقم قومي، شهادة تخرج، شهادة ميلاد، جواز سفر، شهادة دراسية، إفادة، أو أي مستند رسمي آخر.

أعد النتيجة بتنسيق JSON فقط (بدون أي نص إضافي) بالشكل التالي:
{
  "documentType": "نوع المستند (بطاقة رقم قومي / شهادة تخرج / شهادة ميلاد / جواز سفر / شهادة دراسية / إفادة / أخرى)",
  "confidence": "نسبة الثقة (عالية / متوسطة / منخفضة)",
  "fields": [
    {"label": "الاسم الكامل", "value": "القيمة المستخرجة"},
    {"label": "الرقم القومي", "value": "القيمة المستخرجة"},
    {"label": "تاريخ الميلاد", "value": "القيمة المستخرجة"},
    {"label": "محل الميلاد", "value": "القيمة المستخرجة"},
    {"label": "العنوان", "value": "القيمة المستخرجة"},
    {"label": "النوع", "value": "القيمة المستخرجة"},
    {"label": "الديانة", "value": "القيمة المستخرجة"},
    {"label": "الحالة الاجتماعية", "value": "القيمة المستخرجة"},
    {"label": "المهنة", "value": "القيمة المستخرجة"},
    {"label": "تاريخ الإصدار", "value": "القيمة المستخرجة"},
    {"label": "تاريخ الانتهاء", "value": "القيمة المستخرجة"},
    {"label": "الجامعة", "value": "القيمة المستخرجة"},
    {"label": "الكلية", "value": "القيمة المستخرجة"},
    {"label": "القسم", "value": "القيمة المستخرجة"},
    {"label": "التقدير", "value": "القيمة المستخرجة"},
    {"label": "سنة التخرج", "value": "القيمة المستخرجة"},
    {"label": "رقم الجلوس", "value": "القيمة المستخرجة"},
    {"label": "اسم الأب", "value": "القيمة المستخرجة"},
    {"label": "اسم الأم", "value": "القيمة المستخرجة"}
  ],
  "rawText": "كل النص الظاهر في الصورة كما هو"
}

ملاحظات مهمة:
1. أضف فقط الحقول التي تحتوي على قيم فعلية (لا تضف حقول فارغة)
2. إذا وجدت بيانات إضافية غير مذكورة في القائمة أعلاه، أضفها كحقول جديدة
3. اقرأ النص بالعربية والإنجليزية
4. تأكد من دقة الأرقام خصوصاً الرقم القومي
5. أعد JSON فقط بدون أي نص قبله أو بعده`;

/**
 * تحليل صورة واحدة باستخدام Gemini Vision API
 */
export async function analyzeImage(base64Data: string, mimeType: string): Promise<{
  documentType: string;
  confidence: string;
  fields: ExtractedField[];
  rawText: string;
}> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  const response = await fetch(`${apiUrl}/api/extract-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Image: base64Data,
      mimeType: mimeType
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OCR API Error:', errorText);
    let errMsg = `فشل الاتصال بخادم الاستخراج المحلي (${response.status})`;
    try {
      const parsedError = JSON.parse(errorText);
      if (parsedError?.error) {
        errMsg = parsedError.error;
      }
    } catch (e) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  return {
    documentType: data.documentType || 'غير محدد',
    confidence: data.confidence || 'غير محدد',
    fields: data.fields || [],
    rawText: data.rawText || ''
  };
}

/**
 * قراءة ملف كـ Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * التحقق من نوع الملف المدعوم
 */
export function isSupportedFileType(file: File): boolean {
  const supportedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed'
  ];
  return supportedTypes.includes(file.type) ||
    /\.(jpg|jpeg|png|webp|gif|pdf|zip)$/i.test(file.name);
}

/**
 * التحقق من أن الملف صورة
 */
export function isImageFile(file: File | { name: string; type?: string }): boolean {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if ('type' in file && file.type) {
    return imageTypes.includes(file.type);
  }
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
}

/**
 * الحصول على MIME type من اسم الملف
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'pdf': return 'application/pdf';
    default: return 'image/jpeg';
  }
}
