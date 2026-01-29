import React, { useState } from 'react';
import { StudentData, ValidationError } from '../types';
import { validateStudentData } from '../utils/validation';
import { GOVERNORATES, DIPLOMA_YEARS, COURSES, DIPLOMA_TYPES } from '../constants/services';
import { useStudent } from '../context';
import { registerUser } from '../services/firebaseService';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import '../styles/RegisterPage.css';

const RegisterPage: React.FC<{ onRegistrationSuccess: () => void; onGoToLogin: () => void }> = ({ onRegistrationSuccess, onGoToLogin }) => {
  const { setStudent } = useStudent();
  const [formData, setFormData] = useState<Partial<StudentData>>({
    address: {
      governorate: '',
      city: '',
      street: '',
      building: '',
      siteNumber: '',
      landmark: ''
    }
  });

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getFieldError = (fieldName: string): string | undefined => {
    return errors.find(e => e.field === fieldName)?.message;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field when user starts typing
    setErrors(prev => prev.filter(e => e.field !== field));
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address!,
        [field]: value
      }
    }));
    setErrors(prev => prev.filter(e => !e.field.startsWith('address.')));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    const validationErrors = validateStudentData(formData as StudentData);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const email = formData.email || '';
      const password = formData.password || '';

      if (!email || !password) {
        setSubmitError('البريد الإلكتروني وكلمة المرور مطلوبان');
        setIsSubmitting(false);
        return;
      }

      const studentData: StudentData = {
        fullNameArabic: formData.fullNameArabic || '',
        vehicleNameEnglish: formData.vehicleNameEnglish || '',
        whatsappNumber: formData.whatsappNumber || '',
        diplomaYear: formData.diplomaYear || '',
        diplomaType: formData.diplomaType || '',
        nationalID: formData.nationalID || '',
        address: formData.address || {
          governorate: '',
          city: '',
          street: '',
          building: '',
          siteNumber: '',
          landmark: ''
        },
        course: formData.course || '',
        email: email,
        password: password
      };

      // Register with Firebase
      const user = await registerUser(email, password, studentData);

      // Get the saved student data with the ID from Firebase
      const savedStudentData: StudentData = {
        ...studentData,
        id: user.uid,
        createdAt: new Date().toISOString()
      };

      setStudent(savedStudentData);
      onRegistrationSuccess();
    } catch (error: any) {
      setSubmitError(error.message || 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <div className="logo">
            <div className="logo-icon">🎓</div>
          </div>
          <h1>التسجيل في منصة خدمات الطلاب</h1>
          <p>املأ البيانات المطلوبة لبدء رحلتك الأكاديمية</p>
        </div>

        {submitError && (
          <div className="error-alert">
            <AlertCircle size={20} />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="register-form" autoComplete="off">
          {/* hidden dummy fields to prevent browser autofill */}
          <input type="text" name="fake-username" autoComplete="username" style={{ position: 'absolute', left: '-9999px', top: '0', opacity: 0 }} />
          <input type="password" name="fake-password" autoComplete="new-password" style={{ position: 'absolute', left: '-9999px', top: '0', opacity: 0 }} />
          <div className="form-section">
            <h2>البيانات الشخصية</h2>

            <div className="form-group">
              <label htmlFor="fullNameArabic">الاسم الكامل (عربي) *</label>
              <input
                id="fullNameArabic"
                type="text"
                dir="rtl"
                placeholder="أدخل اسمك الكامل بالعربية"
                value={formData.fullNameArabic || ''}
                onChange={(e) => handleInputChange('fullNameArabic', e.target.value)}
                className={getFieldError('fullNameArabic') ? 'error' : ''}
              />
              {getFieldError('fullNameArabic') && (
                <span className="error-message">{getFieldError('fullNameArabic')}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="vehicleNameEnglish">Vehicle Name (English) *</label>
              <input
                id="vehicleNameEnglish"
                type="text"
                dir="ltr"
                placeholder="Enter vehicle name in English"
                value={formData.vehicleNameEnglish || ''}
                onChange={(e) => handleInputChange('vehicleNameEnglish', e.target.value)}
                className={getFieldError('vehicleNameEnglish') ? 'error' : ''}
              />
              {getFieldError('vehicleNameEnglish') && (
                <span className="error-message">{getFieldError('vehicleNameEnglish')}</span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="whatsappNumber">رقم الواتس *</label>
                <input
                  id="whatsappNumber"
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={formData.whatsappNumber || ''}
                  onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                  className={getFieldError('whatsappNumber') ? 'error' : ''}
                />
                {getFieldError('whatsappNumber') && (
                  <span className="error-message">{getFieldError('whatsappNumber')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="nationalID">رقم الهوية *</label>
                <input
                  id="nationalID"
                  type="text"
                  placeholder="14 رقم"
                  value={formData.nationalID || ''}
                  onChange={(e) => handleInputChange('nationalID', e.target.value)}
                  className={getFieldError('nationalID') ? 'error' : ''}
                />
                {getFieldError('nationalID') && (
                  <span className="error-message">{getFieldError('nationalID')}</span>
                )}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>بيانات الدبلوم</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="diplomaYear">سنة الدبلوم *</label>
                <select
                  id="diplomaYear"
                  value={formData.diplomaYear || ''}
                  onChange={(e) => handleInputChange('diplomaYear', e.target.value)}
                  className={getFieldError('diplomaYear') ? 'error' : ''}
                >
                  <option value="">اختر السنة</option>
                  {DIPLOMA_YEARS.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {getFieldError('diplomaYear') && (
                  <span className="error-message">{getFieldError('diplomaYear')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="diplomaType">نوع الدبلوم *</label>
                <select
                  id="diplomaType"
                  value={formData.diplomaType || ''}
                  onChange={(e) => handleInputChange('diplomaType', e.target.value)}
                  className={getFieldError('diplomaType') ? 'error' : ''}
                >
                  <option value="">اختر نوع الدبلوم</option>
                  {DIPLOMA_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {getFieldError('diplomaType') && (
                  <span className="error-message">{getFieldError('diplomaType')}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="course">المقرر *</label>
              <select
                id="course"
                value={formData.course || ''}
                onChange={(e) => handleInputChange('course', e.target.value as any)}
                className={getFieldError('course') ? 'error' : ''}
              >
                <option value="">اختر المقرر</option>
                {COURSES.map(course => (
                  <option key={course} value={course}>{course}</option>
                ))}
              </select>
              {getFieldError('course') && (
                <span className="error-message">{getFieldError('course')}</span>
              )}
            </div>
          </div>

          <div className="form-section">
            <h2>العنوان</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="governorate">المحافظة *</label>
                <select
                  id="governorate"
                  value={formData.address?.governorate || ''}
                  onChange={(e) => handleAddressChange('governorate', e.target.value)}
                  className={getFieldError('address.governorate') ? 'error' : ''}
                >
                  <option value="">اختر المحافظة</option>
                  {GOVERNORATES.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
                {getFieldError('address.governorate') && (
                  <span className="error-message">{getFieldError('address.governorate')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="city">المدينة *</label>
                <input
                  id="city"
                  type="text"
                  placeholder="اسم المدينة أو السوق"
                  value={formData.address?.city || ''}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  className={getFieldError('address.city') ? 'error' : ''}
                />
                {getFieldError('address.city') && (
                  <span className="error-message">{getFieldError('address.city')}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="street">الشارع *</label>
                <input
                  id="street"
                  type="text"
                  placeholder="اسم الشارع"
                  value={formData.address?.street || ''}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                  className={getFieldError('address.street') ? 'error' : ''}
                />
                {getFieldError('address.street') && (
                  <span className="error-message">{getFieldError('address.street')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="building">رقم المبنى/المنزل *</label>
                <input
                  id="building"
                  type="text"
                  placeholder="رقم المبنى"
                  value={formData.address?.building || ''}
                  onChange={(e) => handleAddressChange('building', e.target.value)}
                  className={getFieldError('address.building') ? 'error' : ''}
                />
                {getFieldError('address.building') && (
                  <span className="error-message">{getFieldError('address.building')}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="siteNumber">رقم الموقع *</label>
                <input
                  id="siteNumber"
                  type="text"
                  placeholder="رقم الموقع"
                  value={formData.address?.siteNumber || ''}
                  onChange={(e) => handleAddressChange('siteNumber', e.target.value)}
                  className={getFieldError('address.siteNumber') ? 'error' : ''}
                />
                {getFieldError('address.siteNumber') && (
                  <span className="error-message">{getFieldError('address.siteNumber')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="landmark">معلم قريب (اختياري)</label>
                <input
                  id="landmark"
                  type="text"
                  placeholder="مسجد، مدرسة، مستشفى..."
                  value={formData.address?.landmark || ''}
                  onChange={(e) => handleAddressChange('landmark', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>بيانات الحساب</h2>

            <div className="form-group">
              <label htmlFor="email">البريد الإلكتروني *</label>
              <input
                id="email"
                name="register-email"
                type="email"
                placeholder="example@example.com"
                autoComplete="off"
                readOnly={true}
                onFocus={(e) => (e.currentTarget.readOnly = false)}
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={getFieldError('email') ? 'error' : ''}
              />
              {getFieldError('email') && (
                <span className="error-message">{getFieldError('email')}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">كلمة المرور *</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  name="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="أدخل كلمة المرور"
                  autoComplete="new-password"
                  readOnly={true}
                  onFocus={(e) => (e.currentTarget.readOnly = false)}
                  value={formData.password || ''}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={getFieldError('password') ? 'error' : ''}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {getFieldError('password') && (
                <span className="error-message">{getFieldError('password')}</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || errors.length > 0}
            className="submit-button"
          >
            {isSubmitting ? 'جاري التسجيل...' : 'التسجيل'}
          </button>

          <div className="login-link">
            <p>لديك حساب بالفعل؟ <button type="button" onClick={onGoToLogin} className="link-button">سجل الدخول</button></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
