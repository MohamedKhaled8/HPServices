import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { ServiceRequest, UploadedFile } from '../types';
import { getBookServiceConfig, getFeesServiceConfig, getAssignmentsServiceConfig, getCertificatesServiceConfig, getDigitalTransformationConfig, getFinalReviewConfig, getGraduationProjectConfig } from '../services/firebaseService';
import { BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig, CertificateItem, DigitalTransformationConfig, FinalReviewConfig, GraduationProjectConfig } from '../types';
import { ArrowRight, Edit2, AlertCircle, Pencil, Loader2, Award, CheckCircle, FileText } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import '../styles/ServiceDetailsPage.css';

interface ServiceDetailsPageProps {
  serviceId: string;
  onBack: () => void;
  onSubmitSuccess: () => void;
}

const ServiceDetailsPage: React.FC<ServiceDetailsPageProps> = ({
  serviceId,
  onBack,
  onSubmitSuccess
}) => {
  const { student, addServiceRequest } = useStudent();
  const service = SERVICES.find(s => s.id === serviceId);

  const [serviceData, setServiceData] = useState<Record<string, any>>({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editableFields, setEditableFields] = useState<Record<string, boolean>>({});
  const [receiptFiles, setReceiptFiles] = useState<UploadedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ uploading: boolean; progress: number }>({ uploading: false, progress: 0 });
  const [bookConfig, setBookConfig] = useState<BookServiceConfig | null>(null);
  const [feesConfig, setFeesConfig] = useState<FeesServiceConfig | null>(null);
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig | null>(null);
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [certificatesConfig, setCertificatesConfig] = useState<CertificatesServiceConfig | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<CertificateItem | null>(null);
  const [digitalTransformationConfig, setDigitalTransformationConfig] = useState<DigitalTransformationConfig | null>(null);
  const [finalReviewConfig, setFinalReviewConfig] = useState<FinalReviewConfig | null>(null);
  const [graduationProjectConfig, setGraduationProjectConfig] = useState<GraduationProjectConfig | null>(null);

  // Load book config for service 3
  useEffect(() => {
    if (!service?.id) return;
    if (service.id === '3') {
      const loadBookConfig = async () => {
        try {
          const config = await getBookServiceConfig();
          if (config) {
            setBookConfig(config);
          } else {
            // Default config
            setBookConfig({
              serviceName: 'شحن الكتب الدراسية الترم الأول',
              prices: {
                '1': 1750,
                '2': 3440,
                '3': 5160,
                '4': 6820,
                '5': 8450,
                '6': 10200,
                '7': 11885,
                '8': 13580,
                '9': 15210,
                '10': 16900
              },
              paymentMethods: {
                instaPay: '01017180923',
                cashWallet: '01050889591'
              }
            });
          }
        } catch (error) {
          console.error('Error loading book config:', error);
        }
      };
      loadBookConfig();
    }

    // Load fees config for service 4
    if (service.id === '4') {
      const loadFeesConfig = async () => {
        try {
          const config = await getFeesServiceConfig();
          if (config) {
            setFeesConfig(config);
          } else {
            // Default config
            setFeesConfig({
              prices: {}
            });
          }
        } catch (error) {
          console.error('Error loading fees config:', error);
        }
      };
      loadFeesConfig();
    }
    if (service.id === '5') {
      const loadAssignmentsConfig = async () => {
        try {
          const config = await getAssignmentsServiceConfig();
          if (config) {
            setAssignmentsConfig(config);
          }
        } catch (error) {
          console.error('Error loading assignments config:', error);
        }
      };
      loadAssignmentsConfig();
    }
    if (service.id === '6') {
      const loadCertificatesConfig = async () => {
        try {
          console.log('Loading certificates config in ServiceDetailsPage...');
          const config = await getCertificatesServiceConfig();
          if (config) {
            console.log('Setting certificates config in ServiceDetailsPage:', config.certificates?.length || 0, 'certificates');
            console.log('Certificates details:', config.certificates?.map(c => ({
              id: c.id,
              name: c.name,
              hasImage: !!c.imageUrl,
              imageUrlLength: c.imageUrl?.length || 0
            })));
            setCertificatesConfig(config);
          } else {
            console.log('No certificates config found in ServiceDetailsPage');
            setCertificatesConfig(null);
          }
        } catch (error) {
          console.error('Error loading certificates config in ServiceDetailsPage:', error);
          setCertificatesConfig(null);
        }
      };
      loadCertificatesConfig();
    }

    if (service.id === '7') {
      const loadDigitalTransformationConfig = async () => {
        try {
          console.log('Loading digital transformation config in ServiceDetailsPage...');
          const config = await getDigitalTransformationConfig();
          if (config) {
            console.log('Setting digital transformation config in ServiceDetailsPage:', config.transformationTypes?.length || 0, 'types');
            setDigitalTransformationConfig(config);
          } else {
            console.log('No digital transformation config found in ServiceDetailsPage');
            setDigitalTransformationConfig(null);
          }
        } catch (error) {
          console.error('Error loading digital transformation config in ServiceDetailsPage:', error);
          setDigitalTransformationConfig(null);
        }
      };
      loadDigitalTransformationConfig();
    }

    if (service.id === '8') {
      const loadFinalReviewConfig = async () => {
        try {
          console.log('Loading final review config in ServiceDetailsPage...');
          const config = await getFinalReviewConfig();
          if (config) {
            console.log('Setting final review config in ServiceDetailsPage:', config);
            setFinalReviewConfig(config);
          } else {
            console.log('No final review config found in ServiceDetailsPage');
            setFinalReviewConfig(null);
          }
        } catch (error) {
          console.error('Error loading final review config in ServiceDetailsPage:', error);
          setFinalReviewConfig(null);
        }
      };
      loadFinalReviewConfig();
    }

    if (service.id === '9') {
      const loadGraduationProjectConfig = async () => {
        try {
          console.log('Loading graduation project config in ServiceDetailsPage...');
          const config = await getGraduationProjectConfig();
          if (config) {
            console.log('Setting graduation project config in ServiceDetailsPage:', config);
            setGraduationProjectConfig(config);
          } else {
            console.log('No graduation project config found in ServiceDetailsPage');
            setGraduationProjectConfig(null);
          }
        } catch (error) {
          console.error('Error loading graduation project config in ServiceDetailsPage:', error);
          setGraduationProjectConfig(null);
        }
      };
      loadGraduationProjectConfig();
    }
  }, [service?.id]);

  // ملء البيانات الشخصية تلقائياً من بيانات المستخدم للخدمة الأولى و VIP و دفع المصروفات
  useEffect(() => {
    if (!service || !student) return;

    if (service.id === '1' || service.id === '2' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8') {
      const initialData: Record<string, any> = {};
      const addressString = student.address
        ? `${student.address.governorate || ''}, ${student.address.city || ''}, ${student.address.street || ''}, ${student.address.building || ''}, ${student.address.siteNumber || ''}${student.address.landmark ? `, ${student.address.landmark}` : ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',')
        : '';

      service.fields.forEach(field => {
        if (field.type === 'editable') {
          switch (field.name) {
            case 'full_name':
            case 'full_name_arabic':
              initialData[field.name] = student.fullNameArabic || '';
              break;
            case 'full_name_english':
              initialData[field.name] = student.vehicleNameEnglish || '';
              break;
            case 'national_id':
              initialData[field.name] = student.nationalID || '';
              break;
            case 'address':
              initialData[field.name] = addressString;
              break;
            case 'email':
              initialData[field.name] = student.email || '';
              break;
            case 'whatsapp_number':
              initialData[field.name] = student.whatsappNumber || '';
              break;
          }
        } else if (field.type === 'select' && (service.id === '4' || service.id === '5' || service.id === '8')) {
          // Set default values for service 4, 5 and 8 fields
          switch (field.name) {
            case 'diploma_type':
              initialData[field.name] = 'اختر نوع الدبلومة';
              break;
            case 'track_category':
            case 'track':
              initialData[field.name] = 'اختر المسار';
              break;
            case 'diploma_year':
              initialData[field.name] = 'اختر السنه';
              break;
            case 'educational_specialization':
              initialData[field.name] = 'اختر التخصص';
              break;
          }
        }
      });

      setServiceData(initialData);

      // تعيين جميع الحقول القابلة للتعديل كغير قابلة للتعديل في البداية
      const editableState: Record<string, boolean> = {};
      service.fields.forEach(field => {
        if (field.type === 'editable') {
          editableState[field.name] = false;
        }
      });
      setEditableFields(editableState);
    }
  }, [service, student]);

  if (!service || !student) {
    return null;
  }

  const toggleFieldEdit = (fieldName: string) => {
    setEditableFields(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };


  const handleServiceDataChange = (fieldName: string, value: any) => {
    setServiceData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);

    const missingFields = service.fields
      .filter(field => field.required && (!serviceData[field.name] || (typeof serviceData[field.name] === 'string' && serviceData[field.name].includes('اختر'))))
      .map(field => field.label);

    // التحقق من الأسماء والمسارات لخدمة الكتب
    if (service.id === '3' && serviceData.number_of_copies) {
      const copiesCount = parseInt(serviceData.number_of_copies) || 0;
      if (copiesCount < 1 || copiesCount > 10) {
        setSubmitMessage({
          type: 'error',
          text: 'عدد النسخ يجب أن يكون بين 1 و 10'
        });
        setIsSubmitting(false);
        return;
      }

      const namesArray = serviceData.names_array || [];
      const tracksArray = serviceData.tracks_array || [];

      if (namesArray.length !== copiesCount || namesArray.some(name => !name || !name.trim())) {
        setSubmitMessage({
          type: 'error',
          text: `يرجى ملء جميع الأسماء الرباعية (${copiesCount} أسماء مطلوبة)`
        });
        setIsSubmitting(false);
        return;
      }

      if (tracksArray.length !== copiesCount || tracksArray.some(track => !track || !track.trim())) {
        setSubmitMessage({
          type: 'error',
          text: `يرجى ملء جميع المسارات والتخصصات (${copiesCount} مسارات مطلوبة)`
        });
        setIsSubmitting(false);
        return;
      }
    }

    if (missingFields.length > 0) {
      setSubmitMessage({
        type: 'error',
        text: `يرجى ملء الحقول المطلوبة: ${missingFields.join(', ')}`
      });
      setIsSubmitting(false);
      return;
    }

    if (service.paymentMethods.length > 0 && !selectedPaymentMethod) {
      setSubmitMessage({
        type: 'error',
        text: 'يرجى اختيار طريقة دفع'
      });
      setIsSubmitting(false);
      return;
    }

    // للخدمة VIP وخدمة الكتب وخدمة التكليفات والشهادات ومشروع التخرج، يجب رفع صورة الإيصال
    if ((service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9') && receiptFiles.length === 0) {
      setSubmitMessage({
        type: 'error',
        text: 'يرجى رفع صورة الإيصال أولاً'
      });
      setIsSubmitting(false);
      return;
    }

    // للخدمة 5، يجب اختيار تكليف واحد على الأقل
    if (service.id === '5' && selectedAssignments.length === 0) {
      setSubmitMessage({
        type: 'error',
        text: 'يرجى اختيار تكليف واحد على الأقل'
      });
      setIsSubmitting(false);
      return;
    }

    // للخدمة 6، يجب اختيار شهادة
    if (service.id === '6' && !selectedCertificate) {
      setSubmitMessage({
        type: 'error',
        text: 'يرجى اختيار شهادة'
      });
      setIsSubmitting(false);
      return;
    }

    if (service.id === '7' && !serviceData.transformation_type) {
      setSubmitMessage({
        type: 'error',
        text: 'يرجى اختيار نوع التحول الرقمي'
      });
      setIsSubmitting(false);
      return;
    }

    if (service.id === '7' && digitalTransformationConfig && (!serviceData.exam_language || serviceData.exam_language === '')) {
      setSubmitMessage({
        type: 'error',
        text: 'يرجى اختيار لغة الامتحان'
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Show upload progress for all services
      setUploadProgress({ uploading: true, progress: 0 });

      const requestData = { ...serviceData };
      if (service.id === '5') {
        requestData.selectedAssignments = selectedAssignments;
        const selectedAssignmentsData = assignmentsConfig?.assignments.filter(a => selectedAssignments.includes(a.id)) || [];
        requestData.selectedAssignmentsData = selectedAssignmentsData;
        requestData.totalPrice = selectedAssignmentsData.reduce((sum, a) => sum + a.price, 0);
      }
      if (service.id === '6' && selectedCertificate) {
        requestData.selectedCertificate = selectedCertificate;
        requestData.totalPrice = selectedCertificate.price;
      }

      if (service.id === '7' && digitalTransformationConfig) {
        const selectedType = digitalTransformationConfig.transformationTypes.find(t => t.id === serviceData.transformation_type);
        if (selectedType) {
          requestData.selectedTransformationType = selectedType;
          requestData.totalPrice = selectedType.price;
        }
        if (serviceData.exam_language) {
          requestData.selectedExamLanguage = serviceData.exam_language;
        }
      }

      if (service.id === '8' && finalReviewConfig) {
        requestData.totalPrice = finalReviewConfig.paymentAmount;
      }

      const request: ServiceRequest = {
        studentId: student.id || '',
        serviceId: service.id,
        data: requestData,
        documents: (service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9') ? receiptFiles : [],
        paymentMethod: selectedPaymentMethod,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Simulate progress for better UX (faster)
      setUploadProgress({ uploading: true, progress: 30 });
      await new Promise(resolve => setTimeout(resolve, 150));
      setUploadProgress({ uploading: true, progress: 60 });

      await addServiceRequest(request);

      setUploadProgress({ uploading: true, progress: 100 });
      await new Promise(resolve => setTimeout(resolve, 150));

      setSubmitMessage({
        type: 'success',
        text: 'تم تقديم الطلب بنجاح!'
      });

      setTimeout(() => {
        onSubmitSuccess();
      }, 2000);
    } catch (error: any) {
      setSubmitMessage({
        type: 'error',
        text: error.message || 'حدث خطأ أثناء تقديم الطلب'
      });
      setUploadProgress({ uploading: false, progress: 0 });
    } finally {
      setIsSubmitting(false);
      setUploadProgress({ uploading: false, progress: 0 });
    }
  };

  if (!service) {
    return (
      <div className="service-details-page">
        <div className="details-header">
          <button onClick={onBack} className="back-button">
            <ArrowRight size={20} />
            رجوع
          </button>
          <h1>الخدمة غير موجودة</h1>
        </div>
      </div>
    );
  }

  return (
    <div className={`service-details-page ${service.id === '7' ? 'digital-transformation-page' : ''}`}>
      <div className="details-header">
        <button onClick={onBack} className="back-button">
          <ArrowRight size={20} />
          رجوع
        </button>
        <h1>
          {service.id === '3' && bookConfig
            ? bookConfig.serviceName
            : service.id === '5' && assignmentsConfig
              ? assignmentsConfig.serviceName
              : service.id === '8' && finalReviewConfig
                ? finalReviewConfig.serviceName
                : service.id === '9' && graduationProjectConfig
                  ? graduationProjectConfig.serviceName
                  : service.nameAr}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="details-form">
        <div className="details-container">
          {service.id !== '1' && (
            <section className="form-section section-personal-data">
              <h2>البيانات الشخصية</h2>
              <div className="personal-data-display">
                <div className="data-field">
                  <span className="label">الاسم:</span>
                  <span className="value">{student.fullNameArabic}</span>
                </div>
                <div className="data-field">
                  <span className="label">البريد الإلكتروني:</span>
                  <span className="value">{student.email}</span>
                </div>
                <div className="data-field">
                  <span className="label">رقم الواتس:</span>
                  <span className="value">{student.whatsappNumber}</span>
                </div>
                <div className="data-field">
                  <span className="label">المقرر:</span>
                  <span className="value">{student.course}</span>
                </div>
              </div>
              <p className="edit-note">
                <Edit2 size={16} />
                هذه البيانات غير قابلة للتعديل. يمكنك تحديثها من الملف الشخصي
              </p>
            </section>
          )}

          {service.id === '9' && (service.features || (graduationProjectConfig && graduationProjectConfig.features)) && (
            <section className="form-section section-features">
              <h2>المميزات</h2>
              <ul className="features-list">
                {(graduationProjectConfig?.features || service.features || []).map((feature, index) => (
                  <li key={index} className="feature-item">
                    <CheckCircle size={18} className="feature-icon" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="form-section section-service-data">
            <h2>{service.id === '1' ? 'بيانات التسجيل' : 'بيانات الخدمة'}</h2>
            <div className="service-fields">
              {service.fields.map(field => {
                // تجاهل حقول Other إذا لم يتم اختيار Other أو أخرى
                if (field.name.endsWith('_other')) {
                  const parentFieldName = field.name.replace('_other', '');
                  const parentValue = serviceData[parentFieldName];
                  if (parentValue !== 'Other' && parentValue !== 'أخرى') {
                    return null;
                  }
                }

                return (
                  <div key={field.name} className="form-group">
                    <label htmlFor={field.name}>
                      {field.label}
                      {field.required && <span className="required">*</span>}
                    </label>

                    {field.type === 'editable' && (
                      <div className="editable-field-container">
                        {!editableFields[field.name] ? (
                          <div className="editable-field-display">
                            <input
                              id={field.name}
                              type="text"
                              value={serviceData[field.name] || ''}
                              readOnly
                              className="readonly-input"
                            />
                            <button
                              type="button"
                              onClick={() => toggleFieldEdit(field.name)}
                              className="edit-field-button"
                              title="تعديل"
                            >
                              <Pencil size={16} />
                            </button>
                          </div>
                        ) : (
                          <input
                            id={field.name}
                            type={field.name === 'email' ? 'email' : 'text'}
                            value={serviceData[field.name] || ''}
                            onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                            placeholder={field.name === 'email' ? 'EX******@gmail.com' : field.label}
                            required={field.required}
                            className="editable-input"
                          />
                        )}
                      </div>
                    )}

                    {field.type === 'text' && (
                      <input
                        id={field.name}
                        type="text"
                        value={serviceData[field.name] || ''}
                        onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                      />
                    )}

                    {field.type === 'number' && (
                      <input
                        id={field.name}
                        type="number"
                        min="1"
                        max="10"
                        value={serviceData[field.name] ?? ''}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          // إذا كان الحقل فارغاً، نضع قيمة فارغة
                          if (inputValue === '') {
                            handleServiceDataChange(field.name, '');
                            if (service.id === '3' && field.name === 'number_of_copies') {
                              setServiceData(prev => ({
                                ...prev,
                                names_array: [],
                                tracks_array: []
                              }));
                            }
                            return;
                          }
                          
                          const value = parseInt(inputValue);
                          // التحقق من أن القيمة صحيحة بين 1 و 10
                          if (!isNaN(value) && value >= 1 && value <= 10) {
                            handleServiceDataChange(field.name, value);
                            // إذا كانت خدمة الكتب، نعيد تهيئة مصفوفات الأسماء والمسارات فوراً
                            if (service.id === '3' && field.name === 'number_of_copies') {
                              const namesArray = Array.from({ length: value }, (_, i) => serviceData.names_array?.[i] || '');
                              const tracksArray = Array.from({ length: value }, (_, i) => serviceData.tracks_array?.[i] || '');
                              setServiceData(prev => ({
                                ...prev,
                                [field.name]: value,
                                names_array: namesArray,
                                tracks_array: tracksArray
                              }));
                            }
                          }
                        }}
                        placeholder={field.label}
                        required={field.required}
                      />
                    )}

                    {field.type === 'select' && (
                      <>
                        {field.name === 'diploma_year' && service.id === '4' && feesConfig ? (
                          <select
                            id={field.name}
                            value={serviceData[field.name] || ''}
                            onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                            required={field.required}
                          >
                            <option value="">اختر السنه</option>
                            {Object.keys(feesConfig.prices).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                              <option key={year} value={year}>
                                {year} - {feesConfig.prices[year]} جنيه
                              </option>
                            ))}
                          </select>
                        ) : field.name === 'track_other' && service.id === '4' ? (
                          <>
                            {serviceData['track_category'] === 'أخرى' && (
                              <input
                                type="text"
                                value={serviceData['track_other'] || ''}
                                onChange={(e) => handleServiceDataChange('track_other', e.target.value)}
                                placeholder="اذكر المسار"
                                required={false}
                                className="other-input"
                              />
                            )}
                          </>
                        ) : field.name === 'transformation_type' && service.id === '7' && digitalTransformationConfig ? (
                          <select
                            id={field.name}
                            value={serviceData[field.name] || ''}
                            onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                            required={field.required}
                          >
                            <option value="">اختر نوع التحول الرقمي</option>
                            {digitalTransformationConfig.transformationTypes.map(type => (
                              <option key={type.id} value={type.id}>
                                {type.name} - {type.price} جنيه
                              </option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <select
                              id={field.name}
                              value={serviceData[field.name] || ''}
                              onChange={(e) => {
                                handleServiceDataChange(field.name, e.target.value);
                                // إذا تم اختيار Other أو أخرى، لا نفعل شيء. إذا تم اختيار شيء آخر، نحذف قيمة Other
                                if (e.target.value !== 'Other' && e.target.value !== 'أخرى' && field.hasOther) {
                                  handleServiceDataChange(field.name + '_other', '');
                                }
                                // إذا تم تغيير track_category، نعيد تعيين track_other
                                if (field.name === 'track_category' && service.id === '4') {
                                  if (e.target.value !== 'أخرى') {
                                    handleServiceDataChange('track_other', '');
                                  }
                                }
                              }}
                              required={field.required}
                            >
                              {field.options?.[0]?.includes('اختر') ? (
                                <option value={field.options[0]}>{field.options[0]}</option>
                              ) : (
                                <option value="">اختر...</option>
                              )}
                              {field.options?.slice(field.options[0]?.includes('اختر') ? 1 : 0).map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            {field.hasOther && (serviceData[field.name] === 'Other' || serviceData[field.name] === 'أخرى') && (
                              <input
                                type="text"
                                value={serviceData[field.name + '_other'] || ''}
                                onChange={(e) => handleServiceDataChange(field.name + '_other', e.target.value)}
                                placeholder={field.name === 'educational_specialization' ? 'اذكر التخصص' : field.label.replace('الكلية او المعهد', 'اذكر الكلية او المعهد').replace('القسم او الشعبة', 'اذكر القسم او الشعبة')}
                                required={field.required}
                                className="other-input"
                              />
                            )}
                          </>
                        )}
                      </>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        id={field.name}
                        value={serviceData[field.name] || ''}
                        onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                        rows={4}
                      />
                    )}
                  </div>
                );
              })}

              {/* Dynamic Names and Tracks Fields for Books Service - داخل نفس القسم */}
              {service.id === '3' && serviceData.number_of_copies && serviceData.number_of_copies !== '' && parseInt(serviceData.number_of_copies) > 0 && (
                <>
                  <div className="dynamic-fields-section">
                    <h3 className="dynamic-fields-title">الأسماء الرباعية</h3>
                    <div className="dynamic-fields-container">
                      {Array.from({ length: Math.min(parseInt(serviceData.number_of_copies) || 1, 10) }, (_, index) => (
                        <div key={index} className="form-group">
                          <label htmlFor={`name_${index}`}>
                            الاسم الرباعي للنسخة {index + 1}
                            <span className="required">*</span>
                          </label>
                          <input
                            id={`name_${index}`}
                            type="text"
                            value={serviceData.names_array?.[index] || ''}
                            onChange={(e) => {
                              const namesArray = [...(serviceData.names_array || [])];
                              namesArray[index] = e.target.value;
                              setServiceData(prev => ({
                                ...prev,
                                names_array: namesArray,
                                names: namesArray.join('\n') // حفظ كـ textarea أيضاً للتوافق
                              }));
                            }}
                            placeholder={`اكتب الاسم الرباعي للنسخة ${index + 1}`}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="dynamic-fields-section">
                    <h3 className="dynamic-fields-title">المسارات والتخصصات</h3>
                    <div className="dynamic-fields-container">
                      {Array.from({ length: Math.min(parseInt(serviceData.number_of_copies) || 1, 10) }, (_, index) => (
                        <div key={index} className="form-group">
                          <label htmlFor={`track_${index}`}>
                            المسار/التخصص للنسخة {index + 1}
                            <span className="required">*</span>
                          </label>
                          <input
                            id={`track_${index}`}
                            type="text"
                            value={serviceData.tracks_array?.[index] || ''}
                            onChange={(e) => {
                              const tracksArray = [...(serviceData.tracks_array || [])];
                              tracksArray[index] = e.target.value;
                              setServiceData(prev => ({
                                ...prev,
                                tracks_array: tracksArray,
                                tracks: tracksArray.join('\n') // حفظ كـ textarea أيضاً للتوافق
                              }));
                            }}
                            placeholder={`اكتب المسار/التخصص للنسخة ${index + 1}`}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {service.id === '5' && assignmentsConfig && (
            <section className="form-section section-assignments">
              <h2>حدد التكاليف المطلوبة</h2>
              <div className="assignments-cards-grid">
                {assignmentsConfig.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className={`assignment-card ${selectedAssignments.includes(assignment.id) ? 'selected' : ''}`}
                    onClick={() => {
                      if (selectedAssignments.includes(assignment.id)) {
                        setSelectedAssignments(selectedAssignments.filter(id => id !== assignment.id));
                      } else {
                        setSelectedAssignments([...selectedAssignments, assignment.id]);
                      }
                    }}
                  >
                    <div className="assignment-card-content">
                      <h3>{assignment.name}</h3>
                      <div className="assignment-price">{assignment.price} جنيه</div>
                    </div>
                    {selectedAssignments.includes(assignment.id) && (
                      <div className="assignment-selected-indicator">✓</div>
                    )}
                  </div>
                ))}
              </div>
              {selectedAssignments.length > 0 && (
                <div className="selected-assignments-summary">
                  <strong>التكليفات المختارة:</strong>
                  <div className="selected-assignments-list">
                    {assignmentsConfig.assignments
                      .filter(a => selectedAssignments.includes(a.id))
                      .map(a => (
                        <span key={a.id} className="selected-assignment-item">
                          {a.name} ({a.price} جنيه)
                        </span>
                      ))}
                  </div>
                  <div className="total-price">
                    <strong>المجموع: {assignmentsConfig.assignments
                      .filter(a => selectedAssignments.includes(a.id))
                      .reduce((sum, a) => sum + a.price, 0)} جنيه</strong>
                  </div>
                </div>
              )}
            </section>
          )}

          {service.id === '6' && certificatesConfig && certificatesConfig.certificates && (
            <section className="certificates-section-modern">
              <div className="certificates-container">
                <div className="certificates-title-section">
                  <div className="title-icon">
                    <Award size={32} />
                  </div>
                  <div className="title-content">
                    <h2>اختر شهادتك</h2>
                    <p>اختر الشهادة المناسبة لاحتياجاتك من الخيارات المتاحة</p>
                  </div>
                </div>

                <div className="certificates-selection-area">
                  {certificatesConfig.certificates.length > 0 ? (
                    <div className="certificates-options">
                      {certificatesConfig.certificates.map((certificate) => (
                        <div
                          key={certificate.id}
                          className={`certificate-option ${selectedCertificate?.id === certificate.id ? 'active' : ''}`}
                          onClick={() => setSelectedCertificate(certificate)}
                        >
                          <div className="certificate-option-content">
                            <div className="certificate-image-wrapper">
                              {certificate.imageUrl && certificate.imageUrl.trim() !== '' ? (
                                <img
                                  src={certificate.imageUrl}
                                  alt={certificate.name}
                                  className="certificate-option-image"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const placeholder = e.currentTarget.parentElement?.querySelector('.image-fallback');
                                    if (placeholder) {
                                      (placeholder as HTMLElement).style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div className="image-fallback" style={{ display: !certificate.imageUrl || certificate.imageUrl.trim() === '' ? 'flex' : 'none' }}>
                                <Award size={24} />
                              </div>
                            </div>

                            <div className="certificate-option-details">
                              <h3 className="certificate-option-title">{certificate.name}</h3>
                              <div className="certificate-option-price">
                                <span className="price-value">{certificate.price}</span>
                                <span className="price-unit">جنيه</span>
                              </div>
                              {certificate.fields && certificate.fields.length > 0 && (
                                <div className="certificate-option-meta">
                                  <FileText size={14} />
                                  <span>{certificate.fields.length} حقول مطلوبة</span>
                                </div>
                              )}
                            </div>

                            <div className="certificate-selection-indicator">
                              {selectedCertificate?.id === certificate.id ? (
                                <div className="selected-indicator">
                                  <CheckCircle size={20} />
                                  <span>مختار</span>
                                </div>
                              ) : (
                                <div className="select-indicator">
                                  <span>اختر</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {certificate.description && (
                            <div className="certificate-option-description">
                              <p>{certificate.description.split('\n')[0]}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-certificates-state">
                      <div className="empty-state-icon">
                        <Award size={48} />
                      </div>
                      <h3>لا توجد شهادات متاحة</h3>
                      <p>سنضيف شهادات جديدة قريباً</p>
                    </div>
                  )}
                </div>

                {selectedCertificate && (
                  <div className="certificate-details-form">
                    <div className="form-header">
                      <div className="selected-certificate-summary">
                        <div className="summary-icon">
                          <CheckCircle size={24} />
                        </div>
                        <div className="summary-content">
                          <h3>{selectedCertificate.name}</h3>
                          <p className="summary-price">{selectedCertificate.price} جنيه</p>
                        </div>
                      </div>
                    </div>

                    <div className="form-content">
                      {selectedCertificate.description && (
                        <div className="certificate-description-section">
                          <h4>تفاصيل الشهادة</h4>
                          <div className="description-text">
                            {selectedCertificate.description.split('\n').map((line, index) => (
                              <p key={index}>{line}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedCertificate.fields && selectedCertificate.fields.length > 0 && (
                        <div className="certificate-fields-section">
                          <h4>المعلومات المطلوبة</h4>
                          <div className="fields-container">
                            {selectedCertificate.fields.map((field) => (
                              <div key={field.name} className="field-wrapper">
                                <label htmlFor={field.name} className="field-label-clean">
                                  {field.label}
                                  {field.required && <span className="field-required">*</span>}
                                </label>
                                {field.type === 'text' && (
                                  <input
                                    id={field.name}
                                    type="text"
                                    value={serviceData[field.name] || ''}
                                    onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                                    placeholder={field.placeholder || field.label}
                                    required={field.required}
                                    className="field-input-clean"
                                  />
                                )}
                                {field.type === 'date' && (
                                  <input
                                    id={field.name}
                                    type="text"
                                    value={serviceData[field.name] || ''}
                                    onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                                    placeholder={field.placeholder || 'mm/dd/yyyy'}
                                    required={field.required}
                                    className="field-input-clean"
                                  />
                                )}
                                {field.type === 'select' && field.options && (
                                  <select
                                    id={field.name}
                                    value={serviceData[field.name] || ''}
                                    onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                                    required={field.required}
                                    className="field-select-clean"
                                  >
                                    <option value="">اختر...</option>
                                    {field.options.map(option => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {service.id === '7' && digitalTransformationConfig && (
            <section className="form-section">
              <h2>لغة الامتحان</h2>
              <div className="exam-language-section">
                {digitalTransformationConfig.examLanguage && digitalTransformationConfig.examLanguage.length > 0 ? (
                  <div className="field-wrapper">
                    <label htmlFor="exam_language" className="field-label-clean">
                      اختر لغة الامتحان <span className="field-required">*</span>
                    </label>
                    <select
                      id="exam_language"
                      value={serviceData['exam_language'] || ''}
                      onChange={(e) => handleServiceDataChange('exam_language', e.target.value)}
                      required
                      className="field-select-clean"
                    >
                      <option value="">اختر لغة الامتحان...</option>
                      {digitalTransformationConfig.examLanguage.map((language, index) => (
                        <option key={index} value={language}>{language}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p>لا توجد لغات محددة</p>
                )}
              </div>
            </section>
          )}

          {service.paymentMethods.length > 0 && (
            <section className="form-section section-payment">
              <h2>خدمات الدفع</h2>
              {service.id === '3' && bookConfig && (
                <div className="payment-amount">
                  <strong>أسعار الشحن:</strong>
                  <div className="book-prices-list">
                    {Object.entries(bookConfig.prices).map(([copies, price]) => (
                      <div key={copies} className="price-item-row">
                        <span>كتب لـ {copies === '1' ? 'شخص' : `${copies} أشخاص`}:</span>
                        <strong>{price} جنيه</strong>
                      </div>
                    ))}
                  </div>
                  {serviceData.number_of_copies && (
                    <div className="selected-price">
                      <strong>
                        المبلغ المستحق للدفع: {bookConfig.prices[serviceData.number_of_copies] || 'يرجى تحديد عدد النسخ'} جنيه
                      </strong>
                    </div>
                  )}
                </div>
              )}
              {service.id === '4' && feesConfig && serviceData.diploma_year && feesConfig.prices[serviceData.diploma_year] && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المصروفات الدراسية لسنة {serviceData.diploma_year}: {feesConfig.prices[serviceData.diploma_year]} جنيه
                    </strong>
                  </div>
                </div>
              )}
              {service.id === '5' && assignmentsConfig && selectedAssignments.length > 0 && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: {assignmentsConfig.assignments
                        .filter(a => selectedAssignments.includes(a.id))
                        .reduce((sum, a) => sum + a.price, 0)} جنيه
                    </strong>
                  </div>
                </div>
              )}
              {service.id === '6' && selectedCertificate && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: {selectedCertificate.price} جنيه
                    </strong>
                  </div>
                </div>
              )}
              {service.id === '7' && digitalTransformationConfig && serviceData.transformation_type && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: {
                        digitalTransformationConfig.transformationTypes.find(t => t.id === serviceData.transformation_type)?.price || 0
                      } جنيه
                    </strong>
                  </div>
                </div>
              )}
              {service.id === '8' && finalReviewConfig && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: {finalReviewConfig.paymentAmount} جنيه
                    </strong>
                  </div>
                </div>
              )}
              {service.id === '9' && graduationProjectConfig && graduationProjectConfig.prices && graduationProjectConfig.prices.length > 0 && (
                <div className="payment-amount">
                  <div className="graduation-prices-list">
                    {graduationProjectConfig.prices.map((priceItem) => (
                      <div key={priceItem.id} className="selected-price graduation-price-item">
                        <strong>المبلغ المستحق للدفع: {priceItem.price} جنيه</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="payment-methods">
                {service.paymentMethods && service.paymentMethods.length > 0 && service.paymentMethods.map(method => {
                  let phoneNumber = '';
                  if (service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9') {
                    if (service.id === '6' && certificatesConfig) {
                      switch (method) {
                        case 'Vodafone':
                        case 'Etisalat':
                        case 'Orange':
                          phoneNumber = certificatesConfig.paymentMethods.cashWallet;
                          break;
                        case 'instaPay':
                          phoneNumber = certificatesConfig.paymentMethods.instaPay;
                          break;
                        default:
                          phoneNumber = '';
                      }
                    } else if (service.id === '5' && assignmentsConfig) {
                      switch (method) {
                        case 'Vodafone':
                        case 'Etisalat':
                        case 'Orange':
                          phoneNumber = assignmentsConfig.paymentMethods.cashWallet;
                          break;
                        case 'instaPay':
                          phoneNumber = assignmentsConfig.paymentMethods.instaPay;
                          break;
                        default:
                          phoneNumber = '';
                      }
                    } else if (service.id === '7' && digitalTransformationConfig) {
                      switch (method) {
                        case 'Vodafone':
                        case 'Etisalat':
                        case 'Orange':
                          phoneNumber = digitalTransformationConfig.paymentMethods.cashWallet;
                          break;
                        case 'instaPay':
                          phoneNumber = digitalTransformationConfig.paymentMethods.instaPay;
                          break;
                        default:
                          phoneNumber = '';
                      }
                    } else if (service.id === '8' && finalReviewConfig) {
                      switch (method) {
                        case 'Vodafone':
                        case 'Etisalat':
                        case 'Orange':
                          phoneNumber = finalReviewConfig.paymentMethods.cashWallet;
                          break;
                        case 'instaPay':
                          phoneNumber = finalReviewConfig.paymentMethods.instaPay;
                          break;
                        default:
                          phoneNumber = '';
                      }
                    } else if (service.id === '9' && graduationProjectConfig) {
                      switch (method) {
                        case 'Vodafone':
                        case 'Etisalat':
                        case 'Orange':
                          phoneNumber = graduationProjectConfig.paymentMethods.cashWallet;
                          break;
                        case 'instaPay':
                          phoneNumber = graduationProjectConfig.paymentMethods.instaPay;
                          break;
                        default:
                          phoneNumber = '';
                      }
                    } else {
                      switch (method) {
                        case 'Vodafone':
                        case 'Etisalat':
                        case 'Orange':
                          phoneNumber = '01050889591';
                          break;
                        case 'instaPay':
                          phoneNumber = '01017180923';
                          break;
                        default:
                          phoneNumber = '';
                      }
                    }
                  }

                  return (
                    <label key={method} className="payment-option">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={selectedPaymentMethod === method}
                        onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      />
                      <div className="payment-info">
                        <span className="payment-label">{method}</span>
                        {phoneNumber && (
                          <span className="payment-number">{phoneNumber}</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {(service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9') && (
            <section className="form-section section-receipt">
              <h2>رفع صورة الإيصال</h2>
              <p className="receipt-note">يرجى رفع صورة إيصال الدفع قبل تقديم الطلب</p>
              <FileUpload
                onFilesSelected={setReceiptFiles}
                maxFileSize={5 * 1024 * 1024}
                acceptedFormats={['JPEG', 'PNG', 'PDF']}
              />
            </section>
          )}

          {uploadProgress.uploading && (
            <div className="loading-overlay">
              <div className="loading-modal">
                <div className="loading-spinner-container">
                  <Loader2 className="spinning-loader-large" size={64} />
                </div>
                <h3 className="loading-title">
                  {service.id === '2' && receiptFiles.length > 0
                    ? 'جاري رفع الملفات'
                    : 'جاري تقديم الطلب'}
                </h3>
                <p className="loading-subtitle">يرجى الانتظار...</p>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${uploadProgress.progress}%` }}
                    ></div>
                  </div>
                  <span className="progress-percentage-text">{uploadProgress.progress}%</span>
                </div>
              </div>
            </div>
          )}

          {submitMessage && (
            <div className={`message ${submitMessage.type}`}>
              {submitMessage.type === 'error' && <AlertCircle size={18} />}
              <span>{submitMessage.text}</span>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              onClick={onBack}
              className="cancel-button"
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || ((service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9') && receiptFiles.length === 0)}
            >
              {isSubmitting ? 'جاري التقديم...' : 'تقديم الطلب'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ServiceDetailsPage;
