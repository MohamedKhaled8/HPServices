import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { FinalReviewConfig } from '../../../types';
import { subscribeToFinalReviewConfig, updateFinalReviewConfig } from '../../../services/firebaseService';

interface FinalReviewConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const FinalReviewConfigTab: React.FC<FinalReviewConfigTabProps> = ({ showAlert }) => {
  const [finalReviewConfig, setFinalReviewConfig] = useState<FinalReviewConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToFinalReviewConfig((config) => {
      if (config) {
        setFinalReviewConfig(config);
      } else {
        const defaultConfig: FinalReviewConfig = {
          serviceName: 'المراجعة النهائية',
          paymentAmount: 500,
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        };
        setFinalReviewConfig(defaultConfig);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveFinalReviewConfig = async () => {
    if (!finalReviewConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateFinalReviewConfig(finalReviewConfig);
      showAlert('نجاح', 'تم حفظ إعدادات المراجعة النهائية بنجاح!', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="admin-content">
      <div className="books-section">
        <div className="section-header">
          <h2>إعدادات المراجعة النهائية</h2>
          <button type="button" onClick={handleSaveFinalReviewConfig} className="save-button" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>

        {finalReviewConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>اسم السيكشن</label>
              <input
                type="text"
                value={finalReviewConfig.serviceName}
                onChange={(e) => setFinalReviewConfig({ ...finalReviewConfig, serviceName: e.target.value })}
                className="config-input"
                placeholder="المراجعة النهائية"
              />
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                يمكنك تغيير اسم السيكشن ليظهر للمستخدمين
              </small>
            </div>

            <div className="form-group">
              <label>مبلغ الدفع (جنيه)</label>
              <input
                type="number"
                value={finalReviewConfig.paymentAmount}
                onChange={(e) => setFinalReviewConfig({
                  ...finalReviewConfig,
                  paymentAmount: parseFloat(e.target.value) || 0
                })}
                className="config-input"
                min="0"
                step="0.01"
                placeholder="500"
              />
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                المبلغ المطلوب دفعه للمراجعة النهائية
              </small>
            </div>

            <div className="form-group">
              <label>أرقام الدفع</label>
              <div className="payment-numbers">
                <div className="payment-item">
                  <label>instaPay</label>
                  <input
                    type="text"
                    value={finalReviewConfig.paymentMethods.instaPay}
                    onChange={(e) => setFinalReviewConfig({
                      ...finalReviewConfig,
                      paymentMethods: {
                        ...finalReviewConfig.paymentMethods,
                        instaPay: e.target.value
                      }
                    })}
                    className="config-input"
                  />
                </div>
                <div className="payment-item">
                  <label>محفظة الكاش</label>
                  <input
                    type="text"
                    value={finalReviewConfig.paymentMethods.cashWallet}
                    onChange={(e) => setFinalReviewConfig({
                      ...finalReviewConfig,
                      paymentMethods: {
                        ...finalReviewConfig.paymentMethods,
                        cashWallet: e.target.value
                      }
                    })}
                    className="config-input"
                  />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                البيانات المطلوبة من المستخدم
              </h3>
              <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#ef4444' }}>*</span>
                  <span>الاسم الرباعي</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#ef4444' }}>*</span>
                  <span>رقم هاتف (واتس اب)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#ef4444' }}>*</span>
                  <span>المسار</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#ef4444' }}>*</span>
                  <span>العنوان</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ color: '#10b981' }}>✓</span>
                  <span>رفع إيصال الدفع</span>
                </div>
              </div>
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '12px', display: 'block' }}>
                هذه البيانات ثابتة ويتم جمعها تلقائياً من المستخدم عند التقديم
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinalReviewConfigTab;

