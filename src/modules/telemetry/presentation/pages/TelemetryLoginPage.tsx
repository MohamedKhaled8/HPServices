import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail, ArrowRight } from 'lucide-react';
import { auth } from '../../../../config/firebase';
import { checkAdminRole } from '../../../../services/firebaseService';
import {
  checkLoginLockout,
  recordLoginFailure,
  recordLoginSuccess
} from '../../../../utils/security';
import { DeviceTelemetryParser } from '../../infrastructure/parsers/DeviceTelemetryParser';
import { authenticateTelemetryAdmin } from '../../infrastructure/repositories/HttpTelemetryRepositories';
import '../styles/telemetryDashboard.css';

interface TelemetryLoginPageProps {
  readonly onAuthenticated: () => void;
  readonly onBackToMainLogin?: () => void;
}

export const TelemetryLoginPage: React.FC<TelemetryLoginPageProps> = ({
  onAuthenticated,
  onBackToMainLogin
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور الخاصة بحساب المتابعة.');
      return;
    }

    const lockout = checkLoginLockout(`tel_${cleanEmail}`);
    if (lockout.isLocked) {
      setError(lockout.message || 'تم حظر المحاولات مؤقتاً لحماية الحساب.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const role = await checkAdminRole(cred.user.uid);

      if (role !== 'telemetry_admin') {
        await signOut(auth);
        recordLoginFailure(`tel_${cleanEmail}`);
        setError('غير مصرح: هذه البوابة مخصصة لحساب مشرف المتابعة والأمان فقط.');
        return;
      }

      const sessionId = `sess_${cred.user.uid.slice(0, 6)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        sessionStorage.setItem('hp_admin_telemetry_session_id', sessionId);
        const tokenRes = await authenticateTelemetryAdmin(
          sessionId,
          DeviceTelemetryParser.getTimezone()
        );
        sessionStorage.setItem('hp_telemetry_hmac_token', tokenRes.telemetryToken);
      } catch {
        // Non-blocking HMAC sync; Firebase custom claim still protects access
      }

      recordLoginSuccess(`tel_${cleanEmail}`);
      onAuthenticated();
    } catch (err: unknown) {
      const fail = recordLoginFailure(`tel_${cleanEmail}`);
      if (fail.isLocked) {
        setError(fail.message || 'تم الحظر المؤقت لكثرة المحاولات الخاطئة.');
      } else {
        const msg = err instanceof Error ? err.message : 'بيانات الدخول غير صحيحة';
        setError(
          msg.includes('auth/')
            ? 'بيانات الدخول غير صحيحة أو تم إلغاء صلاحية الحساب.'
            : msg
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="tel-shell tel-login-wrap"
      style={{ backgroundColor: '#050a14', color: '#f8fafc', minHeight: '100vh' }}
    >
      <motion.div
        className="tel-login-card"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <div className="tel-brand" style={{ marginBottom: 20 }}>
          <div className="tel-brand-icon">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="tel-title">بوابة المتابعة والأمان</h1>
            <p className="tel-subtitle">دخول خاص بمشرف مراقبة الأجهزة والتقارير</p>
          </div>
        </div>

        {error && (
          <div className="tel-banner error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="tel-field">
            <label htmlFor="tel-email">
              <Mail size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
              البريد الإلكتروني للمتابعة
            </label>
            <input
              id="tel-email"
              type="email"
              autoComplete="username"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hp.obs....@hp-telemetry.sec"
              required
            />
          </div>

          <div className="tel-field">
            <label htmlFor="tel-password">
              <Lock size={14} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
              كلمة المرور
            </label>
            <input
              id="tel-password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••••••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="tel-btn primary"
            style={{ width: '100%', padding: '12px 16px', marginTop: 4 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'جاري التحقق من الحساب...' : 'دخول إلى مركز المتابعة'}
          </button>
        </form>

        {onBackToMainLogin && (
          <button
            type="button"
            className="tel-btn sm"
            style={{ width: '100%', marginTop: 14 }}
            onClick={onBackToMainLogin}
          >
            <ArrowRight size={14} />
            العودة إلى صفحة تسجيل الدخول الرئيسية
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default TelemetryLoginPage;
