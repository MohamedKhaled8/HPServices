import React, { useState, useRef, useEffect } from 'react';
import { useStudent } from '../context';
import { loginOrRegisterUser, checkIsAdmin, getStudentPasswordHint, sendResetPasswordEmail } from '../services/firebaseService';
import { StudentData } from '../types';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Check,
  ArrowLeft,
  X,
  MessageCircle,
  KeyRound,
  Send,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onGoToRegister?: () => void;
  onAdminLogin?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToRegister, onAdminLogin }) => {
  const navigate = useNavigate();
  const { setStudent } = useStudent();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Forgot Password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailLoading, setResetEmailLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{
    hint: string;
    found: boolean;
    rawPassword?: string;
    email?: string;
    accountExists?: boolean;
    message?: string;
  } | null>(null);

  useEffect(() => {
    if (!showBubble) return;
    const handleClick = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowBubble(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBubble]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const getMaskedPassword = (rawPw: string) => {
    if (!rawPw) return '••••••';
    if (rawPw.length <= 3) {
      return 'xxxx' + rawPw;
    }
    const last3 = rawPw.slice(-3);
    const maskedPrefix = 'x'.repeat(Math.max(4, rawPw.length - 3));
    return `${maskedPrefix}${last3}`;
  };

  const handleOpenForgotPassword = () => {
    setForgotInput(formData.email.trim());
    setForgotResult(null);
    setResetEmailSent(false);
    setForgotModalOpen(true);
  };

  const handleCheckPasswordHint = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = forgotInput.trim();
    if (!query) {
      setForgotResult({
        hint: '',
        found: false,
        message: 'يرجى إدخال البريد الإلكتروني أو الرقم القومي أولاً',
      });
      return;
    }

    const queryLower = query.toLowerCase();
    if (queryLower === 'admin@example.com' || queryLower.startsWith('admin@') || queryLower.includes('admin')) {
      setForgotResult({
        hint: '',
        found: false,
        accountExists: false,
        email: query,
        message: 'لا يمكن استخراج تلميح لهذا الحساب لأسباب أمنية. يرجى التواصل مع إدارة النظام.',
      });
      return;
    }

    setForgotLoading(true);
    setForgotResult(null);
    setResetEmailSent(false);

    try {
      const student = await getStudentPasswordHint(query);
      if (student && student.password) {
        setForgotResult({
          hint: getMaskedPassword(student.password),
          found: true,
          rawPassword: student.password,
          email: student.email || query,
          accountExists: true,
          message: 'تم العثور على تلميح كلمة المرور بنجاح!',
        });
      } else {
        setForgotResult({
          hint: '',
          found: false,
          accountExists: Boolean(student?.accountExists || query.includes('@')),
          email: student?.email || query,
          message: student?.accountExists
            ? 'حسابك مسجل في النظام بنجاح! يمكنك إرسال رابط تعيين كلمة مرور جديدة لبريدك أو التواصل مع الدعم.'
            : 'لم نتمكن من استخراج تلميح تلقائي. يمكنك طلب رابط إعادة التعيين لبريدك أو التواصل مع الدعم الفني.',
        });
      }
    } catch (err: any) {
      setForgotResult({
        hint: '',
        found: false,
        accountExists: query.includes('@'),
        email: query,
        message: 'تعذر التحقق حالياً، يمكنك إرسال رابط إعادة التعيين لبريدك أو مراسلة الدعم.',
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    const targetEmail = forgotResult?.email || forgotInput.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('يرجى كتابة بريد إلكتروني صالح لإرسال رابط إعادة التعيين إليه');
      return;
    }
    setResetEmailLoading(true);
    try {
      await sendResetPasswordEmail(targetEmail);
      setResetEmailSent(true);
    } catch (err: any) {
      alert(err.message || 'فشل إرسال رابط التعيين');
    } finally {
      setResetEmailLoading(false);
    }
  };

  const handleApplyRecoveredPassword = () => {
    if (forgotResult?.rawPassword) {
      setFormData(prev => ({
        ...prev,
        password: forgotResult.rawPassword!,
        email: prev.email || forgotInput.trim()
      }));
      setForgotModalOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (!formData.email || !formData.password) {
      setError('يرجى إدخال البريد الإلكتروني (أو الرقم القومي) وكلمة المرور');
      setIsSubmitting(false);
      return;
    }

    try {
      const { user, studentData } = await loginOrRegisterUser(formData.email, formData.password);
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

      setStudent(studentData);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInputFilled = formData.email.trim().length > 3;

  return (
    <div className="wyf-viewport" dir="rtl">

      {/* ── Animated Background Shapes ── */}
      <div className="wyf-bg-shape wyf-bg-top-left" aria-hidden="true" />
      <div className="wyf-bg-shape wyf-bg-bottom-right" aria-hidden="true" />

      {/* Floating Bubbles */}
      <div className="wyf-bubble wyf-bubble-blue-top" aria-hidden="true" />
      <div className="wyf-bubble wyf-bubble-green-left" aria-hidden="true" />
      <div className="wyf-bubble wyf-bubble-soft-bottom" aria-hidden="true" />
      <div className="wyf-bubble wyf-bubble-mini-float" aria-hidden="true" />

      {/* Extra floating geometric shapes */}
      <div className="wyf-geo wyf-geo-ring-1" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-ring-2" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-diamond" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-triangle" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-square" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-dot-1" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-dot-2" aria-hidden="true" />
      <div className="wyf-geo wyf-geo-dot-3" aria-hidden="true" />



      {/* ── Master Card ── */}
      <div className="wyf-master-card">

        {/* ══════════════════════════════════════════════
            RIGHT: Form Side
        ══════════════════════════════════════════════ */}
        <div className="wyf-form-panel">
          <div className="wyf-hatch-corner" aria-hidden="true" />

          {/* Logo */}
          <div className="wyf-brand-logo" onClick={() => navigate('/')}>
            <div className="wyf-brand-icon-box">
              <div className="wyf-hp-logo">
                <span>HP</span>
              </div>
            </div>
            <div className="wyf-brand-text">
              <span className="wyf-brand-main">HP Services</span>
              <span className="wyf-brand-sub" style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>منصة اتش بي للخدمات التعليمية</span>
            </div>
          </div>

          {/* Heading */}
          <div className="wyf-title-group">
            <h1 className="wyf-title">تسجيل الدخول</h1>
            <p className="wyf-ar-title">أهلاً بك مجدداً! أدخل بياناتك للمتابعة إلى حسابك</p>
          </div>

          {/* Error */}
          {error && (
            <div className="wyf-error-pill" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="wyf-form">

            {/* Email Floating Field */}
            <div className={`wyf-float-field ${formData.email ? 'wyf-ff-filled' : ''}`}>
              <span className="wyf-ff-icon"><Mail size={17} /></span>
              <div className="wyf-ff-inner">
                <label htmlFor="wyf-email-field" className="wyf-ff-label">
                  البريد الإلكتروني أو الرقم القومي
                </label>
                <input
                  id="wyf-email-field"
                  type="text"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="wyf-ff-input"
                  autoComplete="username"
                  disabled={isSubmitting}
                  placeholder=""
                />
              </div>
              {isInputFilled && (
                <span className="wyf-green-check" title="تم الإدخال">
                  <Check size={13} />
                </span>
              )}
            </div>

            {/* Password Floating Field */}
            <div className={`wyf-float-field ${formData.password ? 'wyf-ff-filled' : ''}`}>
              <span className="wyf-ff-icon"><Lock size={17} /></span>
              <div className="wyf-ff-inner wyf-password-inner">
                <label htmlFor="wyf-password-field" className="wyf-ff-label">
                  كلمة المرور
                </label>
                <div className="wyf-password-box">
                  <input
                    id="wyf-password-field"
                    type="text"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`wyf-ff-input ${!showPassword ? 'wyf-star-input' : ''}`}
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    placeholder=""
                    style={{ WebkitTextSecurity: showPassword ? 'none' : 'none' } as any}
                  />
                  {!showPassword && formData.password && (
                    <div className="wyf-password-stars-overlay" aria-hidden="true">
                      {'★'.repeat(formData.password.length)}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="wyf-eye-btn"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="wyf-sub-row">
              <label className="wyf-rem-box">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="wyf-rem-check"
                />
                <span className={`wyf-rem-dot ${rememberMe ? 'active' : ''}`} />
                <span className="wyf-rem-text">تذكر بياناتي في هذا المتصفح</span>
              </label>

              <button
                type="button"
                className="wyf-forgot-trigger-btn"
                onClick={handleOpenForgotPassword}
              >
                <span>هل نسيت كلمة السر؟</span>
              </button>
            </div>

            {/* Submit */}
            <div className="wyf-btn-center">
              <button type="submit" className="wyf-pill-submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="wyf-btn-loading">
                    <span className="wyf-spinner-ring" />
                    <span>جاري التحقق والدخول...</span>
                  </span>
                ) : (
                  <span className="wyf-btn-inner">
                    <span>تسجيل الدخول</span>
                    <ArrowLeft size={16} className="wyf-arrow-icon" />
                  </span>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* ══════════════════════════════════════════════
            LEFT: Blue Promo Panel
        ══════════════════════════════════════════════ */}
        <div className="wyf-promo-panel">
          {/* Top Links */}
          <div className="wyf-promo-top-links">
            <button type="button" onClick={() => navigate('/')}>الرئيسية</button>
            <span className="wyf-link-sep">·</span>
            <button type="button" onClick={() => navigate('/about')}>عن المنصة</button>
            <span className="wyf-link-sep">·</span>
            <button type="button" onClick={() => navigate('/contact')}>الدعم الفني</button>
          </div>

          {/* Promo Content */}
          <div className="wyf-promo-content">
            <h2 className="wyf-promo-heading">مستخدم جديد؟</h2>
            <p className="wyf-promo-desc">
              HP Services منصتك الشاملة لإنجاز كل خدماتك بسهولة وسرعة، في أي وقت ومن أي مكان.
            </p>

            <div className="wyf-bubble-anchor" ref={bubbleRef}>
              <button
                type="button"
                className="wyf-promo-signup-btn"
                onClick={() => setShowBubble(b => !b)}
              >
                <span>إنشاء حساب جديد</span>
              </button>

              {showBubble && (
                <div className="wyf-speech-bubble">
                  <div className="wyf-sb-arrow" />
                  <p className="wyf-sb-text">
                    أدخل بريدك الإلكتروني وكلمة مرور من اختيارك في الحقول،
                    وسيتم إنشاء حسابك تلقائياً والدخول إليه فوراً — بدون أي خطوات إضافية! 🎉
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="wyf-promo-footer-note">
            <span>HP Services © {new Date().getFullYear()}</span>
          </div>

          {/* Blue Side Decor */}
          <div className="wyf-promo-dots" aria-hidden="true" />
          <div className="wyf-promo-stripes" aria-hidden="true" />
          <div className="wyf-promo-ghost-diamond" aria-hidden="true" />
          <div className="wyf-promo-ring-deco wyf-prd-1" aria-hidden="true" />
          <div className="wyf-promo-ring-deco wyf-prd-2" aria-hidden="true" />
        </div>

      </div>

      {/* ── Sleek & Simple Forgot Password Modal ── */}
      {forgotModalOpen && (
        <div className="wyf-simple-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div
            className="wyf-simple-card"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="wyf-simple-header">
              <div className="wyf-simple-title-group">
                <div className="wyf-simple-icon-box">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="wyf-simple-title">استعادة كلمة المرور</h3>
                  <p className="wyf-simple-subtitle">أدخل بريدك الإلكتروني أو رقمك القومي للمساعدة</p>
                </div>
              </div>
              <button
                type="button"
                className="wyf-simple-close-btn"
                onClick={() => setForgotModalOpen(false)}
                aria-label="إغلاق"
              >
                <X size={17} />
              </button>
            </div>

            {/* Input & Action */}
            <div className="wyf-simple-body">
              <div className="wyf-simple-input-wrap">
                <input
                  type="text"
                  value={forgotInput}
                  onChange={(e) => setForgotInput(e.target.value)}
                  placeholder="البريد الإلكتروني أو الرقم القومي"
                  className="wyf-simple-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCheckPasswordHint();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleCheckPasswordHint()}
                  disabled={forgotLoading || !forgotInput.trim()}
                  className="wyf-simple-submit-btn"
                >
                  {forgotLoading ? 'جاري الفحص...' : 'فحص الحساب'}
                </button>
              </div>

              {/* Result Area */}
              {forgotResult && (
                <div className="wyf-simple-result">
                  {forgotResult.found ? (
                    <div className="wyf-simple-hint-box">
                      <span className="wyf-simple-hint-label">تلميح كلمة المرور:</span>
                      <span className="wyf-simple-hint-code">{forgotResult.hint}</span>
                      <button
                        type="button"
                        onClick={handleApplyRecoveredPassword}
                        className="wyf-simple-apply-btn"
                      >
                        ✓ تعبئة كلمة المرور في الحقل
                      </button>
                    </div>
                  ) : (
                    <div className="wyf-simple-notice">
                      <p className="wyf-simple-notice-text">{forgotResult.message}</p>
                      
                      {/* Email Reset Link Button */}
                      {resetEmailSent ? (
                        <div className="wyf-simple-success-alert">
                          <CheckCircle2 size={16} />
                          <span>تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني! تفقد البريد الوارد.</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendResetEmail}
                          disabled={resetEmailLoading}
                          className="wyf-simple-email-btn"
                        >
                          <Send size={14} />
                          <span>{resetEmailLoading ? 'جاري الإرسال...' : 'إرسال رابط تعيين كلمة المرور إلى بريدي'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* WhatsApp Support Direct Button */}
              <div className="wyf-simple-support">
                <span className="wyf-simple-support-text">أو تواصل مباشرة مع الدعم الفني:</span>
                <a
                  href={`https://wa.me/201050889596?text=${encodeURIComponent('نسيت كلمه المرور واريد استراجعها')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wyf-simple-whatsapp-btn"
                >
                  <MessageCircle size={16} />
                  <span>مراسلة الدعم الفني عبر واتساب</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;