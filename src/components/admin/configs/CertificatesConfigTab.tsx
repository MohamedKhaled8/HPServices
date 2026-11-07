import React, { useState, useEffect } from 'react';
import { Save, X, Edit2, Pencil, Image, Loader2 } from 'lucide-react';
import { CertificatesServiceConfig, CertificateItem } from '../../../types';
import { subscribeToCertificatesServiceConfig, updateCertificatesServiceConfig } from '../../../services/firebaseService';
import { logger } from '../../../utils/logger';

interface CertificatesConfigTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const CertificatesConfigTab: React.FC<CertificatesConfigTabProps> = ({ showAlert }) => {
  const [certificatesConfig, setCertificatesConfig] = useState<CertificatesServiceConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCertificate, setEditingCertificate] = useState<CertificateItem | null>(null);
  const [newCertificateName, setNewCertificateName] = useState<string>('');
  const [newCertificatePrice, setNewCertificatePrice] = useState<string>('');
  const [newCertificateDescription, setNewCertificateDescription] = useState<string>('');

  useEffect(() => {
    const unsubscribe = subscribeToCertificatesServiceConfig((config) => {
      if (config) {
        setCertificatesConfig(config);
      } else {
        const defaultConfig: CertificatesServiceConfig = {
          certificates: [
            { id: '1', name: 'شهادة تحول رقمي', price: 4000, imageUrl: '/certificat.jpeg', description: '' },
            {
              id: '2', name: 'شهادة الخدمة العامة', price: 5000, imageUrl: '/service.jpg',
              description: 'شهادة الخدمة العامة\n\nتمكنا من التعاقد مع احدي المؤسسات للحصول علي شهادة اداء الخدمة العامة بكل سهوله و يسر دون عناء حيث انه يتطلب بعض الاجراءات الروتينية و من ثم الحصول علي الشهادة',
              fields: [
                { name: 'qualification_name', label: 'اسم المؤهل', type: 'text', required: true, placeholder: 'مثال: بكالوريوس تجارة / ليسانس اداب' },
                { name: 'qualification_date', label: 'تاريخ الحصول علي البكالوريوس او الليسانس', type: 'date', required: true, placeholder: 'مثال: مارس 2022 / سبتمبر 2024' }
              ]
            },
            { id: '3', name: 'شهادة محو الأمية', price: 5000, imageUrl: '/omaya.jpeg', description: 'شهادة محو اميه\n\nتمكنا من اجراء اختبارات محو اميه بشكل سليم و سهل في احد المراكز التي تسهل الحصول علي الشهادة و تيسير عمليه الامتحان علي الطالب للحصول علي الشهادة' },
            {
              id: '4', name: 'شهادة خبرة (معلم)', price: 5000, imageUrl: '/exprince.jpg',
              description: 'شهادة خبرة ( معلم)\n\nتقدم احدي المدارس شهادة خبرة بناء علي التخصص و الوظيفه للحضول عليها خلال اشهر فقط من الاعتماد بالمدرسة',
              fields: [
                { name: 'work_start_date', label: 'سنة بداية العمل بالمدرسة', type: 'date' as const, required: true, placeholder: 'mm/dd/yyyy' },
                { name: 'work_end_date', label: 'سنة نهاية العمل بالمدرسة', type: 'date' as const, required: true, placeholder: 'mm/dd/yyyy' },
                { name: 'subject_specialization', label: 'تخصص مادة', type: 'text' as const, required: true, placeholder: 'مثال: عربي - علوم - رياضيات . الخ...' }
              ]
            }
          ],
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        };
        setCertificatesConfig(defaultConfig);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveCertificatesConfig = async () => {
    if (!certificatesConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateCertificatesServiceConfig(certificatesConfig);
      showAlert('نجاح', 'تم حفظ إعدادات الشهادات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCertificate = () => {
    if (!newCertificateName || !newCertificatePrice || !certificatesConfig) return;
    const price = parseFloat(newCertificatePrice);
    if (isNaN(price) || price <= 0) {
      showAlert('تنبيه', 'يرجى إدخال سعر صحيح', 'warning');
      return;
    }
    const newCertificate: CertificateItem = {
      id: Date.now().toString(),
      name: newCertificateName,
      price: price,
      imageUrl: '',
      description: newCertificateDescription || undefined
    };
    setCertificatesConfig({
      ...certificatesConfig,
      certificates: [...certificatesConfig.certificates, newCertificate]
    });
    setNewCertificateName('');
    setNewCertificatePrice('');
    setNewCertificateDescription('');
  };

  const handleRemoveCertificate = (id: string) => {
    if (!certificatesConfig) return;
    if (confirm('هل أنت متأكد من حذف هذه الشهادة؟')) {
      setCertificatesConfig({
        ...certificatesConfig,
        certificates: certificatesConfig.certificates.filter(c => c.id !== id)
      });
    }
  };

  const handleEditCertificate = (certificate: CertificateItem) => {
    setEditingCertificate({
      ...certificate,
      fields: certificate.fields ? [...certificate.fields] : undefined
    });
  };

  const handleUpdateCertificate = async () => {
    if (!editingCertificate || !certificatesConfig || isSaving) return;
    setIsSaving(true);
    const updatedConfig = {
      ...certificatesConfig,
      certificates: certificatesConfig.certificates.map(c =>
        c.id === editingCertificate.id ? editingCertificate : c
      )
    };
    setCertificatesConfig(updatedConfig);
    setEditingCertificate(null);
    try {
      await updateCertificatesServiceConfig(updatedConfig);
      showAlert('نجاح', 'تم حفظ التعديلات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ التعديلات', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (certificateId: string, file: File) => {
    if (!editingCertificate || editingCertificate.id !== certificateId) {
      logger.error('Certificate ID mismatch or editingCertificate is null');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showAlert('تنبيه', 'يرجى اختيار ملف صورة صحيح', 'warning');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert('تنبيه', 'حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      if (imageUrl) {
        setEditingCertificate({ ...editingCertificate, imageUrl });
        logger.log('Image uploaded successfully');
      }
    };
    reader.onerror = () => {
      showAlert('خطأ', 'حدث خطأ أثناء قراءة الصورة', 'error');
    };
    reader.readAsDataURL(file);
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
          <h2>إعدادات خدمة الشهادات</h2>
          <button type="button" onClick={handleSaveCertificatesConfig} className="save-button" disabled={isSaving}>
            <Save size={18} />
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>

        {certificatesConfig && (
          <div className="book-config-form">
            <div className="form-group">
              <label>الشهادات المتاحة</label>
              <div className="certificates-list">
                {certificatesConfig.certificates.map((certificate) => (
                  <div key={certificate.id} className="certificate-item-admin">
                    {editingCertificate?.id === certificate.id ? (
                      <div className="certificate-edit-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>اسم الشهادة</label>
                            <input
                              type="text"
                              value={editingCertificate.name}
                              onChange={(e) => setEditingCertificate({ ...editingCertificate, name: e.target.value })}
                              className="config-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>السعر (جنيه)</label>
                            <input
                              type="number"
                              value={editingCertificate.price}
                              onChange={(e) => setEditingCertificate({ ...editingCertificate, price: parseFloat(e.target.value) || 0 })}
                              className="config-input"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>الصورة</label>
                          <div className="image-upload-section">
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                              {editingCertificate.imageUrl ? (
                                <>
                                  <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img src={editingCertificate.imageUrl} alt={editingCertificate.name} className="certificate-preview-image" />
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleImageUpload(editingCertificate.id, file);
                                      }
                                      if (e.target) {
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }}
                                    className="file-input"
                                    id={`certificate-image-input-${editingCertificate.id}`}
                                    style={{ display: 'none' }}
                                  />
                                  <label
                                    htmlFor={`certificate-image-input-${editingCertificate.id}`}
                                    className="change-image-button"
                                    title="تغيير الصورة"
                                  >
                                    <Pencil size={16} />
                                    تغيير الصورة
                                  </label>
                                </>
                              ) : (
                                <>
                                  <div className="no-image-placeholder">
                                    <Image size={48} />
                                    <span>لا توجد صورة</span>
                                  </div>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleImageUpload(editingCertificate.id, file);
                                      }
                                      if (e.target) {
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }}
                                    className="file-input"
                                    id={`certificate-image-input-new-${editingCertificate.id}`}
                                    style={{ display: 'none' }}
                                  />
                                  <label
                                    htmlFor={`certificate-image-input-new-${editingCertificate.id}`}
                                    className="change-image-button"
                                    title="اختر صورة"
                                  >
                                    <Image size={16} />
                                    اختر صورة
                                  </label>
                                </>
                              )}
                            </div>
                            <small style={{ color: '#64748b', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                              JPEG, PNG, JPG - الحد الأقصى 5 ميجابايت
                            </small>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>النص الوصفي (اختياري)</label>
                          <textarea
                            value={editingCertificate.description || ''}
                            onChange={(e) => setEditingCertificate({ ...editingCertificate, description: e.target.value })}
                            className="config-input"
                            rows={4}
                            placeholder="النص الذي يظهر للمستخدم عند اختيار الشهادة"
                          />
                        </div>
                        <div className="edit-actions">
                          <button type="button" onClick={handleUpdateCertificate} className="save-button" disabled={isSaving}>
                            <Save size={16} />
                            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                          </button>
                          <button type="button" onClick={() => setEditingCertificate(null)} className="cancel-edit-button">
                            <X size={16} />
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="certificate-info">
                          {certificate.imageUrl && (
                            <img src={certificate.imageUrl} alt={certificate.name} className="certificate-thumbnail" />
                          )}
                          <div className="certificate-details">
                            <h3>{certificate.name}</h3>
                            <div className="certificate-price">{certificate.price} جنيه</div>
                            {certificate.description && (
                              <div className="certificate-description-preview">
                                {certificate.description.substring(0, 100)}...
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="certificate-actions">
                          <button
                            onClick={() => handleEditCertificate(certificate)}
                            className="edit-button"
                            title="تعديل"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleRemoveCertificate(certificate.id)}
                            className="remove-assignment-button"
                            title="حذف"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="add-certificate-section">
                <h3>إضافة شهادة جديدة</h3>
                <div className="add-certificate-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>اسم الشهادة</label>
                      <input
                        type="text"
                        placeholder="اسم الشهادة"
                        value={newCertificateName}
                        onChange={(e) => setNewCertificateName(e.target.value)}
                        className="config-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>السعر (جنيه)</label>
                      <input
                        type="number"
                        placeholder="السعر"
                        value={newCertificatePrice}
                        onChange={(e) => setNewCertificatePrice(e.target.value)}
                        className="config-input"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>النص الوصفي (اختياري)</label>
                    <textarea
                      placeholder="النص الذي يظهر للمستخدم"
                      value={newCertificateDescription}
                      onChange={(e) => setNewCertificateDescription(e.target.value)}
                      className="config-input"
                      rows={3}
                    />
                  </div>
                  <button onClick={handleAddCertificate} className="add-price-button">
                    إضافة شهادة
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
                    value={certificatesConfig.paymentMethods.instaPay}
                    onChange={(e) => setCertificatesConfig({
                      ...certificatesConfig,
                      paymentMethods: {
                        ...certificatesConfig.paymentMethods,
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
                    value={certificatesConfig.paymentMethods.cashWallet}
                    onChange={(e) => setCertificatesConfig({
                      ...certificatesConfig,
                      paymentMethods: {
                        ...certificatesConfig.paymentMethods,
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

export default CertificatesConfigTab;

