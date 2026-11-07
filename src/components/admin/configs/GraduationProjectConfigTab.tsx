import React, { useState, useEffect } from 'react';
import { Save, X, Trash2, Loader2 } from 'lucide-react';
import { GraduationProjectConfig, GraduationProjectPrice } from '../../../types';
import { subscribeToGraduationProjectConfig, updateGraduationProjectConfig } from '../../../services/firebaseService';

interface GraduationProjectConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const GraduationProjectConfigTab: React.FC<GraduationProjectConfigTabProps> = ({ showAlert }) => {
  const [graduationProjectConfig, setGraduationProjectConfig] = useState<GraduationProjectConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newGradProjectPriceAmount, setNewGradProjectPriceAmount] = useState<string>('');
  const [newGradProjectFeature, setNewGradProjectFeature] = useState<string>('');

  useEffect(() => {
    const unsubscribe = subscribeToGraduationProjectConfig((config) => {
      if (config) {
        setGraduationProjectConfig(config);
      } else {
        const defaultConfig: GraduationProjectConfig = {
          serviceName: 'مشروع التخرج',
          prices: [{ id: '1', price: 2000 }],
          features: ['إعداد خطة البحث كاملة', 'توفير المراجع والمصادر', 'التنسيق والطباعة'],
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        };
        setGraduationProjectConfig(defaultConfig);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveGraduationProjectConfig = async () => {
    if (!graduationProjectConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateGraduationProjectConfig(graduationProjectConfig);
      showAlert('نجاح', 'تم حفظ إعدادات مشروع التخرج بنجاح!', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddGraduationProjectPrice = () => {
    if (!graduationProjectConfig) return;
    if (!newGradProjectPriceAmount) {
      showAlert('تنبيه', 'يرجى إدخال السعر', 'warning');
      return;
    }
    const newPrice: GraduationProjectPrice = {
      id: Date.now().toString(),
      price: parseFloat(newGradProjectPriceAmount)
    };
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      prices: [...(graduationProjectConfig.prices || []), newPrice]
    });
    setNewGradProjectPriceAmount('');
  };

  const handleRemoveGraduationProjectPrice = (priceId: string) => {
    if (!graduationProjectConfig) return;
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      prices: graduationProjectConfig.prices.filter(p => p.id !== priceId)
    });
  };

  const handleAddGraduationProjectFeature = () => {
    if (!graduationProjectConfig) return;
    if (!newGradProjectFeature.trim()) {
      showAlert('تنبيه', 'يرجى إدخال الميزة', 'warning');
      return;
    }
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      features: [...(graduationProjectConfig.features || []), newGradProjectFeature.trim()]
    });
    setNewGradProjectFeature('');
  };

  const handleRemoveGraduationProjectFeature = (index: number) => {
    if (!graduationProjectConfig) return;
    const newFeatures = [...graduationProjectConfig.features];
    newFeatures.splice(index, 1);
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      features: newFeatures
    });
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
          <h2>إعدادات مشروع التخرج</h2>
          <button
            type="button"
            onClick={handleSaveGraduationProjectConfig}
            className="save-button"
            disabled={isSaving}
          >
            <Save size={18} />
            {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>

        {graduationProjectConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>اسم السيكشن</label>
              <input
                type="text"
                value={graduationProjectConfig.serviceName || ''}
                onChange={(e) => setGraduationProjectConfig({ ...graduationProjectConfig, serviceName: e.target.value })}
                className="config-input"
                placeholder="مشروع التخرج"
              />
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                يمكنك تغيير اسم الخدمة ليظهر للمستخدمين
              </small>
            </div>

            <div className="form-group">
              <label>أسعار مشروع التخرج (جنيه)</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="number"
                  value={newGradProjectPriceAmount}
                  onChange={(e) => setNewGradProjectPriceAmount(e.target.value)}
                  className="config-input"
                  placeholder="أدخل السعر بالجنيه..."
                  min="0"
                />
                <button
                  type="button"
                  onClick={handleAddGraduationProjectPrice}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  إضافة سعر
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {graduationProjectConfig.prices?.map((priceObj) => (
                  <div
                    key={priceObj.id}
                    style={{
                      backgroundColor: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>{priceObj.price} ج.م</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGraduationProjectPrice(priceObj.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>مميزات الخدمة</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={newGradProjectFeature}
                  onChange={(e) => setNewGradProjectFeature(e.target.value)}
                  className="config-input"
                  placeholder="أدخل ميزة جديدة..."
                />
                <button
                  type="button"
                  onClick={handleAddGraduationProjectFeature}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  إضافة ميزة
                </button>
              </div>

              <ul style={{ listStyleType: 'disc', paddingRight: '20px', color: '#334155' }}>
                {graduationProjectConfig.features?.map((feat, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span>{feat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGraduationProjectFeature(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="form-group">
              <label>أرقام الدفع</label>
              <div className="payment-numbers">
                <div className="payment-item">
                  <label>instaPay</label>
                  <input
                    type="text"
                    value={graduationProjectConfig.paymentMethods?.instaPay || ''}
                    onChange={(e) => setGraduationProjectConfig({
                      ...graduationProjectConfig,
                      paymentMethods: {
                        ...graduationProjectConfig.paymentMethods,
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
                    value={graduationProjectConfig.paymentMethods?.cashWallet || ''}
                    onChange={(e) => setGraduationProjectConfig({
                      ...graduationProjectConfig,
                      paymentMethods: {
                        ...graduationProjectConfig.paymentMethods,
                        cashWallet: e.target.value
                      }
                    })}
                    className="config-input"
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

export default GraduationProjectConfigTab;

