import { StudentData, ValidationError } from '../types';

export const validateArabicText = (text: string, minWords: number = 4): { valid: boolean; error?: string } => {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'هذا الحقل مطلوب' };
  }

  const arabicRegex = /^[\u0600-\u06FF\s]+$/;
  if (!arabicRegex.test(text)) {
    return { valid: false, error: 'يجب إدخال نص باللغة العربية فقط' };
  }

  const words = text.trim().split(/\s+/);
  if (words.length < minWords) {
    return { valid: false, error: `يجب أن تحتوي على ${minWords} كلمات على الأقل` };
  }

  return { valid: true };
};

export const validateEnglishText = (text: string, minWords: number = 4): { valid: boolean; error?: string } => {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'This field is required' };
  }

  const englishRegex = /^[a-zA-Z\s]+$/;
  if (!englishRegex.test(text)) {
    return { valid: false, error: 'يجب إدخال نص إنجليزي فقط' };
  }

  const words = text.trim().split(/\s+/);
  if (words.length < minWords) {
    return { valid: false, error: `يجب أن تحتوي على ${minWords} كلمات على الأقل` };
  }

  return { valid: true };
};

export const validateWhatsAppNumber = (number: string): { valid: boolean; error?: string } => {
  if (!number || number.trim().length === 0) {
    return { valid: false, error: 'هذا الحقل مطلوب' };
  }

  const digitsOnly = number.replace(/\D/g, '');
  if (digitsOnly.length !== 11) {
    return { valid: false, error: 'يجب أن يكون رقم الواتس 11 رقم' };
  }

  if (digitsOnly[0] !== '0') {
    return { valid: false, error: 'يجب أن يبدأ الرقم بصفر' };
  }

  return { valid: true };
};

export const validateNationalID = (id: string): { valid: boolean; error?: string } => {
  if (!id || id.trim().length === 0) {
    return { valid: false, error: 'هذا الحقل مطلوب' };
  }

  const digitsOnly = id.replace(/\D/g, '');
  if (digitsOnly.length !== 14) {
    return { valid: false, error: 'يجب أن يكون رقم الهوية 14 رقم' };
  }

  return { valid: true };
};

export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: 'هذا الحقل مطلوب' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };
  }

  return { valid: true };
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || password.trim().length === 0) {
    return { valid: false, error: 'هذا الحقل مطلوب' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل' };
  }

  return { valid: true };
};

export const validateStudentData = (data: Partial<StudentData>): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data.fullNameArabic) {
    errors.push({ field: 'fullNameArabic', message: 'هذا الحقل مطلوب' });
  } else {
    const nameValidation = validateArabicText(data.fullNameArabic, 4);
    if (!nameValidation.valid) {
      errors.push({ field: 'fullNameArabic', message: nameValidation.error || 'خطأ في التحقق' });
    }
  }

  if (!data.vehicleNameEnglish) {
    errors.push({ field: 'vehicleNameEnglish', message: 'This field is required' });
  } else {
    const vehicleValidation = validateEnglishText(data.vehicleNameEnglish, 4);
    if (!vehicleValidation.valid) {
      errors.push({ field: 'vehicleNameEnglish', message: vehicleValidation.error || 'Validation error' });
    }
  }

  if (!data.whatsappNumber) {
    errors.push({ field: 'whatsappNumber', message: 'هذا الحقل مطلوب' });
  } else {
    const phoneValidation = validateWhatsAppNumber(data.whatsappNumber);
    if (!phoneValidation.valid) {
      errors.push({ field: 'whatsappNumber', message: phoneValidation.error || 'خطأ في التحقق' });
    }
  }

  if (!data.diplomaYear) {
    errors.push({ field: 'diplomaYear', message: 'هذا الحقل مطلوب' });
  }

  if (!data.diplomaType) {
    errors.push({ field: 'diplomaType', message: 'هذا الحقل مطلوب' });
  }

  if (!data.nationalID) {
    errors.push({ field: 'nationalID', message: 'هذا الحقل مطلوب' });
  } else {
    const idValidation = validateNationalID(data.nationalID);
    if (!idValidation.valid) {
      errors.push({ field: 'nationalID', message: idValidation.error || 'خطأ في التحقق' });
    }
  }

  if (!data.address) {
    errors.push({ field: 'address', message: 'هذا الحقل مطلوب' });
  } else {
    if (!data.address.governorate) {
      errors.push({ field: 'address.governorate', message: 'هذا الحقل مطلوب' });
    }
    if (!data.address.city) {
      errors.push({ field: 'address.city', message: 'هذا الحقل مطلوب' });
    }
    if (!data.address.street) {
      errors.push({ field: 'address.street', message: 'هذا الحقل مطلوب' });
    }
    if (!data.address.building) {
      errors.push({ field: 'address.building', message: 'هذا الحقل مطلوب' });
    }
    if (!data.address.siteNumber) {
      errors.push({ field: 'address.siteNumber', message: 'هذا الحقل مطلوب' });
    }
  }

  if (!data.course) {
    errors.push({ field: 'course', message: 'هذا الحقل مطلوب' });
  }

  if (!data.email) {
    errors.push({ field: 'email', message: 'هذا الحقل مطلوب' });
  } else {
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.valid) {
      errors.push({ field: 'email', message: emailValidation.error || 'خطأ في التحقق' });
    }
  }

  if (!data.password) {
    errors.push({ field: 'password', message: 'هذا الحقل مطلوب' });
  } else {
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      errors.push({ field: 'password', message: passwordValidation.error || 'خطأ في التحقق' });
    }
  }

  return errors;
};
