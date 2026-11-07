import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { FeesServiceConfig } from '../../../types';
import { subscribeToFeesServiceConfig, updateFeesServiceConfig } from '../../../services/firebaseService';

interface FeesConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const FeesConfigTab: React.FC<FeesConfigTabProps> = ({ showAlert }) => {
  const [feesConfig, setFeesConfig] = useState<FeesServiceConfig | null>(null);
  const [isEditingFees, setIsEditingFees] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newFeeYear, setNewFeeYear] = useState<string>('');
  const [newFeeAmount, setNewFeeAmount] = useState<string>('');

  useEffect(() => {
    const unsubscribe = subscribeToFeesServiceConfig((config) => {
      if (config) {
        setFeesConfig(config);
      } else {
        setFeesConfig({ prices: {}, paymentMethods: { instaPay: '', cashWallet: '01050889591' } });
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveFeesConfig = async () => {
    if (!feesConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateFeesServiceConfig(feesConfig);
      setIsEditingFees(false);
      showAlert('نجاح', 'تم حفظ إعدادات المصروفات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFeeYear = () => {
    if (!newFeeYear || !newFeeAmount || !feesConfig) return;
    const amount = parseFloat(newFeeAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('تنبيه', 'يرجى إدخال مبلغ صحيح', 'warning');
      return;
    }
    setFeesConfig({
      ...feesConfig,
      prices: {
        ...feesConfig.prices,
        [newFeeYear]: amount
      }
    });
    setNewFeeYear('');
    setNewFeeAmount('');
  };

  const handleRemoveFeeYear = (year: string) => {
    if (!feesConfig) return;
    const newPrices = { ...feesConfig.prices };
    delete newPrices[year];
    setFeesConfig({
      ...feesConfig,
      prices: newPrices
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
          <h2>مصروفات السنة الدراسية للدبلومة</h2>
          <div className="edit-actions">
            {!isEditingFees ? (
              <button type="button" onClick={() => setIsEditingFees(true)} className="edit-button">
                <Edit2 size={18} />
                تعديل
              </button>
            ) : (
              <>
                <button type="button" onClick={handleSaveFeesConfig} className="save-button" disabled={isSaving}>
                  <Save size={18} />
                  {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button type="button" onClick={() => setIsEditingFees(false)} className="cancel-edit-button">
                  <X size={18} />
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>

        {feesConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>أسعار المصروفات حسب السنة الدراسية</label>
              <div className="prices-grid">
                {Object.entries(feesConfig.prices)
                  .sort(([a], [b]) => parseInt(b) - parseInt(a))
                  .map(([year, price]) => (
                    <div key={year} className="price-item">
                      <label>{year}</label>
                      {isEditingFees ? (
                        <div className="price-item-edit">
                          <input
                            type="number"
                            value={price}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value);
                              if (!isNaN(newPrice) && newPrice >= 0) {
                                setFeesConfig({
                                  ...feesConfig,
                                  prices: {
                                    ...feesConfig.prices,
                                    [year]: newPrice
                                  }
                                });
                              }
                            }}
                            className="price-input"
                            min="0"
                            step="0.01"
                          />
                          <button
                            onClick={() => handleRemoveFeeYear(year)}
                            className="remove-price-button"
                            title="حذف"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="price-display-bubble">{price} جنيه</div>
                      )}
                    </div>
                  ))}
              </div>

              {isEditingFees && (
                <div className="add-price-section">
                  <div className="add-price-form">
                    <input
                      type="text"
                      placeholder="السنة الدراسية (مثال: 2026)"
                      value={newFeeYear}
                      onChange={(e) => setNewFeeYear(e.target.value)}
                      className="config-input"
                      style={{ width: '200px' }}
                    />
                    <input
                      type="number"
                      placeholder="المبلغ بالجنيه"
                      value={newFeeAmount}
                      onChange={(e) => setNewFeeAmount(e.target.value)}
                      className="config-input"
                      style={{ width: '200px' }}
                      min="0"
                      step="0.01"
                    />
                    <button onClick={handleAddFeeYear} className="add-price-button">
                      إضافة
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>أرقام الدفع</label>
              <div className="payment-numbers">
                <div className="payment-item">
                  <label>instaPay</label>
                  {isEditingFees ? (
                    <input
                      type="text"
                      value={feesConfig.paymentMethods?.instaPay || ''}
                      onChange={(e) => setFeesConfig({
                        ...feesConfig,
                        paymentMethods: {
                          ...feesConfig.paymentMethods,
                          instaPay: e.target.value
                        }
                      })}
                      className="config-input"
                    />
                  ) : (
                    <div className="config-display">{feesConfig.paymentMethods?.instaPay || 'غير محدد'}</div>
                  )}
                </div>
                <div className="payment-item">
                  <label>محفظة الكاش</label>
                  {isEditingFees ? (
                    <input
                      type="text"
                      value={feesConfig.paymentMethods?.cashWallet || ''}
                      onChange={(e) => setFeesConfig({
                        ...feesConfig,
                        paymentMethods: {
                          ...feesConfig.paymentMethods,
                          cashWallet: e.target.value
                        }
                      })}
                      className="config-input"
                    />
                  ) : (
                    <div className="config-display">{feesConfig.paymentMethods?.cashWallet || 'غير محدد'}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeesConfigTab;

