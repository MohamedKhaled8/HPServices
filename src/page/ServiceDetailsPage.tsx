import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { ServiceRequest, UploadedFile, ServiceSettings } from '../types';
import { getBookServiceConfig, getFeesServiceConfig, getAssignmentsServiceConfig, getCertificatesServiceConfig, getDigitalTransformationConfig, getFinalReviewConfig, getGraduationProjectConfig, updateStudentData, subscribeToServiceSettings } from '../services/firebaseService';
import { BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig, CertificateItem, DigitalTransformationConfig, FinalReviewConfig, GraduationProjectConfig } from '../types';
import { calculateTrack, getAvailableTracks, normalizeTrackName } from '../utils/trackUtils';
import { ArrowRight, Edit2, AlertCircle, Pencil, Loader2, Award, CheckCircle, FileText, Trash2, Plus } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { logger } from '../utils/logger';
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
  const { student, addServiceRequest, setStudent } = useStudent();
  const service = SERVICES.find(s => s.id === serviceId);

  const [serviceData, setServiceData] = useState<Record<string, any>>({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [transferPhoneNumber, setTransferPhoneNumber] = useState<string>('');
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
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [serviceSettings, setServiceSettings] = useState<ServiceSettings>({});
  const [wantsMalazem, setWantsMalazem] = useState(false);
  const [missingFieldNames, setMissingFieldNames] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToServiceSettings(setServiceSettings);
    return () => unsubscribe();
  }, []);

  const getDisabledFields = (serviceId: string) => {
    const setting = serviceSettings[serviceId];
    if (typeof setting === 'object' && setting !== null && setting.disabledFields) {
      return setting.disabledFields;
    }
    return [];
  };

  const disabledFields = getDisabledFields(serviceId);

  // Scroll to top and reset state when service changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setReceiptFiles([]);
    setSelectedPaymentMethod('');
    setTransferPhoneNumber('');
    setSubmitMessage(null);
  }, [serviceId]);

  // Lock scroll when uploading
  useEffect(() => {
    if (uploadProgress.uploading) {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh'; // Force body height to prevent jump
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [uploadProgress.uploading]);

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
              serviceName: 'شحن الكتب الدراسية',
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
          logger.error('Error loading book config:', error);
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
            if (!config.paymentMethods) {
              config.paymentMethods = {
                instaPay: '01017180923',
                cashWallet: '01050889591'
              };
            }
            setFeesConfig(config);
          } else {
            // Default config
            setFeesConfig({
              prices: {},
              paymentMethods: {
                instaPay: '01017180923',
                cashWallet: '01050889591'
              }
            });
          }
        } catch (error) {
          logger.error('Error loading fees config:', error);
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
          logger.error('Error loading assignments config:', error);
        }
      };
      loadAssignmentsConfig();
    }
    if (service.id === '6') {
      const loadCertificatesConfig = async () => {
        try {
          logger.log('Loading certificates config in ServiceDetailsPage...');
          const config = await getCertificatesServiceConfig();
          if (config) {
            logger.log('Setting certificates config in ServiceDetailsPage:', config.certificates?.length || 0, 'certificates');
            logger.log('Certificates details:', config.certificates?.map(c => ({
              id: c.id,
              name: c.name,
              hasImage: !!c.imageUrl,
              imageUrlLength: c.imageUrl?.length || 0
            })));
            setCertificatesConfig(config);
          } else {
            logger.log('No certificates config found in ServiceDetailsPage');
            setCertificatesConfig(null);
          }
        } catch (error) {
          logger.error('Error loading certificates config in ServiceDetailsPage:', error);
          setCertificatesConfig(null);
        }
      };
      loadCertificatesConfig();
    }

    if (service.id === '7') {
      const loadDigitalTransformationConfig = async () => {
        try {
          logger.log('Loading digital transformation config in ServiceDetailsPage...');
          const config = await getDigitalTransformationConfig();
          if (config) {
            logger.log('Setting digital transformation config in ServiceDetailsPage:', config.transformationTypes?.length || 0, 'types');
            setDigitalTransformationConfig(config);
          } else {
            logger.log('No digital transformation config found in ServiceDetailsPage');
            setDigitalTransformationConfig(null);
          }
        } catch (error) {
          logger.error('Error loading digital transformation config in ServiceDetailsPage:', error);
          setDigitalTransformationConfig(null);
        }
      };
      loadDigitalTransformationConfig();
    }

    if (service.id === '8') {
      const loadFinalReviewConfig = async () => {
        try {
          logger.log('Loading final review config in ServiceDetailsPage...');
          const config = await getFinalReviewConfig();
          if (config) {
            logger.log('Setting final review config in ServiceDetailsPage:', config);
            setFinalReviewConfig(config);
          } else {
            logger.log('No final review config found in ServiceDetailsPage');
            setFinalReviewConfig(null);
          }
        } catch (error) {
          logger.error('Error loading final review config in ServiceDetailsPage:', error);
          setFinalReviewConfig(null);
        }
      };
      loadFinalReviewConfig();
    }

    if (service.id === '9') {
      const loadGraduationProjectConfig = async () => {
        try {
          logger.log('Loading graduation project config in ServiceDetailsPage...');
          const config = await getGraduationProjectConfig();
          if (config) {
            logger.log('Setting graduation project config in ServiceDetailsPage:', config);
            setGraduationProjectConfig(config);
          } else {
            logger.log('No graduation project config found in ServiceDetailsPage');
            setGraduationProjectConfig(null);
          }
        } catch (error) {
          logger.error('Error loading graduation project config in ServiceDetailsPage:', error);
          setGraduationProjectConfig(null);
        }
      };
      loadGraduationProjectConfig();
    }
  }, [service?.id]);

  // ملء البيانات الشخصية تلقائياً من بيانات المستخدم للخدمة الأول و VIP و دفع المصروفات
  useEffect(() => {
    if (!service || !student) return;

    if (service.id === '1' || service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') {
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
            case 'address_details':
              initialData[field.name] = addressString;
              break;
            case 'email':
              initialData[field.name] = student.email || '';
              break;
            case 'whatsapp_number':
              initialData[field.name] = student.whatsappNumber || '';
              break;
          }
        } else if (field.type === 'select') {
          if (service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') {
            // Set default values for service 4, 5, 8, 9, and 10 fields
            switch (field.name) {
              case 'diploma_type':
                if (student.diplomaType && student.diplomaType.trim() !== '') {
                  initialData[field.name] = student.diplomaType;
                } else {
                  initialData[field.name] = 'اختر نوع الدبلومة';
                }
                break;
              case 'diploma_year':
                if (service.id === '10') {
                  initialData[field.name] = 'اختر سنة الدبلومة';
                } else if (student.diplomaYear && student.diplomaYear.trim() !== '') {
                  initialData[field.name] = student.diplomaYear;
                } else {
                  initialData[field.name] = 'اختر السنه';
                }
                break;
              case 'educational_specialization':
                if (student.course && student.course.trim() !== '') {
                  initialData[field.name] = student.course;
                } else {
                  initialData[field.name] = 'اختر التخصص';
                }
                break;
              case 'track_category':
              case 'track':
                if (student.track && student.track.trim() !== '') {
                  initialData[field.name] = student.track;
                } else {
                  initialData[field.name] = 'اختر المسار';
                }
                break;
            }
          } else if (service.id === '1') {
            // Pre-fill Service 1 select fields from profile
            switch (field.name) {
              case 'college':
                if (student.college) initialData[field.name] = student.college;
                break;
              case 'department':
                if (student.department) initialData[field.name] = student.department;
                break;
              case 'grade':
                if (student.grade) initialData[field.name] = student.grade;
                break;
            }
          }
        } else if (field.type === 'text') {
          // Auto-fill text fields that contain phone/whatsapp
          if (field.name.includes('phone') || field.name.includes('whatsapp')) {
            initialData[field.name] = student.whatsappNumber || '';
          }
        } else if (field.type === 'textarea') {
          // Auto-fill textarea fields like address_details
          if (field.name.includes('address')) {
            initialData[field.name] = addressString;
          }
        }
      });

      // Special defaults for Service 3 (Book Shipping)
      if (service.id === '3') {
        initialData['number_of_copies'] = 1;
        initialData['names_array'] = [''];
        initialData['tracks_array'] = [''];
        initialData['phone_whatsapp'] = student.whatsappNumber || '';
        initialData['diploma_type'] = student.diplomaType || 'اختر نوع الدبلومة';
      }

      setServiceData(initialData);

      // تعيين جميع الحقول القابلة للتعديل كغير قابلة للتعديل في البداية
      const editableState: Record<string, boolean> = {};
      service.fields.forEach(field => {
        if (field.type === 'editable') {
          editableState[field.name] = false;
        }
        // Also set track fields as non-editable initially
        if ((field.name === 'track' || field.name === 'track_category') && service.id !== '1') {
          editableState[field.name] = false;
        }
      });
      // For Service 1, also set student_track as non-editable
      if (service.id === '1' && student.track) {
        editableState['student_track'] = false;
      }
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
    if (missingFieldNames.includes(fieldName)) {
      setMissingFieldNames(prev => prev.filter(name => name !== fieldName));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage(null);

    const missingFieldsObjects = service.fields
      .filter(field => field.required && (!serviceData[field.name] || (typeof serviceData[field.name] === 'string' && (serviceData[field.name].trim() === '' || serviceData[field.name].includes('اختر')))));

    const missingFields = missingFieldsObjects.map(field => field.label);
    const newMissingNames = missingFieldsObjects.map(field => field.name);

    if (service.paymentMethods.length > 0 && !selectedPaymentMethod) {
      newMissingNames.push('paymentMethod');
    }

    if ((service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') && !disabledFields.includes('receipt_upload') && receiptFiles.length === 0) {
      newMissingNames.push('receipt_upload');
    }

    if (service.id === '5' && selectedAssignments.length === 0) {
      newMissingNames.push('assignments');
    }

    if (service.id === '6' && !selectedCertificate) {
      newMissingNames.push('certificate');
    }

    setMissingFieldNames(newMissingNames);

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

      if (namesArray.length !== copiesCount || namesArray.some((name: string) => !name || !name.trim())) {
        setSubmitMessage({
          type: 'error',
          text: `يرجى ملء جميع الأسماء الرباعية (${copiesCount} أسماء مطلوبة)`
        });
        setIsSubmitting(false);
        return;
      }

      if (tracksArray.length !== copiesCount || tracksArray.some((track: string) => !track || !track.trim())) {
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

    // للخدمة VIP وخدمة الكتب وخدمة التكليفات والشهادات ومشروع التخرج واستخراج المستندات، يجب رفع صورة الإيصال
    if ((service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') && receiptFiles.length === 0) {
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
        text: 'يرجى اختيار نوع التدريب'
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Show upload progress for all services
      setUploadProgress({ uploading: true, progress: 0 });

      // Fix TypeScript inferred type by typing requestData as Record<string, any>
      const requestData: Record<string, any> = {
        ...serviceData,
        ...(transferPhoneNumber ? { transfer_phone_number: transferPhoneNumber } : {})
      };

      // Malazem only for service 7 (Digital Transformation)
      if (service.id === '7' && wantsMalazem) {
        requestData.wantsMalazem = true;
      }

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
          requestData.totalPrice = selectedType.price + (wantsMalazem ? 200 : 0);
        }
        if (serviceData.exam_language) {
          requestData.selectedExamLanguage = serviceData.exam_language;
        }
      }

      if (service.id === '8' && finalReviewConfig) {
        requestData.totalPrice = finalReviewConfig.paymentAmount;
      }

      if (service.id === '2') {
        requestData.totalPrice = 500;
      }
      if (service.id === '3' && bookConfig && serviceData.number_of_copies) {
        requestData.totalPrice = bookConfig.prices[serviceData.number_of_copies] || 0;
      }
      if (service.id === '4' && feesConfig && serviceData.diploma_year) {
        requestData.totalPrice = feesConfig.prices[serviceData.diploma_year] || 0;
      }
      if (service.id === '10') {
        requestData.totalPrice = 700;
      }
      if (service.id === '11') {
        requestData.totalPrice = 300;
      }

      const request: ServiceRequest = {
        studentId: student.id || '',
        serviceId: service.id,
        data: requestData,
        documents: (service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') ? receiptFiles : [],
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

      // Special handling for Service 1 (Register Data)
      if (service.id === '1') {
        const college = serviceData['college'];
        const department = serviceData['department'];
        const grade = serviceData['grade'];

        // Calculate Track
        const calculatedTrack = calculateTrack(college, department, grade);

        if (calculatedTrack && student.id) {
          // Use edited track from serviceData if available, otherwise use calculated track
          const finalTrack = serviceData['track'] || calculatedTrack;

          // Update Student Profile with track
          const updatedStudentData = {
            college,
            department,
            grade,
            track: finalTrack
          };

          await updateStudentData(student.id, updatedStudentData);

          // Update local context immediately to reflect changes
          setStudent({
            ...student,
            ...updatedStudentData
          });
        }
      }

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


          {(service.id === '9' || service.id === '2') && (service.features || (graduationProjectConfig && graduationProjectConfig.features)) && (
            <section className={`form-section section-features ${service.id === '2' ? 'premium-features' : ''}`}>
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

          {/* Required Documents Section for Service 10 */}
          {service.id === '10' && service.requiredDocuments && (
            <section className="form-section section-features required-docs">
              <h2>المستندات المطلوبة</h2>
              <ul className="features-list">
                {service.requiredDocuments.map((doc, index) => (
                  <li key={index} className="feature-item">
                    <FileText size={16} className="feature-icon" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Book Shipping Prices Section (Moved Up) */}
          {service.id === '3' && bookConfig && (
            <section className="form-section section-features">
              <h2>تفاصيل وأسعار النسخ</h2>
              <div className="book-prices-list">
                {Object.entries(bookConfig.prices).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([copies, price]) => (
                  <div key={copies} className="price-item-row">
                    <span>نسخة {copies === '1' ? 'واحدة' : copies === '2' ? 'نسختين' : `${copies} نسخ`}:</span>
                    <strong>{price} جنيه</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="form-section section-service-data">
            <h2>{service.id === '1' ? 'بيانات التسجيل' : 'بيانات الخدمة'}</h2>
            <div className="service-fields">
              {service.fields.filter(field => !disabledFields.includes(field.name)).map(field => {
                // تجاهل حقول Other إذا لم يتم اختيار Other أو أخرى
                if (field.name.endsWith('_other')) {
                  const parentFieldName = field.name.replace('_other', '');
                  const parentValue = serviceData[parentFieldName];
                  if (parentValue !== 'Other' && parentValue !== 'أخرى') {
                    return null;
                  }
                }

                return (
                  <div key={field.name} className={`form-group ${missingFieldNames.includes(field.name) ? 'error-group' : ''}`}>
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
                            type={field.name === 'email' ? 'email' : (field.name.includes('phone') || field.name.includes('whatsapp') || field.name.includes('national_id') ? 'tel' : 'text')}
                            inputMode={(field.name.includes('phone') || field.name.includes('whatsapp') || field.name.includes('national_id')) ? 'numeric' : 'text'}
                            maxLength={(field.name.includes('phone') || field.name.includes('whatsapp')) ? 11 : (field.name.includes('national_id') ? 14 : undefined)}
                            value={serviceData[field.name] || ''}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (field.name.includes('phone') || field.name.includes('whatsapp') || field.name.includes('national_id')) {
                                val = val.replace(/\D/g, '');
                              }
                              handleServiceDataChange(field.name, val);
                            }}
                            placeholder={field.name === 'email' ? 'example@gmail.com' : field.label}
                            required={field.required}
                            className={`editable-input ${missingFieldNames.includes(field.name) ? 'error-border' : ''}`}
                          />
                        )}
                      </div>
                    )}

                    {field.type === 'text' && (
                      <input
                        id={field.name}
                        type={field.name.includes('phone') || field.name.includes('whatsapp') || field.name.includes('mobile') || field.name.includes('id') ? 'tel' : 'text'}
                        inputMode={field.name.includes('phone') || field.name.includes('whatsapp') || field.name.includes('mobile') || field.name.includes('id') ? 'numeric' : 'text'}
                        maxLength={field.name.includes('phone') || field.name.includes('whatsapp') ? 11 : (field.name.includes('id') ? 14 : undefined)}
                        value={serviceData[field.name] || ''}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (field.name.includes('phone') || field.name.includes('whatsapp') || field.name.includes('mobile') || field.name.includes('id')) {
                            val = val.replace(/\D/g, '');
                          }
                          handleServiceDataChange(field.name, val);
                        }}
                        placeholder={field.label}
                        required={field.required}
                        className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
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
                          // السماح بمسح الحقل تماماً
                          if (inputValue === '') {
                            handleServiceDataChange(field.name, '');
                            return;
                          }

                          let value = parseInt(inputValue);
                          if (!isNaN(value)) {
                            // السماح بالصفر أثناء الكتابة ولكن نقيد الحد الأقصى فقط
                            if (value > 10) value = 10;
                            if (value < 0) value = 1;

                            // Special logic for Service 3 copies to update arrays efficiently
                            if (service.id === '3' && field.name === 'number_of_copies') {
                              setServiceData(prev => {
                                // Clamp value strictly for state update to be safe
                                const finalValue = value > 10 ? 10 : (value < 1 ? 1 : value);

                                const currentNames = prev.names_array || [];
                                const currentTracks = prev.tracks_array || [];

                                const newNames = Array.from({ length: finalValue }, (_, i) => currentNames[i] || '');
                                const newTracks = Array.from({ length: finalValue }, (_, i) => currentTracks[i] || '');

                                return {
                                  ...prev,
                                  [field.name]: finalValue,
                                  names_array: newNames,
                                  tracks_array: newTracks,
                                  names: newNames.join('\n'),
                                  tracks: newTracks.join('\n')
                                };
                              });
                            } else {
                              // Normal update for other number fields
                              handleServiceDataChange(field.name, value);
                            }
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder={field.label}
                        required={field.required}
                        className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
                      />
                    )}

                    {field.type === 'select' && (
                      <>
                        {(field.name === 'track' || field.name === 'track_category') && service.id !== '1' && student.track ? (
                          // Special rendering for Track field in other services: Show Read-only with Edit Button
                          !editableFields[field.name] ? (
                            <div className="editable-field-container">
                              <div className="editable-field-display">
                                <div className="calculated-track-display-mini">
                                  {normalizeTrackName(student.track)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleFieldEdit(field.name)}
                                  className="edit-field-button"
                                  title="تعديل المسار"
                                >
                                  <Pencil size={16} />
                                </button>
                              </div>
                              <p className="field-note-mini">هذا هو مسارك الافتراضي: <strong>{student.track}</strong>. يمكنك تعديله للأقل.</p>
                            </div>
                          ) : (
                            // Enum dropdown (already existing logic below will handle options, but we wrap in container to show cancel?)
                            // Actually we just let it fall through to the select render, but we need to ensure it renders correctly.
                            // We'll duplicate the select render here for specific control or just use a flag?
                            // Let's implement specific render for track when editing.
                            <div className="editable-field-container">
                              <select
                                id={field.name}
                                value={serviceData[field.name] || student.track || ''}
                                onChange={(e) => {
                                  handleServiceDataChange(field.name, e.target.value);
                                }}
                                required={field.required}
                                className={`editable-input ${missingFieldNames.includes(field.name) ? 'error-border' : ''}`}
                              >
                                <option value="">اختر المسار...</option>
                                {field.options?.slice(1).filter(option => {
                                  // Filter track options if applicable - fallback for Service 1 or no student track
                                  if ((field.name === 'track' || field.name === 'track_category') && student?.track) {
                                    const allowed = getAvailableTracks(student.track);
                                    return allowed.includes(option);
                                  }
                                  return true;
                                }).map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => toggleFieldEdit(field.name)}
                                className="edit-field-button cancel-edit"
                                title="إلغاء التعديل"
                              >
                                x
                              </button>
                            </div>
                          )
                        ) : (
                          // Normal Select Render
                          field.name === 'diploma_year' && service.id === '4' && feesConfig ? (
                            <select
                              id={field.name}
                              value={serviceData[field.name] || ''}
                              onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                              required={field.required}
                              className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
                            >
                              <option value="">اختر السنه</option>
                              {feesConfig ? (
                                Object.keys(feesConfig.prices).sort((a, b) => parseInt(b) - parseInt(a)).map(year => (
                                  <option key={year} value={year}>
                                    {year} - {feesConfig.prices[year]} جنيه
                                  </option>
                                ))
                              ) : (
                                <option disabled>جاري تحميل السنوات...</option>
                              )}
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
                                  className={`other-input ${missingFieldNames.includes(field.name) ? 'error-border' : ''}`}
                                />
                              )}
                            </>
                          ) : field.name === 'diploma_year' && service.id === '10' ? (
                            <select
                              id={field.name}
                              value={serviceData[field.name] || ''}
                              onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                              required={field.required}
                              className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
                            >
                              <option value="">اختر سنة الدبلومة</option>
                              {Array.from({ length: 60 }, (_, i) => {
                                const startYear = 2029 - i;
                                const endYear = 2030 - i;
                                return (
                                  <option key={startYear} value={`${startYear}/${endYear}`}>
                                    {startYear}/{endYear}
                                  </option>
                                );
                              })}
                            </select>
                          ) : field.name === 'transformation_type' && service.id === '7' ? (
                            <select
                              id={field.name}
                              value={serviceData[field.name] || ''}
                              onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                              required={field.required}
                              className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
                            >
                              <option value="">اختر نوع التحول الرقمي</option>
                              {digitalTransformationConfig ? (
                                digitalTransformationConfig.transformationTypes.map(type => (
                                  <option key={type.id} value={type.id}>
                                    {type.name} - {type.price} جنيه
                                  </option>
                                ))
                              ) : (
                                <option disabled>جاري تحميل الأنواع...</option>
                              )}
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
                                className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
                              >
                                {field.options?.[0]?.includes('اختر') ? (
                                  <option value={field.options[0]}>{field.options[0]}</option>
                                ) : (
                                  <option value="">اختر...</option>
                                )}
                                {field.options?.slice(field.options[0]?.includes('اختر') ? 1 : 0)
                                  .filter(option => {
                                    // Fallback filter for situations where read-only mode isn't active (e.g. Service 1 or no track yet)
                                    if ((field.name === 'track' || field.name === 'track_category') && student?.track) {
                                      const allowed = getAvailableTracks(student.track);
                                      return allowed.includes(option);
                                    }
                                    return true;
                                  })
                                  .map(option => (
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
                                  className={`other-input ${missingFieldNames.includes(field.name + '_other') ? 'error-border' : ''}`}
                                />
                              )}
                            </>
                          )
                        )}
                      </>
                    )}

                    {field.type === 'dynamic_list' && (
                      <div className="dynamic-list-container">
                        <div className="existing-list">
                          {(serviceData[field.name]?.split('\n').filter((s: string) => s.trim() !== '') || []).map((item: string, index: number) => (
                            <div key={index} className="dynamic-list-item">
                              <input
                                type="text"
                                value={item}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  const currentList = serviceData[field.name] ? serviceData[field.name].split('\n') : [];
                                  if (currentList[index] !== undefined) {
                                    currentList[index] = newVal;
                                    handleServiceDataChange(field.name, currentList.join('\n'));
                                  }
                                }}
                                className="dynamic-item-input"
                              />
                              <button
                                type="button"
                                className="delete-item-btn"
                                onClick={() => {
                                  let currentList = serviceData[field.name] ? serviceData[field.name].split('\n') : [];
                                  currentList.splice(index, 1);
                                  handleServiceDataChange(field.name, currentList.join('\n'));
                                }}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="add-new-item-row">
                          <input
                            type="text"
                            placeholder="أضف اسم طالب..."
                            id={`new-item-${field.name}`}
                            className="new-item-input"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const val = input.value.trim();
                                if (val) {
                                  let currentList = serviceData[field.name] ? serviceData[field.name].split('\n') : [];
                                  // Filter out empty strings if any existed before pushing
                                  currentList = currentList.filter((s: string) => s.trim() !== '');
                                  currentList.push(val);
                                  handleServiceDataChange(field.name, currentList.join('\n'));
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="add-item-btn"
                            onClick={() => {
                              const input = document.getElementById(`new-item-${field.name}`) as HTMLInputElement;
                              if (input && input.value.trim()) {
                                const val = input.value.trim();
                                let currentList = serviceData[field.name] ? serviceData[field.name].split('\n') : [];
                                currentList = currentList.filter((s: string) => s.trim() !== '');
                                currentList.push(val);
                                handleServiceDataChange(field.name, currentList.join('\n'));
                                input.value = '';
                              }
                            }}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        id={field.name}
                        value={serviceData[field.name] || ''}
                        onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                        placeholder={field.label}
                        required={field.required}
                        rows={4}
                        className={missingFieldNames.includes(field.name) ? 'error-border' : ''}
                      />
                    )}
                  </div>
                );
              })}

              {/* Display Track for Service 1 if student has one */}
              {service.id === '1' && student.track && (
                <div className={`form-group ${missingFieldNames.includes('track') ? 'error-group' : ''}`} style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="student-track">
                    المسار المحسوب
                    <span className="required">*</span>
                  </label>
                  {!editableFields['student_track'] ? (
                    <div className="editable-field-container">
                      <div className="editable-field-display">
                        <div className="calculated-track-display-mini">
                          {normalizeTrackName(student.track)}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFieldEdit('student_track')}
                          className="edit-field-button"
                          title="تعديل المسار"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                      <p className="field-note-mini">هذا هو مسارك المحفوظ: <strong>{student.track}</strong>. يمكنك تعديله للأقل.</p>
                    </div>
                  ) : (
                    <div className="editable-field-container">
                      <select
                        id="student-track"
                        value={serviceData['track'] || student.track || ''}
                        onChange={(e) => handleServiceDataChange('track', e.target.value)}
                        className={`editable-input ${missingFieldNames.includes('track') ? 'error-border' : ''}`}
                      >
                        <option value="">اختر المسار...</option>
                        {getAvailableTracks(student.track).map(track => (
                          <option key={track} value={track}>{track}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleFieldEdit('student_track')}
                        className="edit-field-button cancel-edit"
                        title="إلغاء التعديل"
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              )}



              {/* Dynamic Names and Tracks Fields for Books Service - داخل نفس القسم */}
              {service.id === '3' && serviceData.number_of_copies && serviceData.number_of_copies !== '' && parseInt(serviceData.number_of_copies) > 0 && (
                <div style={{ gridColumn: '1 / -1', width: '100%', marginTop: '20px' }}>
                  <div className="dynamic-fields-section">
                    <h3 className="dynamic-fields-title" style={{ marginBottom: '15px', color: '#4F46E5', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                      تفاصيل النسخ ({serviceData.number_of_copies})
                    </h3>

                    <div className="dynamic-fields-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {Array.from({ length: Math.min(parseInt(serviceData.number_of_copies) || 1, 10) }, (_, index) => {
                        const numberNames = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
                        const ordName = numberNames[index] || (index + 1);

                        return (
                          <div key={index} className="copy-row-container" style={{
                            display: 'flex',
                            gap: '15px',
                            alignItems: 'flex-start',
                            background: '#f8fafc',
                            padding: '15px',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {/* رقم النسخة */}
                            <div style={{
                              minWidth: '30px',
                              height: '30px',
                              background: '#4F46E5',
                              color: 'white',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              marginTop: '25px',
                              flexShrink: 0
                            }}>
                              {index + 1}
                            </div>

                            {/* حقل الاسم */}
                            <div className={`form-group ${missingFieldNames.includes(`name_${index}`) ? 'error-group' : ''}`} style={{ flex: 1, marginBottom: 0 }}>
                              <label htmlFor={`name_${index}`} style={{ fontSize: '14px' }}>
                                الاسم {ordName} رباعي
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
                                    names: namesArray.join('\n')
                                  }));
                                  setMissingFieldNames(prev => prev.filter(name => name !== `name_${index}`));
                                }}
                                placeholder={`اكتب الاسم ${ordName} رباعي`}
                                required
                                style={{ width: '100%' }}
                                className={missingFieldNames.includes(`name_${index}`) ? 'error-border' : ''}
                              />
                            </div>

                            {/* حقل المسار */}
                            <div className={`form-group ${missingFieldNames.includes(`track_${index}`) ? 'error-group' : ''}`} style={{ flex: 1, marginBottom: 0 }}>
                              <label htmlFor={`track_${index}`} style={{ fontSize: '14px' }}>
                                اكتب المسار و التخصص
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
                                    tracks: tracksArray.join('\n')
                                  }));
                                  setMissingFieldNames(prev => prev.filter(name => name !== `track_${index}`));
                                }}
                                placeholder="اكتب المسار و التخصص"
                                required
                                style={{ width: '100%' }}
                                className={missingFieldNames.includes(`track_${index}`) ? 'error-border' : ''}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>


          {service.id === '6' && certificatesConfig && certificatesConfig.certificates && (
            <section className="certificates-section-modern">
              <div className={`certificates-container ${missingFieldNames.includes('certificate') ? 'error-group' : ''}`}>
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
                          onClick={() => {
                            setSelectedCertificate(certificate);
                            setMissingFieldNames(prev => prev.filter(name => name !== 'certificate'));
                          }}
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
                              <div key={field.name} className={`field-wrapper ${missingFieldNames.includes(field.name) ? 'error-group' : ''}`}>
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
                                    className={`field-input-clean ${missingFieldNames.includes(field.name) ? 'error-border' : ''}`}
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
                                    className={`field-input-clean ${missingFieldNames.includes(field.name) ? 'error-border' : ''}`}
                                  />
                                )}
                                {field.type === 'select' && field.options && (
                                  <select
                                    id={field.name}
                                    value={serviceData[field.name] || ''}
                                    onChange={(e) => handleServiceDataChange(field.name, e.target.value)}
                                    required={field.required}
                                    className={`field-select-clean ${missingFieldNames.includes(field.name) ? 'error-border' : ''}`}
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
              <h2>نوع التدريب</h2>
              <div className="exam-language-section">
                {digitalTransformationConfig.examLanguage && digitalTransformationConfig.examLanguage.length > 0 ? (
                  <div className={`field-wrapper ${missingFieldNames.includes('exam_language') ? 'error-group' : ''}`}>
                    <label htmlFor="exam_language" className="field-label-clean">
                      اختر نوع التدريب <span className="field-required">*</span>
                    </label>
                    <select
                      id="exam_language"
                      value={serviceData['exam_language'] || ''}
                      onChange={(e) => handleServiceDataChange('exam_language', e.target.value)}
                      required
                      className={`field-select-clean ${missingFieldNames.includes('exam_language') ? 'error-border' : ''}`}
                    >
                      <option value="">اختر نوع التدريب...</option>
                      {digitalTransformationConfig.examLanguage.map((language, index) => (
                        <option key={index} value={language}>{language}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p>لا توجد أنواع محددة</p>
                )}
              </div>
            </section>
          )}

          {!disabledFields.includes('payment_section') && service.paymentMethods && service.paymentMethods.length > 0 && (
            <section className="form-section section-payment">
              <h2>خدمات الدفع</h2>

              {service.id === '7' && (
                <div style={{ marginBottom: '20px', padding: '15px', background: 'linear-gradient(135deg, #eff6ff, #e0f2fe)', borderRadius: '12px', border: '1px solid #93c5fd', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', color: '#1e3a8a' }}>
                    <input
                      type="checkbox"
                      checked={wantsMalazem}
                      onChange={(e) => setWantsMalazem(e.target.checked)}
                      style={{ width: '22px', height: '22px', accentColor: '#2563eb', borderRadius: '4px' }}
                    />
                    <div>
                      <span>إضافة ملازم مع طلب التقديم</span>
                      <span style={{ display: 'block', fontSize: '13px', color: '#3b82f6', fontWeight: '600', marginTop: '2px' }}>+ 200 جنيه إضافية</span>
                    </div>
                  </label>
                </div>
              )}

              {service.id === '3' && bookConfig && (
                <div className="payment-amount">
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
                      مصروفات السنة الدراسية {serviceData.diploma_year}: {feesConfig.prices[serviceData.diploma_year]} جنيه
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
              {service.id === '10' && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: 700 جنيه
                    </strong>
                  </div>
                </div>
              )}
              {service.id === '11' && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: 300 جنيه
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
                        (digitalTransformationConfig.transformationTypes.find(t => t.id === serviceData.transformation_type)?.price || 0) + (wantsMalazem ? 200 : 0)
                      } جنيه
                      {wantsMalazem && <span style={{ fontSize: '13px', color: '#2563eb', marginRight: '8px' }}>(شامل 200 جنيه ملازم)</span>}
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
              {service.id === '2' && (
                <div className="payment-amount">
                  <div className="selected-price">
                    <strong>
                      المبلغ المستحق للدفع: 500 جنيه للترم الواحد
                    </strong>
                  </div>
                </div>
              )}
              <div className={`payment-methods ${missingFieldNames.includes('paymentMethod') ? 'error-border' : ''}`}>
                {service.paymentMethods && service.paymentMethods.length > 0 && service.paymentMethods.map(method => {
                  let phoneNumber = '';

                  // Define default numbers
                  const defaultWallet = '01050889591';
                  const defaultInstaPay = '01017180923';

                  // Try to get from specific configs first
                  if (service.id === '3' && bookConfig?.paymentMethods) {
                    phoneNumber = (method === 'instaPay') ? bookConfig.paymentMethods.instaPay : bookConfig.paymentMethods.cashWallet;
                  } else if (service.id === '5' && assignmentsConfig?.paymentMethods) {
                    phoneNumber = (method === 'instaPay') ? assignmentsConfig.paymentMethods.instaPay : assignmentsConfig.paymentMethods.cashWallet;
                  } else if (service.id === '6' && certificatesConfig?.paymentMethods) {
                    phoneNumber = (method === 'instaPay') ? certificatesConfig.paymentMethods.instaPay : certificatesConfig.paymentMethods.cashWallet;
                  } else if (service.id === '7' && digitalTransformationConfig?.paymentMethods) {
                    phoneNumber = (method === 'instaPay') ? digitalTransformationConfig.paymentMethods.instaPay : digitalTransformationConfig.paymentMethods.cashWallet;
                  } else if (service.id === '8' && finalReviewConfig?.paymentMethods) {
                    phoneNumber = (method === 'instaPay') ? finalReviewConfig.paymentMethods.instaPay : finalReviewConfig.paymentMethods.cashWallet;
                  } else if (service.id === '9' && graduationProjectConfig?.paymentMethods) {
                    phoneNumber = (method === 'instaPay') ? graduationProjectConfig.paymentMethods.instaPay : graduationProjectConfig.paymentMethods.cashWallet;
                  } else {
                    // Fallback to defaults for all other services (2, 4, 10, etc.)
                    phoneNumber = (method === 'instaPay') ? defaultInstaPay : defaultWallet;
                  }

                  // Force empty string for methods that aren't wallets/instapay if any
                  if (method !== 'Vodafone' && method !== 'Etisalat' && method !== 'Orange' && method !== 'instaPay') {
                    phoneNumber = '';
                  }

                  return (
                    <label key={method} className="payment-option" onClick={(e) => {
                      e.preventDefault();
                      if (selectedPaymentMethod !== method) {
                        setSelectedPaymentMethod(method);
                        setTransferPhoneNumber(''); // Reset on change
                      }

                      if (phoneNumber) {
                        // 1. Copy to clipboard
                        navigator.clipboard.writeText(phoneNumber);

                        // Show stylish toast instead of alert
                        setShowCopyToast(true);
                        setTimeout(() => setShowCopyToast(false), 3000);

                        // Open InstaPay in new tab
                        if (method === 'instaPay') {
                          window.open("https://ipn.eg/S/raoufpk97/instapay/3jZFKt", '_blank', 'noopener,noreferrer');
                        }
                      }
                    }}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={selectedPaymentMethod === method}
                        readOnly
                        style={{ pointerEvents: 'none' }}
                      />
                      <div className="payment-info">
                        <span className="payment-label">{method}</span>
                        {phoneNumber && (
                          <span className="payment-number">{phoneNumber}</span>
                        )}
                        {method === 'instaPay' && (
                          <span className="instapay-id" style={{ display: 'block', direction: 'ltr', fontSize: '0.9em', color: '#6366f1', marginTop: '2px' }}>
                            raoufpk97@instapay
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {selectedPaymentMethod && selectedPaymentMethod !== 'Cash' && (
                <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#1e293b', fontSize: '15px' }}>
                    الرقم الذي قمت بالتحويل منه (سيظهر للإدارة للمطابقة)
                  </label>
                  <input
                    type="text"
                    placeholder={`اكتب رقمك المحول منه عبر ${selectedPaymentMethod} هنا...`}
                    value={transferPhoneNumber}
                    onChange={(e) => setTransferPhoneNumber(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>
              )}
            </section>
          )}

          {!disabledFields.includes('receipt_upload') && (service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') && (
            <section className={`form-section section-receipt ${missingFieldNames.includes('receipt_upload') ? 'error-border' : ''}`}>
              <h2>{service.id === '10' ? 'رفع المستندات وصورة الإيصال' : 'رفع صورة الإيصال'}</h2>

              {service.id === '10' && (
                <div style={{ marginBottom: '20px', padding: '18px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '12px', border: '1px solid #f59e0b' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} />
                    لا بد من رفع المستندات التالية:
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                    {['شهادة ميلاد', 'صورة شخصية', 'شهادة التخرج', 'شهادة التحول الرقمي', 'صورة تحويل المبلغ'].map((docName, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'white', borderRadius: '8px', border: '1px solid #fbbf24', fontSize: '13px', fontWeight: '600', color: '#78350f' }}>
                        <FileText size={16} style={{ color: '#d97706', flexShrink: 0 }} />
                        {docName}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="receipt-note">
                {service.id === '10'
                  ? 'يرجى رفع صور المستندات المطلوبة وصورة إيصال التحويل (يمكنك اختيار أكثر من ملف)'
                  : 'يرجى رفع صورة إيصال الدفع قبل تقديم الطلب'}
              </p>
              <FileUpload
                onFilesSelected={setReceiptFiles}
                maxFileSize={5 * 1024 * 1024}
                acceptedFormats={['JPEG', 'JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF', 'PDF']}
              />
            </section>
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
      </form >

      {((isSubmitting || uploadProgress.uploading) || (submitMessage?.type === 'success')) && createPortal(
        <div className="loading-overlay-root">
          <div className="loading-backdrop"></div>
          <div className="floating-orbs-container">
            <div className="floating-orb orb-1"></div>
            <div className="floating-orb orb-2"></div>
            <div className="floating-orb orb-3"></div>
          </div>
          <div className="loading-modal-wrapper">
            <div className={`loading-modal ${submitMessage?.type === 'success' ? 'success-state' : ''}`}>
              {submitMessage?.type === 'success' ? (
                <div key="success-view" style={{ width: '100%' }}>
                  <div className="success-animation-container">
                    <CheckCircle className="success-icon-animated" size={80} />
                  </div>
                  <h3 className="loading-title">
                    <span>تم بنجاح!</span>
                  </h3>
                  <p className="loading-subtitle">
                    <span>تم إرسال طلبك بنجاح، جاري تحويلك...</span>
                  </p>
                </div>
              ) : (
                <div key="loading-view" style={{ width: '100%' }}>
                  <div className="loading-spinner-container">
                    <Loader2 className="spinning-loader-large" size={60} />
                  </div>
                  <h3 className="loading-title">
                    <span>
                      {uploadProgress.progress > 0
                        ? (receiptFiles.length > 0 ? 'جاري رفع الإيصال' : 'جاري معالجة الطلب')
                        : 'جاري التحضير'}
                    </span>
                  </h3>
                  <p className="loading-subtitle">
                    <span>نحن نقوم بتأمين طلبك ومعالجة البيانات، يرجى عدم إغلاق الصفحة.</span>
                  </p>
                  <div className="progress-bar-wrapper">
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${uploadProgress.progress || 5}%` }}
                      ></div>
                    </div>
                    <div className="progress-stats">
                      <span className="progress-percentage-text">
                        <span>
                          {uploadProgress.progress > 0 ? `${uploadProgress.progress}%` : 'جاري الاتصال...'}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCopyToast && createPortal(
        <div className="copy-toast-container">
          <div className="copy-toast">
            <div className="toast-icon">✓</div>
            <span>تم نسخ الرقم بنجاح</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ServiceDetailsPage;
