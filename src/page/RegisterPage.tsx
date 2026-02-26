import React, { useState } from 'react';
import { StudentData, ValidationError } from '../types';
import { validateStudentData, validateArabicText, validateEnglishText } from '../utils/validation';
import { GOVERNORATES, DIPLOMA_YEARS, COURSES, DIPLOMA_TYPES } from '../constants/services';
import { useStudent } from '../context';
import { registerUser } from '../services/firebaseService';
import { AlertCircle, Eye, EyeOff, ChevronLeft, ChevronRight, Check, User, BookOpen, MapPin, Lock } from 'lucide-react';
import '../styles/LoginPage.css';
import '../styles/RegisterPage.css';

const STEPS = [
  { label: 'بيانات شخصية', icon: <User size={15} /> },
  { label: 'الدبلوم والشعبة', icon: <BookOpen size={15} /> },
  { label: 'العنوان والحساب', icon: <Lock size={15} /> },
];

/* ─── Password strength helper ─── */
function getStrength(pw: string): { level: number; label: string; cls: string } {
  if (!pw) return { level: 0, label: '', cls: '' };
  if (pw.length < 6) return { level: 1, label: 'ضعيفة', cls: 'weak' };
  if (pw.length < 10 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw))
    return { level: 2, label: 'متوسطة', cls: 'medium' };
  return { level: 3, label: 'قوية', cls: 'strong' };
}

const RegisterPage: React.FC<{ onRegistrationSuccess: () => void; onGoToLogin: () => void }> = ({
  onRegistrationSuccess,
  onGoToLogin,
}) => {
  const { setStudent } = useStudent();
  const [step, setStep] = useState(0); // 0, 1, 2
  const [formData, setFormData] = useState<Partial<StudentData>>({
    address: { governorate: '', city: '', street: '', building: '', siteNumber: '', landmark: '' },
  });
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [isCourseOther, setIsCourseOther] = useState(false);

  const getFieldError = (fieldName: string) =>
    errors.find((e) => e.field === fieldName)?.message;

  const handleInputChange = (field: string, value: string) => {
    if (field === 'nationalID') {
      setFormData((prev) => ({ ...prev, [field]: value, password: value }));
      setErrors((prev) => prev.filter((e) => e.field !== field && e.field !== 'password'));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => prev.filter((e) => e.field !== field));
    }
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, address: { ...prev.address!, [field]: value } }));
    setErrors((prev) => prev.filter((e) => !e.field.startsWith('address.')));
  };

  /* Step validation before advancing */
  const validateStep = (targetStep?: number): boolean => {
    const s = targetStep !== undefined ? targetStep : step;
    const stepFields: Record<number, string[]> = {
      0: ['fullNameArabic', 'vehicleNameEnglish', 'whatsappNumber', 'nationalID'],
      1: ['diplomaYear', 'diplomaType', 'course'],
      2: ['address.governorate', 'address.city', 'address.street', 'address.building', 'email', 'password'],
    };
    const allErrors: ValidationError[] = [];
    const fields = stepFields[s];

    fields.forEach((f) => {
      if (f.startsWith('address.')) {
        const key = f.split('.')[1];
        const val = (formData.address as any)?.[key];
        if (!val || val.trim() === '') allErrors.push({ field: f, message: 'هذا الحقل مطلوب' });
      } else {
        const val = (formData as any)[f];
        if (!val || (typeof val === 'string' && val.trim() === ''))
          allErrors.push({ field: f, message: 'هذا الحقل مطلوب' });
      }
    });

    // Additional validation for step 0: Arabic name must be 4 words in Arabic
    if (s === 0 && formData.fullNameArabic && formData.fullNameArabic.trim() !== '') {
      const arabicResult = validateArabicText(formData.fullNameArabic, 4);
      if (!arabicResult.valid) {
        // Remove generic error if exists, add specific one
        const idx = allErrors.findIndex(e => e.field === 'fullNameArabic');
        if (idx !== -1) allErrors.splice(idx, 1);
        allErrors.push({ field: 'fullNameArabic', message: arabicResult.error || 'يجب إدخال الاسم رباعي بالعربية' });
      }
    }

    // Additional validation for step 0: English name must be 4 words in English
    if (s === 0 && formData.vehicleNameEnglish && formData.vehicleNameEnglish.trim() !== '') {
      const englishResult = validateEnglishText(formData.vehicleNameEnglish, 4);
      if (!englishResult.valid) {
        const idx = allErrors.findIndex(e => e.field === 'vehicleNameEnglish');
        if (idx !== -1) allErrors.splice(idx, 1);
        allErrors.push({ field: 'vehicleNameEnglish', message: englishResult.error || 'يجب إدخال الاسم رباعي بالإنجليزية' });
      }
    }

    if (allErrors.length > 0) { setErrors(allErrors); return false; }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    setIsSubmitting(true);
    setSubmitError('');

    const allErrors = validateStudentData(formData as StudentData);
    if (allErrors.length > 0) {
      setErrors(allErrors);
      // Auto-navigate to the first step that has an error
      const step0Fields = ['fullNameArabic', 'vehicleNameEnglish', 'whatsappNumber', 'nationalID'];
      const step1Fields = ['diplomaYear', 'diplomaType', 'course'];
      const hasStep0Error = allErrors.some(err => step0Fields.includes(err.field));
      const hasStep1Error = allErrors.some(err => step1Fields.includes(err.field));
      if (hasStep0Error) {
        setStep(0);
        setSubmitError('يرجى مراجعة البيانات الشخصية في الخطوة الأولى');
      } else if (hasStep1Error) {
        setStep(1);
        setSubmitError('يرجى مراجعة بيانات الدبلوم في الخطوة الثانية');
      } else {
        setSubmitError('يرجى مراجعة الحقول المطلوبة');
      }
      setIsSubmitting(false);
      return;
    }

    try {
      const email = formData.email || '';
      const password = formData.password || '';
      const studentData: StudentData = {
        fullNameArabic: formData.fullNameArabic || '',
        vehicleNameEnglish: formData.vehicleNameEnglish || '',
        whatsappNumber: formData.whatsappNumber || '',
        diplomaYear: formData.diplomaYear || '',
        diplomaType: formData.diplomaType || '',
        nationalID: formData.nationalID || '',
        address: formData.address || { governorate: '', city: '', street: '', building: '', siteNumber: '' },
        course: formData.course || '',
        email,
        password,
      };
      const user = await registerUser(email, password, studentData);
      setStudent({ ...studentData, id: user.uid, createdAt: new Date().toISOString() });
      onRegistrationSuccess();
    } catch (error: any) {
      setSubmitError(error.message || 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = getStrength(formData.password || '');

  /* ─── Step 1: Personal Data ─── */
  const renderStep0 = () => (
    <div className="auth-step-content">
      <p className="auth-section-title"><User size={17} /> البيانات الشخصية</p>

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="fullNameArabic">الاسم رباعي عربي <span className="req">*</span></label>
          <input
            id="fullNameArabic" type="text" dir="rtl"
            placeholder="الاسم رباعي بالعربية"
            value={formData.fullNameArabic || ''}
            onChange={(e) => handleInputChange('fullNameArabic', e.target.value)}
            className={getFieldError('fullNameArabic') ? 'has-error' : ''}
          />
          {getFieldError('fullNameArabic') && <div className="field-error"><AlertCircle size={12} />{getFieldError('fullNameArabic')}</div>}
        </div>
        <div className="auth-field">
          <label htmlFor="vehicleNameEnglish">الاسم رباعي انجليزي <span className="req">*</span></label>
          <input
            id="vehicleNameEnglish" type="text" dir="ltr" style={{ textAlign: 'right' }}
            placeholder="Full name in English"
            value={formData.vehicleNameEnglish || ''}
            onChange={(e) => handleInputChange('vehicleNameEnglish', e.target.value)}
            className={getFieldError('vehicleNameEnglish') ? 'has-error' : ''}
          />
          {getFieldError('vehicleNameEnglish') && <div className="field-error"><AlertCircle size={12} />{getFieldError('vehicleNameEnglish')}</div>}
        </div>
      </div>

      <div className="auth-row">
        <div className="auth-field has-counter">
          <label htmlFor="whatsappNumber">رقم الواتساب <span className="req">*</span></label>
          <div className="auth-input-wrap">
            <input
              id="whatsappNumber" type="tel" inputMode="numeric"
              placeholder="01xxxxxxxxx" maxLength={11}
              value={formData.whatsappNumber || ''}
              onChange={(e) => handleInputChange('whatsappNumber', e.target.value.replace(/\D/g, ''))}
              className={getFieldError('whatsappNumber') ? 'has-error' : ''}
            />
            <span className={`auth-char-count ${formData.whatsappNumber?.length === 11 ? 'done' : ''}`}>
              {formData.whatsappNumber?.length || 0}/11
            </span>
          </div>
          {getFieldError('whatsappNumber') && <div className="field-error"><AlertCircle size={12} />{getFieldError('whatsappNumber')}</div>}
        </div>
        <div className="auth-field has-counter">
          <label htmlFor="nationalID">الرقم القومي <span className="req">*</span></label>
          <div className="auth-input-wrap">
            <input
              id="nationalID" type="tel" inputMode="numeric"
              placeholder="أدخل 14 رقم" maxLength={14}
              value={formData.nationalID || ''}
              onChange={(e) => handleInputChange('nationalID', e.target.value.replace(/\D/g, ''))}
              className={getFieldError('nationalID') ? 'has-error' : ''}
            />
            <span className={`auth-char-count ${formData.nationalID?.length === 14 ? 'done' : ''}`}>
              {formData.nationalID?.length || 0}/14
            </span>
          </div>
          {getFieldError('nationalID') && <div className="field-error"><AlertCircle size={12} />{getFieldError('nationalID')}</div>}
        </div>
      </div>
    </div>
  );

  /* ─── Step 2: Diploma & Course ─── */
  const renderStep1 = () => (
    <div className="auth-step-content">
      <p className="auth-section-title"><BookOpen size={17} /> بيانات الدبلوم والشعبة</p>

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="diplomaYear">سنة الدبلوم <span className="req">*</span></label>
          <select
            id="diplomaYear"
            value={formData.diplomaYear || ''}
            onChange={(e) => handleInputChange('diplomaYear', e.target.value)}
            className={getFieldError('diplomaYear') ? 'has-error' : ''}
          >
            <option value="">اختر السنة</option>
            {DIPLOMA_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {getFieldError('diplomaYear') && <div className="field-error"><AlertCircle size={12} />{getFieldError('diplomaYear')}</div>}
        </div>
        <div className="auth-field">
          <label htmlFor="diplomaType">نوع الدبلوم <span className="req">*</span></label>
          <select
            id="diplomaType"
            value={formData.diplomaType || ''}
            onChange={(e) => handleInputChange('diplomaType', e.target.value)}
            className={getFieldError('diplomaType') ? 'has-error' : ''}
          >
            <option value="">اختر النوع</option>
            {DIPLOMA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {getFieldError('diplomaType') && <div className="field-error"><AlertCircle size={12} />{getFieldError('diplomaType')}</div>}
        </div>
      </div>

      <div className="auth-field">
        <label htmlFor="course">الشعبة الدراسية <span className="req">*</span></label>
        <select
          id="course"
          value={isCourseOther ? 'other' : (formData.course || '')}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'other') { setIsCourseOther(true); handleInputChange('course', ''); }
            else { setIsCourseOther(false); handleInputChange('course', val); }
          }}
          className={getFieldError('course') ? 'has-error' : ''}
        >
          <option value="">اختر الشعبة الدراسية</option>
          {COURSES.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="other">أخرى</option>
        </select>
        {isCourseOther && (
          <input
            type="text"
            placeholder="اكتب اسم الشعبة"
            value={formData.course || ''}
            onChange={(e) => handleInputChange('course', e.target.value)}
            style={{ marginTop: '10px' }}
          />
        )}
        {getFieldError('course') && <div className="field-error"><AlertCircle size={12} />{getFieldError('course')}</div>}
      </div>
    </div>
  );

  /* ─── Step 3: Address + Account ─── */
  const renderStep2 = () => (
    <div className="auth-step-content">
      <p className="auth-section-title"><MapPin size={17} /> العنوان</p>

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="governorate">المحافظة <span className="req">*</span></label>
          <select
            id="governorate"
            value={formData.address?.governorate || ''}
            onChange={(e) => handleAddressChange('governorate', e.target.value)}
            className={getFieldError('address.governorate') ? 'has-error' : ''}
          >
            <option value="">اختر المحافظة</option>
            {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {getFieldError('address.governorate') && <div className="field-error"><AlertCircle size={12} />{getFieldError('address.governorate')}</div>}
        </div>
        <div className="auth-field">
          <label htmlFor="city">المدينة <span className="req">*</span></label>
          <input
            id="city" type="text" placeholder="اسم المدينة"
            value={formData.address?.city || ''}
            onChange={(e) => handleAddressChange('city', e.target.value)}
            className={getFieldError('address.city') ? 'has-error' : ''}
          />
          {getFieldError('address.city') && <div className="field-error"><AlertCircle size={12} />{getFieldError('address.city')}</div>}
        </div>
      </div>

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="street">الشارع <span className="req">*</span></label>
          <input
            id="street" type="text" placeholder="اسم الشارع"
            value={formData.address?.street || ''}
            onChange={(e) => handleAddressChange('street', e.target.value)}
            className={getFieldError('address.street') ? 'has-error' : ''}
          />
          {getFieldError('address.street') && <div className="field-error"><AlertCircle size={12} />{getFieldError('address.street')}</div>}
        </div>
        <div className="auth-field">
          <label htmlFor="building">رقم المبنى <span className="req">*</span></label>
          <input
            id="building" type="text" placeholder="رقم المبنى"
            value={formData.address?.building || ''}
            onChange={(e) => handleAddressChange('building', e.target.value)}
            className={getFieldError('address.building') ? 'has-error' : ''}
          />
          {getFieldError('address.building') && <div className="field-error"><AlertCircle size={12} />{getFieldError('address.building')}</div>}
        </div>
      </div>

      <div className="auth-field">
        <label htmlFor="landmark">معلم قريب (اختياري)</label>
        <input
          id="landmark" type="text" placeholder="مسجد، مدرسة، مستشفى..."
          value={formData.address?.landmark || ''}
          onChange={(e) => handleAddressChange('landmark', e.target.value)}
        />
      </div>

      <p className="auth-section-title" style={{ marginTop: '16px' }}><Lock size={17} /> بيانات الحساب</p>

      <div className="auth-row">
        <div className="auth-field">
          <label htmlFor="reg-email">البريد الإلكتروني <span className="req">*</span></label>
          <input
            id="reg-email" type="email" placeholder="example@email.com"
            autoComplete="off" readOnly
            onFocus={(e) => (e.currentTarget.readOnly = false)}
            value={formData.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className={getFieldError('email') ? 'has-error' : ''}
          />
          {getFieldError('email') && <div className="field-error"><AlertCircle size={12} />{getFieldError('email')}</div>}
        </div>
        <div className="auth-field">
          <label htmlFor="reg-password" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>كلمة المرور <span className="req">*</span></span>
            <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>
              تنبيه: الرقم القومي هو كلمة المرور
            </span>
          </label>
          <div className="auth-input-wrap">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="أدخل كلمة المرور"
              autoComplete="new-password" readOnly
              onFocus={(e) => (e.currentTarget.readOnly = false)}
              value={formData.password || ''}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={getFieldError('password') ? 'has-error' : ''}
            />
            <button type="button" className="auth-pass-toggle" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formData.password && (
            <>
              <div className="auth-pass-strength">
                {[1, 2, 3].map((l) => (
                  <div key={l} className={`auth-strength-bar ${strength.level >= l ? strength.cls : ''}`} />
                ))}
              </div>
              <div className={`auth-strength-label ${strength.cls}`}>{strength.label}</div>
            </>
          )}
          {getFieldError('password') && <div className="field-error"><AlertCircle size={12} />{getFieldError('password')}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      {/* ─── LEFT PANEL ─── */}
      <div className="auth-panel-left">
        <div className="auth-particles">
          {[...Array(8)].map((_, i) => <span key={i} />)}
        </div>

        <div className="auth-panel-brand">
          <div className="auth-brand-icon">🎓</div>
          <h1 className="auth-brand-title">منصة HP للخدمات التعليمية</h1>
          <p className="auth-brand-subtitle">
            انضم إلى آلاف الطلاب وأنجز خدماتك الأكاديمية بسهولة وسرعة
          </p>
        </div>

        <div className="auth-features">
          <div className="auth-feature-item">
            <span className="auth-feature-icon">📝</span>
            <div className="auth-feature-text">
              <h4>تسجيل سريع</h4>
              <p>إنشاء حسابك في دقيقتين فقط</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">🎯</span>
            <div className="auth-feature-text">
              <h4>خدمات متنوعة</h4>
              <p>استخراج الوثائق، الرسوم، التكليفات...</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">💬</span>
            <div className="auth-feature-text">
              <h4>دعم مستمر</h4>
              <p>فريق متاح للمساعدة دائماً</p>
            </div>
          </div>
        </div>

        <div className="auth-panel-quote">
          "العلم نور يضيء طريق المستقبل"
        </div>
      </div>

      {/* ─── RIGHT FORM PANEL ─── */}
      <div className="auth-panel-right">
        {/* Tab toggle */}
        <div className="auth-tabs">
          <button className="auth-tab" onClick={onGoToLogin}>تسجيل الدخول</button>
          <button className="auth-tab active">إنشاء حساب</button>
        </div>

        <div className="auth-form-header">
          <h2>إنشاء حساب جديد ✨</h2>
          <p>أكمل الخطوات الثلاث للتسجيل</p>
        </div>

        {/* Stepper */}
        <div className="auth-stepper">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`auth-step ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}
            >
              <div className="auth-step-dot">
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <span className="auth-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {submitError && (
          <div className="auth-error-alert">
            <AlertCircle size={18} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Step content */}
        <form onSubmit={handleSubmit} style={{ width: '100%' }} autoComplete="off">
          <input type="text" name="fake-name" autoComplete="name" style={{ display: 'none' }} />
          <input type="password" name="fake-pass" autoComplete="new-password" style={{ display: 'none' }} />

          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}

          <div className="auth-step-nav">
            {step > 0 && (
              <button type="button" className="auth-back-btn" onClick={() => setStep((s) => s - 1)}>
                <ChevronRight size={18} /> السابق
              </button>
            )}
            {step < 2 ? (
              <button type="button" className="auth-next-btn" onClick={nextStep}>
                التالي <ChevronLeft size={18} />
              </button>
            ) : (
              <button type="submit" className="auth-next-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><div className="spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> جاري التسجيل...</>
                ) : (
                  <><Check size={18} /> إنشاء الحساب</>
                )}
              </button>
            )}
          </div>
        </form>

        <div className="auth-switch">
          لديك حساب بالفعل؟{' '}
          <button type="button" onClick={onGoToLogin}>سجل الدخول</button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;