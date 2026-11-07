import React, { useState, useEffect } from 'react';
import { Save, X, Loader2 } from 'lucide-react';
import { DigitalTransformationConfig, DigitalTransformationType } from '../../../types';
import { subscribeToDigitalTransformationConfig, updateDigitalTransformationConfig } from '../../../services/firebaseService';

interface DigitalTransformationConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const DigitalTransformationConfigTab: React.FC<DigitalTransformationConfigTabProps> = ({ showAlert }) => {
  const [digitalTransformationConfig, setDigitalTransformationConfig] = useState<DigitalTransformationConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newTransformationTypeName, setNewTransformationTypeName] = useState<string>('');
  const [newTransformationTypePrice, setNewTransformationTypePrice] = useState<string>('');
  const [newExamLanguage, setNewExamLanguage] = useState<string>('');

  useEffect(() => {
    const unsubscribe = subscribeToDigitalTransformationConfig((config) => {
      if (config) {
        setDigitalTransformationConfig(config);
      } else {
        const defaultConfig: DigitalTransformationConfig = {
          transformationTypes: [
            { id: '1769264857959', name: 'السادات امتحانات فقط', price: 1050 }
          ],
          examLanguage: ['إختبار فقط', 'إختبار فقط (بالغة الإنجليزية)'],
          paymentMethods: { instaPay: '01017180923 احمد ع م ش', cashWallet: '01050889591' }
        };
        setDigitalTransformationConfig(defaultConfig);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveDigitalTransformationConfig = async () => {
    if (!digitalTransformationConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateDigitalTransformationConfig(digitalTransformationConfig);
      showAlert('نجاح', 'تم حفظ الإعدادات بنجاح!', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTransformationType = () => {
    if (!newTransformationTypeName || !newTransformationTypePrice || !digitalTransformationConfig) return;
    const price = parseFloat(newTransformationTypePrice);
    if (isNaN(price) || price <= 0) {
      showAlert('تنبيه', 'يرجى إدخال سعر صحيح', 'warning');
      return;
    }

    const newType: DigitalTransformationType = {
      id: Date.now().toString(),
      name: newTransformationTypeName,
      price: price
    };

    setDigitalTransformationConfig({
      ...digitalTransformationConfig,
      transformationTypes: [...digitalTransformationConfig.transformationTypes, newType]
    });

    setNewTransformationTypeName('');
    setNewTransformationTypePrice('');
  };

  const handleRemoveTransformationType = (id: string) => {
    if (!digitalTransformationConfig) return;
    if (confirm('هل أنت متأكد من حذف هذا النوع؟')) {
      setDigitalTransformationConfig({
        ...digitalTransformationConfig,
        transformationTypes: digitalTransformationConfig.transformationTypes.filter(t => t.id !== id)
      });
    }
  };

  const handleAddExamLanguage = () => {
    if (!newExamLanguage.trim() || !digitalTransformationConfig) return;

    setDigitalTransformationConfig({
      ...digitalTransformationConfig,
      examLanguage: [...digitalTransformationConfig.examLanguage, newExamLanguage.trim()]
    });

    setNewExamLanguage('');
  };

  const handleRemoveExamLanguage = (index: number) => {
    if (!digitalTransformationConfig) return;
    if (confirm('هل أنت متأكد من حذف هذه اللغة؟')) {
      setDigitalTransformationConfig({
        ...digitalTransformationConfig,
        examLanguage: digitalTransformationConfig.examLanguage.filter((_, i) => i !== index)
      });
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
    <div className="admin-content digital-transformation-section">
      <div className="books-section">
        <div className="section-header">
          <h2>إعدادات خدمة التحول الرقمي</h2>
          <button type="button" onClick={handleSaveDigitalTransformationConfig} className="save-button" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>

        {digitalTransformationConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>أنواع التحول الرقمي</label>
              <div className="transformation-types-list">
                {digitalTransformationConfig.transformationTypes.length > 0 ? (
                  digitalTransformationConfig.transformationTypes.map((type) => (
                    <div key={type.id} className="transformation-type-item">
                      <div className="type-info">
                        <div className="type-name">{type.name}</div>
                        <div className="type-price">{type.price} جنيه</div>
                      </div>
                      <button
                        onClick={() => handleRemoveTransformationType(type.id)}
                        className="remove-assignment-button"
                        title="حذف"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-items-message">لا توجد أنواع مضافة</div>
                )}
              </div>

              <div className="add-transformation-type-section">
                <div className="add-transformation-type-form">
                  <div className="input-group">
                    <label>اسم المدينة أو النص المخصص</label>
                    <input
                      type="text"
                      placeholder="أدخل اسم المدينة أو النص المخصص"
                      value={newTransformationTypeName}
                      onChange={(e) => setNewTransformationTypeName(e.target.value)}
                      className="config-input-enhanced"
                    />
                  </div>
                  <div className="input-group">
                    <label>السعر بالجنيه</label>
                    <input
                      type="number"
                      placeholder="أدخل السعر"
                      value={newTransformationTypePrice}
                      onChange={(e) => setNewTransformationTypePrice(e.target.value)}
                      className="config-input-enhanced"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <button onClick={handleAddTransformationType} className="add-price-button-enhanced">
                    <span>إضافة نوع</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>أنواع التدريب المتاحة (كانت تسمى لغات الامتحان)</label>
              <div className="exam-languages-list">
                {digitalTransformationConfig.examLanguage.length > 0 ? (
                  digitalTransformationConfig.examLanguage.map((language, index) => (
                    <div key={index} className="exam-language-item">
                      <div className="language-name">{language}</div>
                      <button
                        onClick={() => handleRemoveExamLanguage(index)}
                        className="remove-assignment-button"
                        title="حذف"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-items-message">لا توجد أنواع مضافة</div>
                )}
              </div>

              <div className="add-exam-language-section">
                <div className="add-exam-language-form">
                  <div className="input-group">
                    <label>إضافة نوع تدريب جديد</label>
                    <input
                      type="text"
                      placeholder="أدخل نوع التدريب (مثال: اختبار فقط)"
                      value={newExamLanguage}
                      onChange={(e) => setNewExamLanguage(e.target.value)}
                      className="config-input-enhanced"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddExamLanguage();
                        }
                      }}
                    />
                  </div>
                  <button onClick={handleAddExamLanguage} className="add-price-button-enhanced">
                    <span>إضافة</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>أرقام الدفع</label>
              <div className="payment-numbers">
                <div className="payment-item">
                  <label>instaPay</label>
                  <input
                    type="text"
                    value={digitalTransformationConfig.paymentMethods.instaPay}
                    onChange={(e) => setDigitalTransformationConfig({
                      ...digitalTransformationConfig,
                      paymentMethods: {
                        ...digitalTransformationConfig.paymentMethods,
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
                    value={digitalTransformationConfig.paymentMethods.cashWallet}
                    onChange={(e) => setDigitalTransformationConfig({
                      ...digitalTransformationConfig,
                      paymentMethods: {
                        ...digitalTransformationConfig.paymentMethods,
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

export default DigitalTransformationConfigTab;

