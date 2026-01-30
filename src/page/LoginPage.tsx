import React, { useState } from 'react';
import { useStudent } from '../context';
import { loginUser, getStudentData, checkIsAdmin } from '../services/firebaseService';
import { StudentData } from '../types';
import { AlertCircle } from 'lucide-react';
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

    // National ID validation if numeric
    const isNumeric = /^\d+$/.test(formData.email);
    if (isNumeric && formData.email.length !== 14) {
      setError('يجب أن يكون رقم الرقم القومي 14 رقم');
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

  const isIdentifierNumeric = /^\d+$/.test(formData.email);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logo">
            <div className="logo-icon">🎓</div>
          </div>
          <h1>منصة خدمات الطلاب</h1>
          <p>أدخل بياناتك للوصول إلى خدماتك الأكاديمية</p>
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">البريد الإلكتروني أو الرقم القومي</label>
            <div className="input-container" style={{ position: 'relative' }}>
              <input
                id="identifier"
                type="text"
                placeholder="example@example.com أو 14 رقم"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={error ? 'error' : ''}
              />
              {isIdentifierNumeric && (
                <small
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '11px',
                    color: formData.email.length === 14 ? '#10b981' : '#94a3b8',
                    fontWeight: formData.email.length === 14 ? '700' : '400',
                    background: '#f8fafc',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }}
                >
                  {formData.email.length} / 14
                </small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">كلمة المرور</label>
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
            disabled={isSubmitting || (isIdentifierNumeric && formData.email.length !== 14)}
            className="login-button"
          >
            {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>


          <div className="register-link">
            <p>ليس لديك حساب؟ <button type="button" onClick={onGoToRegister} className="link-button">سجل الآن</button></p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;