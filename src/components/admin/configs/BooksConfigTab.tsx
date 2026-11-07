import React, { useState, useEffect } from 'react';
import { Edit2, Save, X, Loader2 } from 'lucide-react';
import { BookServiceConfig } from '../../../types';
import { subscribeToBookServiceConfig, updateBookServiceConfig } from '../../../services/firebaseService';

interface BooksConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const BooksConfigTab: React.FC<BooksConfigTabProps> = ({ showAlert }) => {
  const [bookConfig, setBookConfig] = useState<BookServiceConfig | null>(null);
  const [isEditingBooks, setIsEditingBooks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToBookServiceConfig((config) => {
      if (config) {
        setBookConfig(config);
      } else {
        setBookConfig({
          serviceName: 'شحن الكتب الدراسية',
          prices: { '1': 1750, '2': 3440, '3': 5160, '4': 6820, '5': 8450, '6': 10200, '7': 11885, '8': 13580, '9': 15210, '10': 16900, '11': 18500 },
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        });
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveBookConfig = async () => {
    if (!bookConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateBookServiceConfig(bookConfig);
      setIsEditingBooks(false);
      showAlert('نجاح', 'تم حفظ الإعدادات بنجاح', 'success');
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
          <h2>إعدادات خدمة الكتب</h2>
          {!isEditingBooks ? (
            <button type="button" onClick={() => setIsEditingBooks(true)} className="edit-button">
              <Edit2 size={18} />
              تعديل
            </button>
          ) : (
            <div className="edit-actions">
              <button type="button" onClick={handleSaveBookConfig} className="save-button" disabled={isSaving}>
                <Save size={18} />
                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setIsEditingBooks(false)} className="cancel-edit-button">
                <X size={18} />
                إلغاء
              </button>
            </div>
          )}
        </div>

        {bookConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>اسم الخدمة</label>
              {isEditingBooks ? (
                <input
                  type="text"
                  value={bookConfig.serviceName}
                  onChange={(e) => setBookConfig({ ...bookConfig, serviceName: e.target.value })}
                  className="config-input"
                />
              ) : (
                <div className="config-display">{bookConfig.serviceName}</div>
              )}
            </div>

            <div className="form-group">
              <label>أسعار الكتب</label>
              <div className="prices-grid">
                {Object.entries(bookConfig.prices).map(([copies, price]) => (
                  <div key={copies} className="price-item">
                    <label>كتب لـ {copies === '1' ? 'شخص' : `${copies} أشخاص`}</label>
                    {isEditingBooks ? (
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setBookConfig({
                          ...bookConfig,
                          prices: {
                            ...bookConfig.prices,
                            [copies]: parseInt(e.target.value) || 0
                          }
                        })}
                        className="price-input"
                      />
                    ) : (
                      <div className="price-display">{price} جنيه</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>أرقام الدفع</label>
              <div className="payment-numbers">
                <div className="payment-item">
                  <label>instaPay</label>
                  {isEditingBooks ? (
                    <input
                      type="text"
                      value={bookConfig.paymentMethods.instaPay}
                      onChange={(e) => setBookConfig({
                        ...bookConfig,
                        paymentMethods: {
                          ...bookConfig.paymentMethods,
                          instaPay: e.target.value
                        }
                      })}
                      className="config-input"
                    />
                  ) : (
                    <div className="config-display">{bookConfig.paymentMethods.instaPay}</div>
                  )}
                </div>
                <div className="payment-item">
                  <label>محفظة الكاش</label>
                  {isEditingBooks ? (
                    <input
                      type="text"
                      value={bookConfig.paymentMethods.cashWallet}
                      onChange={(e) => setBookConfig({
                        ...bookConfig,
                        paymentMethods: {
                          ...bookConfig.paymentMethods,
                          cashWallet: e.target.value
                        }
                      })}
                      className="config-input"
                    />
                  ) : (
                    <div className="config-display">{bookConfig.paymentMethods.cashWallet}</div>
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

export default BooksConfigTab;

