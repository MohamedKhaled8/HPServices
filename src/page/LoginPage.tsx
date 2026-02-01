import React, { useState } from 'react';
import { useStudent } from '../context';
import { loginUser, getStudentData, checkIsAdmin, sendResetPasswordEmail } from '../services/firebaseService';
import { StudentData } from '../types';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import '../styles/LoginPage.css';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onGoToRegister: () => void;
  onAdminLogin?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onGoToRegister, onAdminLogin }) => {
  const { setStudent } = useStudent();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Show hint on first load
  React.useEffect(() => {
    const hasSeenHint = localStorage.getItem('hasSeenRegisterHint');
    if (!hasSeenHint) {
      const timer = setTimeout(() => {
        setShowHint(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const closeHint = () => {
    setShowHint(false);
    localStorage.setItem('hasSeenRegisterHint', 'true');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    // Simple validation
    if (!formData.email || !formData.password) {
      setError('يرجى ملء جميع الحقول');
      setIsSubmitting(false);
      return;
    }

    try {
      // Login with Firebase (identifier can be email or nationalID)
      const user = await loginUser(formData.email, formData.password);

      // Check if user is admin
      const isAdmin = await checkIsAdmin(user.uid);
      if (isAdmin) {
        // Create temporary admin student data
        const adminStudentData: StudentData = {
          id: user.uid,
          fullNameArabic: 'مدير النظام',
          vehicleNameEnglish: 'Admin',
          whatsappNumber: '',
          diplomaYear: '',
          diplomaType: '',
          track: '',
          nationalID: '',
          address: {
            governorate: '',
            city: '',
            street: '',
            building: '',
            siteNumber: ''
          },
          course: '',
          email: user.email || formData.email
        };
        setStudent(adminStudentData);
        if (onAdminLogin) {
          onAdminLogin();
        } else {
          onLoginSuccess();
        }
        return;
      }

      // Get student data from Firestore
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
      // Don't close immediately, let them see the success message
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logo">
            <div className="logo-icon">🎓</div>
          </div>
          <h1>منصة HP للخدمات التعليمية</h1>
          <p>أدخل بريدك الإلكتروني للوصول إلى خدماتك الأكاديمية</p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">البريد الإلكتروني</label>
            <div className="input-container" style={{ position: 'relative' }}>
              <input
                id="identifier"
                type="email"
                placeholder="example@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={error ? 'error' : ''}
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password">كلمة المرور</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
              >
                نسيت كلمة المرور؟
              </button>
            </div>
            <input
              id="password"
              type="password"
              placeholder="أدخل كلمة المرور"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={error ? 'error' : ''}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="login-button"
          >
            {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>


          <div className="register-link">
            <p>ليس لديك حساب؟ <button type="button" onClick={onGoToRegister} className="link-button highlight">اشترك معنا</button></p>
          </div>
        </form>
      </div>

      {/* Registration Hint Sheet */}
      <div className={`registration-hint-overlay ${showHint ? 'show' : ''}`} onClick={closeHint}>
        <div className={`registration-hint-sheet ${showHint ? 'show' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="hint-handle"></div>
          <div className="hint-content">
            <div className="hint-icon">✨</div>
            <h2>أهلاً بك في منصتنا!</h2>
            <p>هل أنت طالب جديد؟ انضم إلينا الآن لتصل إلى كافة خدماتك الدراسية بسهولة وسرعة.</p>
            <button
              className="hint-register-btn"
              onClick={() => {
                closeHint();
                onGoToRegister();
              }}
            >
              اشترك معنا الآن
            </button>
            <button className="hint-close-btn" onClick={closeHint}>اضغط لتسجل دخولك</button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setShowForgotModal(false)}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '16px',
            width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            direction: 'rtl'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>استعادة كلمة المرور</h3>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
              أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور الخاصة بك.
            </p>

            {forgotSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '50px', height: '50px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                  <CheckCircle size={28} color="#166534" />
                </div>
                <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>تم الإرسال بنجاح!</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>تحقق من بريدك الإلكتروني لإنشاء كلمة مرور جديدة.</p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  style={{ marginTop: '20px', padding: '8px 20px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#334155' }}
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#334155', fontWeight: '500' }}>البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="example@email.com"
                    style={{
                      width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                {forgotError && (
                  <div style={{ background: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    {forgotError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    style={{ padding: '10px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      padding: '10px 24px', background: '#2563eb', border: 'none', borderRadius: '8px', cursor: forgotLoading ? 'not-allowed' : 'pointer', color: 'white', fontWeight: 'bold',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    {forgotLoading ? 'جاري الإرسال...' : <>إرسال <ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;