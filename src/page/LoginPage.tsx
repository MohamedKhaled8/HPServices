import React, { useState } from 'react';
import { useStudent } from '../context';
import { loginUser, getStudentData, checkIsAdmin, sendResetPasswordEmail } from '../services/firebaseService';
import { StudentData } from '../types';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft, Mail, Lock } from 'lucide-react';
import '../styles/LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
  onAdminLogin?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToRegister, onAdminLogin }) => {
  const { setStudent } = useStudent();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);

  // Forgot password
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  React.useEffect(() => {
    const hasSeenHint = localStorage.getItem('hasSeenRegisterHint');
    if (!hasSeenHint) {
      const t = setTimeout(() => setShowHint(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const closeHint = () => {
    setShowHint(false);
    localStorage.setItem('hasSeenRegisterHint', 'true');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!formData.email || !formData.password) {
      setError('يرجى ملء جميع الحقول');
      setIsSubmitting(false);
      return;
    }

    try {
      const user = await loginUser(formData.email, formData.password);
      const isAdmin = await checkIsAdmin(user.uid);

      if (isAdmin) {
        const adminStudentData: StudentData = {
          id: user.uid,
          fullNameArabic: 'مدير النظام',
          vehicleNameEnglish: 'Admin',
          whatsappNumber: '',
          diplomaYear: '',
          diplomaType: '',
          track: '',
          nationalID: '',
          address: { governorate: '', city: '', street: '', building: '', siteNumber: '' },
          course: '',
          email: user.email || formData.email,
        };
        setStudent(adminStudentData);
        if (onAdminLogin) onAdminLogin();
        else onLoginSuccess();
        return;
      }

      const studentData = await getStudentData(user.uid);
      if (studentData) {
        setStudent(studentData);
        onLoginSuccess();
      } else {
        setError('لم يتم العثور على بيانات المستخدم');
      }
    } catch (err: any) {
      setError(err.message || 'البيانات المدخلة أو كلمة المرور غير صحيحة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotError('');
    setForgotSuccess(false);
    try {
      await sendResetPasswordEmail(forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* ─── LEFT DECORATIVE PANEL ─── */}
      <div className="auth-panel-left">
        <div className="auth-particles">
          {[...Array(8)].map((_, i) => <span key={i} />)}
        </div>

        <div className="auth-panel-brand">
          <div className="auth-brand-icon">🎓</div>
          <h1 className="auth-brand-title">منصة HP للخدمات التعليمية</h1>
          <p className="auth-brand-subtitle">
            بوابتك الشاملة لإنجاز جميع خدماتك الأكاديمية بسهولة وسرعة
          </p>
        </div>

        <div className="auth-features">
          <div className="auth-feature-item">
            <span className="auth-feature-icon">⚡</span>
            <div className="auth-feature-text">
              <h4>خدمات فورية</h4>
              <p>أنجز طلباتك في دقائق معدودة</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">🔒</span>
            <div className="auth-feature-text">
              <h4>بيانات محمية</h4>
              <p>خصوصيتك وأمانك أولويتنا دائماً</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">📋</span>
            <div className="auth-feature-text">
              <h4>تتبع الطلبات</h4>
              <p>راقب حالة طلباتك لحظة بلحظة</p>
            </div>
          </div>
        </div>

        <div className="auth-panel-quote">
          "طلب العلم فريضة على كل مسلم"
        </div>
      </div>

      {/* ─── RIGHT FORM PANEL ─── */}
      <div className="auth-panel-right">
        {/* Tab toggle */}
        <div className="auth-tabs">
          <button className="auth-tab active">تسجيل الدخول</button>
          <button className="auth-tab" onClick={onGoToRegister}>إنشاء حساب</button>
        </div>

        <div className="auth-form-header">
          <h2>أهلاً بعودتك 👋</h2>
          <p>أدخل بياناتك للوصول إلى حسابك</p>
        </div>

        {error && (
          <div className="auth-error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          {/* Email */}
          <div className="auth-field">
            <label htmlFor="login-email">
              البريد الإلكتروني <span className="req">*</span>
            </label>
            <div className="auth-input-wrap" style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                placeholder="example@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={error ? 'has-error' : ''}
                style={{ paddingRight: '44px' }}
              />
              <span style={{
                position: 'absolute', right: '14px', top: '50%',
                transform: 'translateY(-50%)', color: '#94a3b8'
              }}>
                <Mail size={18} />
              </span>
            </div>
          </div>

          {/* Password */}
          <div className="auth-field">
            <div className="auth-forgot-row">
              <label htmlFor="login-password">
                كلمة المرور <span className="req">*</span>
              </label>
              <button
                type="button"
                className="auth-forgot"
                onClick={() => { setShowForgotModal(true); setForgotSuccess(false); setForgotError(''); setForgotEmail(''); }}
              >
                نسيت كلمة المرور؟
              </button>
            </div>
            <div className="auth-input-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="أدخل كلمة المرور"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={error ? 'has-error' : ''}
              />
              <button type="button" className="auth-pass-toggle" onClick={() => setShowPassword(p => !p)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <><div className="spinner" /> جاري تسجيل الدخول...</>
            ) : (
              <><ArrowLeft size={18} /> تسجيل الدخول</>
            )}
          </button>
        </form>

        <div className="auth-switch">
          ليس لديك حساب؟{' '}
          <button type="button" onClick={onGoToRegister}>اشترك معنا الآن</button>
        </div>
      </div>

      {/* ─── HINT MODAL ─── */}
      <div className={`auth-hint-overlay ${showHint ? 'show' : ''}`} onClick={closeHint}>
        <div className="auth-hint-card" onClick={e => e.stopPropagation()}>
          <span className="auth-hint-emoji">✨</span>
          <h2>أهلاً بك في منصتنا!</h2>
          <p>هل أنت طالب جديد؟ انضم إلينا الآن لتصل إلى كافة خدماتك الدراسية بسهولة وسرعة.</p>
          <button className="auth-hint-register" onClick={() => { closeHint(); onGoToRegister(); }}>
            إنشاء حساب جديد
          </button>
          <button className="auth-hint-close" onClick={closeHint}>تسجيل الدخول</button>
        </div>
      </div>

      {/* ─── FORGOT PASSWORD MODAL ─── */}
      {showForgotModal && (
        <div className="auth-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="auth-modal" onClick={e => e.stopPropagation()}>
            {forgotSuccess ? (
              <div className="auth-modal-success">
                <div className="success-icon">
                  <CheckCircle size={32} color="#166534" />
                </div>
                <h4>تم الإرسال بنجاح!</h4>
                <p>تحقق من بريدك الإلكتروني لإنشاء كلمة مرور جديدة.</p>
                <div className="auth-modal-actions" style={{ justifyContent: 'center' }}>
                  <button className="auth-modal-cancel" onClick={() => setShowForgotModal(false)}>إغلاق</button>
                </div>
              </div>
            ) : (
              <>
                <h3>استعادة كلمة المرور 🔑</h3>
                <p>أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور فوراً.</p>
                <form onSubmit={handleForgotPassword}>
                  <div className="auth-field">
                    <label htmlFor="forgot-email">البريد الإلكتروني</label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="example@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                  {forgotError && (
                    <div className="auth-error-alert" style={{ marginBottom: '12px' }}>
                      <AlertCircle size={16} />
                      <span>{forgotError}</span>
                    </div>
                  )}
                  <div className="auth-modal-actions">
                    <button type="button" className="auth-modal-cancel" onClick={() => setShowForgotModal(false)}>إلغاء</button>
                    <button type="submit" className="auth-modal-send" disabled={forgotLoading}>
                      {forgotLoading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> إرسال...</> : 'إرسال الرابط'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;