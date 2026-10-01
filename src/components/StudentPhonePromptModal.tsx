import React, { useState, useEffect, useRef } from 'react';
import { useStudent } from '../context';
import { updateStudentPhoneInAllRequestsAndProfile } from '../services/firebaseService';
import { Phone, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import '../styles/StudentPhonePromptModal.css';

const StudentPhonePromptModal: React.FC = () => {
  const { student, setStudent, isLoggedIn } = useStudent();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // تحقق مما إذا كان المستخدم مسجلاً ولديه رقم هاتف بالفعل
  const existingPhone = (student?.whatsappNumber || '').trim().replace(/\D/g, '');
  const hasPhone = existingPhone.length >= 10;

  // فحص ما إذا كان المستخدم مديراً
  const isAdmin =
    student?.fullNameArabic === 'مدير النظام' ||
    student?.vehicleNameEnglish === 'Admin';

  // التركيز التلقائي على حقل الإدخال عند الظهور
  useEffect(() => {
    if (isLoggedIn && !isAdmin && !hasPhone) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, isAdmin, hasPhone]);

  // إذا لم يكن مسجل دخول، أو كان مديراً، أو كان مسجلاً برقم هاتف مسبقاً -> لا تظهر نهائياً
  if (!isLoggedIn || !student || !student.id || isAdmin || hasPhone) {
    return null;
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhoneNumber(rawVal);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!student?.id) {
      setError('تعذر تحديد حساب الطالب، يرجى إعادة تسجيل الدخول');
      return;
    }

    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');

    // التحقق من صحة الرقم المصري
    if (!cleanPhone) {
      setError('يرجى كتابة رقم الهاتف أو الواتساب');
      return;
    }

    if (cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      setError('رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 01');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1) تحديث ملف الطالب وجميع طلبات الخدمات السابقة له في الـ Firestore
      await updateStudentPhoneInAllRequestsAndProfile(student.id, cleanPhone);

      // 2) تحديث حالة الطالب في سياق التطبيق المحلي ليختفي المودال فوراً ولا يعود للظهور
      setStudent({
        ...student,
        whatsappNumber: cleanPhone
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ أثناء حفظ الرقم، يرجى المحاولة مرة أخرى');
      setLoading(false);
    }
  };

  return (
    <div className="phone-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="phone-prompt-title">
      <div className="phone-prompt-card">
        {/* أيقونة لطيفة وصغيرة */}
        <div className="phone-prompt-badge">
          <Phone size={24} />
        </div>

        {/* عنوان ووصف مقتضب وجذاب */}
        <h2 id="phone-prompt-title" className="phone-prompt-title">
          رقم الواتساب مطلوب 📱
        </h2>
        <p className="phone-prompt-desc">
          يرجى إدخال رقم هاتفك لتأكيد حسابك ومتابعة خدماتك
        </p>

        {/* نموذج الإدخال */}
        {success ? (
          <div className="phone-prompt-success">
            <CheckCircle2 size={32} color="#10b981" />
            <span>تم حفظ وتحديث رقمك بنجاح!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="phone-prompt-form">
            <div className={`phone-input-wrapper ${error ? 'error-state' : ''}`}>
              <div className="phone-country-code">
                <span className="phone-flag" role="img" aria-label="مصر">🇪🇬</span>
                <span>+20</span>
              </div>
              <input
                ref={inputRef}
                type="tel"
                inputMode="numeric"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={phoneNumber}
                onChange={handlePhoneChange}
                maxLength={11}
                disabled={loading}
                className="phone-input-field"
                aria-label="رقم الهاتف"
              />
            </div>

            {error && (
              <div className="phone-prompt-error">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="phone-prompt-actions">
              <button
                type="submit"
                disabled={loading || phoneNumber.length < 11}
                className="phone-prompt-btn-save"
              >
                {loading ? (
                  <>
                    <div className="phone-prompt-spinner" />
                    <span>جارٍ الحفظ...</span>
                  </>
                ) : (
                  <>
                    <span>حفظ ومتابعة</span>
                    <ArrowLeft size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StudentPhonePromptModal;
