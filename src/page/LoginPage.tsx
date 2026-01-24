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

    try {
      // Login with Firebase
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
      setError(err.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              placeholder="example@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={error ? 'error' : ''}
            />
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
            disabled={isSubmitting}
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