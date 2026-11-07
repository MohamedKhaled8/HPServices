import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { StatementEnrollmentConfig } from '../../../types';
import { subscribeToStatementEnrollmentConfig, updateStatementEnrollmentConfig } from '../../../services/firebaseService';

interface StatementEnrollmentConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const StatementEnrollmentConfigTab: React.FC<StatementEnrollmentConfigTabProps> = ({ showAlert }) => {
  const [statementEnrollmentConfig, setStatementEnrollmentConfig] = useState<StatementEnrollmentConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToStatementEnrollmentConfig((config) => {
      if (config) {
        setStatementEnrollmentConfig(config);
      } else {
        const defaultConfig: StatementEnrollmentConfig = {
          serviceName: 'التقديم علي افادة و اثبات قيد',
          paymentAmount: 400,
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        };
        setStatementEnrollmentConfig(defaultConfig);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveStatementEnrollmentConfig = async () => {
    if (!statementEnrollmentConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateStatementEnrollmentConfig(statementEnrollmentConfig);
      showAlert('نجاح', 'تم حفظ إعدادات إفادة وإثبات قيد بنجاح!', 'success');
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
          <h2>إعدادات التقديم علي إفادة وإثبات قيد</h2>
          <button
            type="button"
            onClick={handleSaveStatementEnrollmentConfig}
            className="save-button"
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>

        {statementEnrollmentConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>اسم الخدمة</label>
              <input
                type="text"
                value={statementEnrollmentConfig.serviceName}
                onChange={(e) => setStatementEnrollmentConfig({ ...statementEnrollmentConfig, serviceName: e.target.value })}
                className="config-input"
                placeholder="التقديم علي افادة و اثبات قيد"
              />
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                اسم الخدمة كما يظهر للطلاب في الموقع
              </small>
            </div>

            <div className="form-group">
              <label>مبلغ الدفع (جنيه)</label>
              <input
                type="number"
                value={statementEnrollmentConfig.paymentAmount}
                onChange={(e) => setStatementEnrollmentConfig({
                  ...statementEnrollmentConfig,
                  paymentAmount: parseFloat(e.target.value) || 0
                })}
                className="config-input"
                min="0"
                step="1"
                placeholder="400"
              />
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                المبلغ المطلوب دفعه لطلب الإفادة أو إثبات القيد
              </small>
            </div>

            <div className="form-group">
              <label>أرقام الدفع والتحويل</label>
              <div className="payment-numbers">
                <div className="payment-item">
                  <label>instaPay</label>
                  <input
                    type="text"
                    value={statementEnrollmentConfig.paymentMethods?.instaPay || ''}
                    onChange={(e) => setStatementEnrollmentConfig({
                      ...statementEnrollmentConfig,
                      paymentMethods: {
                        ...statementEnrollmentConfig.paymentMethods,
                        instaPay: e.target.value
                      }
                    })}
                    className="config-input"
                    placeholder="raoufpk97@instapay"
                  />
                </div>
                <div className="payment-item">
                  <label>محفظة الكاش (فودافون كاش)</label>
                  <input
                    type="text"
                    value={statementEnrollmentConfig.paymentMethods?.cashWallet || ''}
                    onChange={(e) => setStatementEnrollmentConfig({
                      ...statementEnrollmentConfig,
                      paymentMethods: {
                        ...statementEnrollmentConfig.paymentMethods,
                        cashWallet: e.target.value
                      }
                    })}
                    className="config-input"
                    placeholder="01050889591"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatementEnrollmentConfigTab;

