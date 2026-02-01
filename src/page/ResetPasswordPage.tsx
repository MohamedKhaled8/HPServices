import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyResetCode, completePasswordReset } from '../services/firebaseService';
import { CheckCircle, AlertCircle, Lock, ArrowRight } from 'lucide-react';
import '../styles/DashboardPage.css'; // Reuse existing styles

const ResetPasswordPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const oobCode = searchParams.get('oobCode');

    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 1. Verify Code on Mount
    useEffect(() => {
        if (!oobCode) {
            setError('رابط استعادة كلمة المرور غير صالح.');
            setIsLoading(false);
            return;
        }

        const verify = async () => {
            try {
                const userEmail = await verifyResetCode(oobCode);
                setEmail(userEmail);
                setIsLoading(false);
            } catch (err: any) {
                setError(err.message || 'الرابط غير صالح أو منتهي الصلاحية.');
                setIsLoading(false);
            }
        };

        verify();
    }, [oobCode]);

    // 2. Handle Save
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!oobCode || !email) return;

        setError('');

        if (newPassword !== confirmPassword) {
            setError('كلمة المرور الجديدة غير متطابقة.');
            return;
        }

        if (newPassword.length < 6) {
            setError('يجب أن لا تقل كلمة المرور عن 6 أحرف.');
            return;
        }

        setIsSaving(true);

        try {
            await completePasswordReset(oobCode, newPassword, email);
            setSuccess('تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.');
            setTimeout(() => {
                navigate('/'); // Redirect to login
            }, 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="reset-page" style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc'
            }}>
                <div>جاري التحقق من الرابط...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="reset-page" style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc'
            }}>
                <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 20px' }} />
                    <h2 style={{ color: '#1e293b', marginBottom: '10px' }}>خطأ في الرابط</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{error}</p>
                    <button onClick={() => navigate('/')} style={{
                        padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'
                    }}>
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="reset-page" style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc'
            }}>
                <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    <CheckCircle size={48} color="#166534" style={{ margin: '0 auto 20px' }} />
                    <h2 style={{ color: '#1e293b', marginBottom: '10px' }}>تم بنجاح!</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{success}</p>
                    <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>سيتم تحويلك لصفحة الدخول...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="reset-page" style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px'
        }}>
            <div style={{
                background: 'white', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '450px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)', direction: 'rtl'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{ width: '60px', height: '60px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
                        <Lock size={30} color="#2563eb" />
                    </div>
                    <h2 style={{ margin: 0, color: '#1e293b' }}>إعادة تعيين كلمة المرور</h2>
                    <p style={{ marginTop: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                        للحساب المرتبط بـ: <strong>{email}</strong>
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#334155' }}>كلمة المرور الجديدة</label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="أدخل كلمة المرور الجديدة"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px' }}
                        />
                    </div>

                    <div style={{ marginBottom: '25px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#334155' }}>تأكيد كلمة المرور</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="أعد إدخال كلمة المرور"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        style={{
                            width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px',
                            fontSize: '16px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        {isSaving ? 'جاري الحفظ...' : (
                            <>
                                حفظ التغييرات <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
