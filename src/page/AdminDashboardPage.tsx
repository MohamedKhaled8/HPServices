import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import {
  subscribeToAllServiceRequests,
  updateServiceRequestStatus,
  getBookServiceConfig,
  updateBookServiceConfig,
  getFeesServiceConfig,
  updateFeesServiceConfig,
  getAssignmentsServiceConfig,
  // updateAssignmentsServiceConfig, // Commented out to fix build errors
  getCertificatesServiceConfig,
  updateCertificatesServiceConfig,
  getDigitalTransformationConfig,
  updateDigitalTransformationConfig,
  getFinalReviewConfig,
  updateFinalReviewConfig,
  getGraduationProjectConfig,
  updateGraduationProjectConfig,
  checkIsAdmin,
  getStudentData,
  subscribeToAllStudents,
  searchStudent,
  updateStudentData,
  saveDigitalTransformationCode,
  subscribeToDigitalTransformationCodes,
  saveElectronicPaymentCode,
  subscribeToElectronicPaymentCodes,
} from '../services/firebaseService';
import { ServiceRequest, StudentData, BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig, CertificateItem, DigitalTransformationConfig, DigitalTransformationType, FinalReviewConfig, GraduationProjectConfig, GraduationProjectPrice } from '../types';
import {
  LogOut,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit2,
  Save,
  X,
  FileText,
  User,
  CreditCard,
  BookOpen,
  GraduationCap,
  FileCheck,
  Award,
  ClipboardList,
  Users,
  Search,
  Pencil,
  Zap,
  Image
} from 'lucide-react';
import { SERVICES } from '../constants/services';
import '../styles/AdminDashboardPage.css';

interface AdminDashboardPageProps {
  onLogout: () => void;
  onBack: () => void;
  onAssignmentsClick?: () => void;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onLogout, onBack, onAssignmentsClick }) => {
  const { student } = useStudent();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [students, setStudents] = useState<Record<string, StudentData>>({});
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'books' | 'fees' | 'certificates' | 'digitalTransformation' | 'digitalTransformationCodes' | 'electronicPaymentCodes' | 'finalReview' | 'graduationProject' | 'users'>('requests');
  const [bookConfig, setBookConfig] = useState<BookServiceConfig | null>(null);
  const [feesConfig, setFeesConfig] = useState<FeesServiceConfig | null>(null);
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig | null>(null);
  const [certificatesConfig, setCertificatesConfig] = useState<CertificatesServiceConfig | null>(null);
  const [digitalTransformationConfig, setDigitalTransformationConfig] = useState<DigitalTransformationConfig | null>(null);
  const [isEditingBooks, setIsEditingBooks] = useState(false);
  const [isEditingFees, setIsEditingFees] = useState(false);
  // const [newAssignmentName, setNewAssignmentName] = useState<string>('');
  // const [newAssignmentPrice, setNewAssignmentPrice] = useState<string>('');
  const [newCertificateName, setNewCertificateName] = useState<string>('');
  const [newCertificatePrice, setNewCertificatePrice] = useState<string>('');
  const [newCertificateDescription, setNewCertificateDescription] = useState<string>('');
  const [editingCertificate, setEditingCertificate] = useState<CertificateItem | null>(null);

  // Digital Transformation states
  const [newTransformationTypeName, setNewTransformationTypeName] = useState<string>('');
  const [newTransformationTypePrice, setNewTransformationTypePrice] = useState<string>('');
  const [newExamLanguage, setNewExamLanguage] = useState<string>('');
  const [dtCodes, setDtCodes] = useState<any[]>([]);
  const [epCodes, setEpCodes] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editedStudentData, setEditedStudentData] = useState<StudentData | null>(null);
  const [newFeeYear, setNewFeeYear] = useState<string>('');
  const [newFeeAmount, setNewFeeAmount] = useState<string>('');

  // Final Review states
  const [finalReviewConfig, setFinalReviewConfig] = useState<FinalReviewConfig | null>(null);

  // Graduation Project states
  const [graduationProjectConfig, setGraduationProjectConfig] = useState<GraduationProjectConfig | null>(null);
  const [newGradProjectPriceAmount, setNewGradProjectPriceAmount] = useState<string>('');
  const [newGradProjectFeature, setNewGradProjectFeature] = useState<string>('');
  const [isSaving, setIsSaving] = useState<string | null>(null);


  useEffect(() => {
    if (!student?.id) return;

    const checkAdmin = async () => {
      const isAdmin = await checkIsAdmin(student.id || '');
      if (!isAdmin) {
        onBack();
        return;
      }
      setIsLoading(false);
    };

    checkAdmin();
  }, [student, onBack]);

  useEffect(() => {
    if (isLoading) return;

    // Subscribe to all service requests
    const unsubscribe = subscribeToAllServiceRequests((requests) => {
      setServiceRequests(requests);

      // Fetch student data for each request
      const fetchStudents = async () => {
        const studentsMap: Record<string, StudentData> = {};
        for (const request of requests) {
          if (!studentsMap[request.studentId]) {
            try {
              const studentData = await getStudentData(request.studentId);
              if (studentData) {
                studentsMap[request.studentId] = studentData;
              }
            } catch (error) {
              console.error(`Error fetching student ${request.studentId}:`, error);
            }
          }
        }
        setStudents(studentsMap);
      };
      fetchStudents();
    });

    // Load book config
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

    // Load fees config
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

    // Load assignments config
    const loadAssignmentsConfig = async () => {
      try {
        const config = await getAssignmentsServiceConfig();
        if (config) {
          setAssignmentsConfig(config);
        } else {
          // Default config
          setAssignmentsConfig({
            serviceName: 'حل وتسليم تكاليف الترم الاول',
            assignments: [],
            paymentMethods: {
              instaPay: '01017180923',
              cashWallet: '01050889591'
            }
          });
        }
      } catch (error) {
        console.error('Error loading assignments config:', error);
      }
    };
    loadAssignmentsConfig();

    // Load certificates config
    const loadCertificatesConfig = async () => {
      try {
        console.log('Loading certificates config in AdminDashboard...');
        const config = await getCertificatesServiceConfig();
        if (config) {
          console.log('Setting certificates config in AdminDashboard:', config.certificates?.length || 0, 'certificates');
          setCertificatesConfig(config);
        } else {
          console.log('No config found, using default certificates config');
          // Default config with 4 certificates
          const defaultConfig: CertificatesServiceConfig = {
            certificates: [
              {
                id: '1',
                name: 'شهادة تحول رقمي',
                price: 4000,
                imageUrl: '/certificat.jpeg',
                description: ''
              },
              {
                id: '2',
                name: 'شهادة الخدمة العامة',
                price: 5000,
                imageUrl: '/service.jpg',
                description: 'شهادة الخدمة العامة\n\nتمكنا من التعاقد مع احدي المؤسسات للحصول علي شهادة اداء الخدمة العامة بكل سهوله و يسر دون عناء حيث انه يتطلب بعض الاجراءات الروتينية و من ثم الحصول علي الشهادة',
                fields: [
                  { name: 'qualification_name', label: 'اسم المؤهل', type: 'text', required: true, placeholder: 'مثال: بكالوريوس تجارة / ليسانس اداب' },
                  { name: 'qualification_date', label: 'تاريخ الحصول علي البكالوريوس او الليسانس', type: 'date', required: true, placeholder: 'مثال: مارس 2022 / سبتمبر 2024' }
                ]
              },
              {
                id: '3',
                name: 'شهادة محو الأمية',
                price: 5000,
                imageUrl: '/omaya.jpeg',
                description: 'شهادة محو اميه\n\nتمكنا من اجراء اختبارات محو اميه بشكل سليم و سهل في احد المراكز التي تسهل الحصول علي الشهادة و تيسير عمليه الامتحان علي الطالب للحصول علي الشهادة'
              },
              {
                id: '4',
                name: 'شهادة خبرة (معلم)',
                price: 5000,
                imageUrl: '/exprince.jpg',
                description: 'شهادة خبرة ( معلم)\n\nتقدم احدي المدارس شهادة خبرة بناء علي التخصص و الوظيفه للحضول عليها خلال اشهر فقط من الاعتماد بالمدرسة',
                fields: [
                  { name: 'work_start_date', label: 'سنة بداية العمل بالمدرسة', type: 'date' as const, required: true, placeholder: 'mm/dd/yyyy' },
                  { name: 'work_end_date', label: 'سنة نهاية العمل بالمدرسة', type: 'date' as const, required: true, placeholder: 'mm/dd/yyyy' },
                  { name: 'subject_specialization', label: 'تخصص مادة', type: 'text' as const, required: true, placeholder: 'مثال: عربي - علوم - رياضيات . الخ...' }
                ]
              }
            ],
            paymentMethods: {
              instaPay: '01017180923',
              cashWallet: '01050889591'
            }
          };

          // Save default config to Firebase
          try {
            // Ensure all values are defined
            const cleanDefaultConfig = {
              certificates: defaultConfig.certificates.map(c => ({
                id: c.id,
                name: c.name,
                price: c.price,
                imageUrl: c.imageUrl || '',
                description: c.description || '',
                fields: c.fields || []
              })),
              paymentMethods: defaultConfig.paymentMethods
            };

            await updateCertificatesServiceConfig(cleanDefaultConfig);
            console.log('Default certificates config saved to Firebase');
          } catch (saveError) {
            console.error('Error saving default config:', saveError);
          }

          setCertificatesConfig(defaultConfig);
        }
      } catch (error) {
        console.error('Error loading certificates config:', error);
      }
    };
    loadCertificatesConfig();

    // Load digital transformation config
    const loadDigitalTransformationConfig = async () => {
      try {
        console.log('Loading digital transformation config in AdminDashboard...');
        const config = await getDigitalTransformationConfig();
        if (config) {
          console.log('Setting digital transformation config in AdminDashboard:', config.transformationTypes?.length || 0, 'types');
          setDigitalTransformationConfig(config);
        } else {
          console.log('No config found, using default digital transformation config');
          const defaultConfig: DigitalTransformationConfig = {
            transformationTypes: [],
            examLanguage: ['اللغة العربية'],
            paymentMethods: {
              instaPay: '01017180923',
              cashWallet: '01050889591'
            }
          };

          try {
            await updateDigitalTransformationConfig(defaultConfig);
            console.log('Default digital transformation config saved to Firebase');
          } catch (saveError) {
            console.error('Error saving default config:', saveError);
          }

          setDigitalTransformationConfig(defaultConfig);
        }
      } catch (error) {
        console.error('Error loading digital transformation config:', error);
      }
    };
    loadDigitalTransformationConfig();

    // Subscribe to digital transformation codes (Real-time)
    const unsubscribeDtCodes = subscribeToDigitalTransformationCodes((codes) => {
      console.log('Real-time update: Digital Transformation Codes loaded:', codes.length);
      setDtCodes(codes);
    });

    // Subscribe to electronic payment codes (Real-time)
    const unsubscribeEpCodes = subscribeToElectronicPaymentCodes((codes) => {
      console.log('Real-time update: Electronic Payment Codes loaded:', codes.length);
      setEpCodes(codes);
    });

    // Load final review config
    const loadFinalReviewConfig = async () => {
      try {
        console.log('Loading final review config in AdminDashboard...');
        const config = await getFinalReviewConfig();
        if (config) {
          console.log('Setting final review config in AdminDashboard:', config);
          setFinalReviewConfig(config);
        } else {
          console.log('No config found, using default final review config');
          const defaultConfig: FinalReviewConfig = {
            serviceName: 'المراجعة النهائية',
            paymentAmount: 500,
            paymentMethods: {
              instaPay: '01017180923',
              cashWallet: '01050889591'
            }
          };

          try {
            await updateFinalReviewConfig(defaultConfig);
            console.log('Default final review config saved to Firebase');
          } catch (saveError) {
            console.error('Error saving default config:', saveError);
          }

          setFinalReviewConfig(defaultConfig);
        }
      } catch (error) {
        console.error('Error loading final review config:', error);
      }
    };
    loadFinalReviewConfig();

    // Load graduation project config
    const loadGraduationProjectConfig = async () => {
      try {
        console.log('Loading graduation project config in AdminDashboard...');
        const config = await getGraduationProjectConfig();
        if (config) {
          console.log('Setting graduation project config in AdminDashboard:', config);
          setGraduationProjectConfig(config);
        } else {
          console.log('No config found, using default graduation project config');
          const defaultConfig: GraduationProjectConfig = {
            serviceName: 'مشروع التخرج',
            features: [
              'اعداد مشروع التخرج كامل',
              'شرح جميع جوانب المشروع و تفاصيله',
              'اعداد الاجزاء الاحصائية علي ارض الواقع',
              'تقسيم الادوار و التدريب علي الالقاء الشفوي',
              'احدث قائمة مراجع للمشروع',
              'اعداد العرض التقديمي PowerPoint'
            ],
            prices: [],
            paymentMethods: {
              instaPay: '01017180923',
              cashWallet: '01050889591'
            }
          };

          try {
            await updateGraduationProjectConfig(defaultConfig);
            console.log('Default graduation project config saved to Firebase');
            setGraduationProjectConfig(defaultConfig);
          } catch (saveError) {
            console.error('Error saving default graduation project config:', saveError);
            setGraduationProjectConfig(defaultConfig);
          }
        }
      } catch (error) {
        console.error('Error loading graduation project config:', error);
      }
    };
    loadGraduationProjectConfig();

    return () => {
      unsubscribe();
      if (unsubscribeDtCodes) unsubscribeDtCodes();
      if (unsubscribeEpCodes) unsubscribeEpCodes();
    };
  }, [isLoading]);

  // Subscribe to all students for users tab
  useEffect(() => {
    if (isLoading || activeTab !== 'users') {
      setAllStudents([]);
      return;
    }

    // Only subscribe if searchTerm is empty (showing all students)
    if (searchTerm.trim()) {
      return;
    }

    const unsubscribe = subscribeToAllStudents((students) => {
      console.log('Students loaded:', students.length);
      setAllStudents(students);
    }, (error) => {
      console.error('Error subscribing to students:', error);
      alert('حدث خطأ أثناء جلب بيانات المستخدمين');
    });

    return () => unsubscribe();
  }, [isLoading, activeTab, searchTerm]);

  const handleStatusChange = async (requestId: string, status: 'pending' | 'completed' | 'rejected', serviceId: string) => {
    try {
      await updateServiceRequestStatus(requestId, status, serviceId);

      // Trigger Automation Service (Node.js Backend) - Digital Transformation
      if (serviceId === '7' && status === 'completed') {
        const request = serviceRequests.find(r => r.id === requestId);
        if (request) {
          const studentData = students[request.studentId];
          if (studentData) {

            // Notify Admin
            alert('🔄 جاري بدء الأتمتة (Backend Service)... \nسيقوم السيرفر بإنشاء الحساب وحجز الدورة تلقائياً.');

            const payload = {
              requestId: requestId,
              studentId: request.studentId,
              email: request.data.email || studentData.email,
              fullNameArabic: request.data.full_name_arabic || studentData.fullNameArabic,
              fullNameEnglish: request.data.full_name_english || studentData.vehicleNameEnglish,
              nationalID: request.data.national_id || studentData.nationalID,
              phone: request.data.whatsapp_number || studentData.whatsappNumber,
              examLanguage: request.data.exam_language || request.data.selectedExamLanguage || 'عربي'
            };

            // Debug: Print payload
            console.log('📤 Sending Payload to Backend:', payload);
            console.log('📊 Student Data:', studentData);
            console.log('📋 Request Data:', request.data);

            // Show user what we're sending
            const debugInfo = `
البيانات المرسلة للأتمتة:
✉️ الإيميل: ${payload.email}
👤 الاسم بالعربي: ${payload.fullNameArabic}
🔤 الاسم بالإنجليزي: ${payload.fullNameEnglish || 'غير موجود'}
🆔 الرقم القومي: ${payload.nationalID || 'غير موجود'}
📱 الموبايل: ${payload.phone || 'غير موجود'}
🌐 نوع التدريب: ${payload.examLanguage}
            `.trim();

            console.log(debugInfo);
            alert('🔍 فحص البيانات:\n\n' + debugInfo + '\n\nسيتم بدء الأتمتة الآن...');

            // Call Node.js Backend
            const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
            console.log('Using API_BASE_URL:', API_BASE_URL);
            const apiUrl = `${API_BASE_URL}/api/digital-transformation/register`;

            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
              .then(async (res) => {
                const data = await res.json();
                if (data.success) {
                  // 1. Show Success Message
                  alert(`✅ تمت العملية بنجاح!\nتم استخراج الكود: ${data.data.fawryCode}\nجاري الحفظ في قاعدة البيانات...`);

                  // 2. Save to Firebase (Frontend Side)
                  try {
                    const codeData = {
                      studentId: request.studentId || '',
                      requestId: requestId || '',
                      email: payload.email || '',
                      fullNameArabic: payload.fullNameArabic || '',
                      fullNameEnglish: payload.fullNameEnglish || '',
                      phone: payload.phone || '',
                      examLanguage: payload.examLanguage || '',

                      // Extracted Data - Ensure no undefined
                      serialNumber: data.data.serialNumber || '',
                      name: data.data.name || '',
                      fawryCode: data.data.fawryCode || '',
                      mobile: data.data.mobile || '',
                      whatsapp: data.data.whatsapp || '',
                      type: data.data.type || '',
                      value: data.data.value || '',
                      status: data.data.status || '',

                      createdAt: new Date().toISOString()
                    };

                    await saveDigitalTransformationCode(codeData);
                    alert('🎉 تم الحفظ في "أكواد التحول الرقمي" بنجاح!');

                  } catch (saveError) {
                    console.error('Save Error:', saveError);
                    alert('⚠️ نجحت الأتمتة ولكن فشل الحفظ في قاعدة البيانات.');
                  }

                } else {
                  console.error('Automation Error:', data.error);
                  alert(`❌ فشلت الأتمتة:\n${data.error}`);
                }
              })
              .catch(err => {
                console.error('Connection Error:', err);
                alert('⚠️ لا يمكن الاتصال بخدمة الأتمتة (Backend Service).\nتأكد من تشغيل: node server.js');
              });
          }
        }
      }

      // Trigger Automation Service for Electronic Payment Codes (service 4 - دفع المصروفات الدراسية)
      if (serviceId === '4' && status === 'completed') {
        const request = serviceRequests.find(r => r.id === requestId);
        if (request) {
          const studentData = students[request.studentId];
          if (studentData) {
            alert('💳 جاري بدء أتمتة الدفع الإلكتروني...\nسيقوم السيرفر بإنشاء عملية الدفع وجلب رقم الطلب تلقائياً.');

            const payload = {
              requestId: requestId,
              studentId: request.studentId,
              email: request.data.email || studentData.email,
              fullNameArabic: request.data.full_name_arabic || studentData.fullNameArabic,
              nationalID: request.data.national_id || studentData.nationalID,
              phone: request.data.whatsapp_number || studentData.whatsappNumber
            };

            console.log('📤 [EP] Sending Payload to Backend:', payload);

            const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
            console.log('Using API_BASE_URL:', API_BASE_URL);
            const apiUrl = `${API_BASE_URL}/api/electronic-payment/create`;

            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
              .then(async (res) => {
                const data = await res.json();
                if (data.success) {
                  const ep = data.data || {};
                  alert(`✅ تمت عملية الدفع الإلكتروني بنجاح!\nرقم الطلب: ${ep.orderNumber || 'غير متوفر'}`);

                  try {
                    const codeData = {
                      studentId: ep.studentId || '',
                      requestId: ep.requestId || '',
                      name: ep.name || '',
                      email: ep.email || '',
                      nationalID: ep.nationalID || '',
                      mobile: ep.mobile || '',
                      entity: ep.entity || 'كلية التربية',
                      serviceType: ep.serviceType || 'دبلوم (2025 - 2026)',
                      orderNumber: ep.orderNumber || '',
                      status: ep.status || 'NEW',
                      rawText: ep.rawText || '',
                      createdAt: new Date().toISOString()
                    };

                    await saveElectronicPaymentCode(codeData);
                    alert('🎉 تم الحفظ في "أكواد الدفع الإلكتروني" بنجاح!');
                  } catch (saveError) {
                    console.error('[EP] Save Error:', saveError);
                    alert('⚠️ نجحت الأتمتة ولكن فشل الحفظ في "أكواد الدفع الإلكتروني".');
                  }
                } else {
                  console.error('[EP] Automation Error:', data.error);
                  alert(`❌ فشلت أتمتة الدفع الإلكتروني:\n${data.error}`);
                }
              })
              .catch(err => {
                console.error('[EP] Connection Error:', err);
                alert('⚠️ لا يمكن الاتصال بخدمة أتمتة الدفع الإلكتروني.\nتأكد من تشغيل: node server.js');
              });
          }
        }
      }

    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء تحديث حالة الطلب');
    }
  };

  const handleSaveBookConfig = async () => {
    if (!bookConfig || isSaving === 'books') return;
    setIsSaving('books');
    try {
      await updateBookServiceConfig(bookConfig);
      setIsEditingBooks(false);
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };

  const handleSaveFeesConfig = async () => {
    if (!feesConfig || isSaving === 'fees') return;
    setIsSaving('fees');
    try {
      await updateFeesServiceConfig(feesConfig);
      setIsEditingFees(false);
      alert('تم حفظ إعدادات المصروفات بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };

  /*
  const handleSaveAssignmentsConfig = async () => {
    if (!assignmentsConfig || isSaving === 'assignments') return;
    setIsSaving('assignments');
    try {
      await updateAssignmentsServiceConfig(assignmentsConfig);
      alert('تم حفظ إعدادات التكليفات بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };
  */

  /*
  const handleAddAssignment = () => {
    if (!newAssignmentName || !newAssignmentPrice || !assignmentsConfig) return;
    const price = parseFloat(newAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      alert('يرجى إدخال سعر صحيح');
      return;
    }
    const newAssignment: AssignmentItem = {
      id: Date.now().toString(),
      name: newAssignmentName,
      price: price
    };
    setAssignmentsConfig({
      ...assignmentsConfig,
      assignments: [...assignmentsConfig.assignments, newAssignment]
    });
    setNewAssignmentName('');
    setNewAssignmentPrice('');
  };
  */

  /*
  const handleRemoveAssignment = (id: string) => {
    if (!assignmentsConfig) return;
    setAssignmentsConfig({
      ...assignmentsConfig,
      assignments: assignmentsConfig.assignments.filter(a => a.id !== id)
    });
  };
  */

  const handleSaveCertificatesConfig = async () => {
    if (!certificatesConfig || isSaving === 'certificates') return;
    setIsSaving('certificates');
    try {
      await updateCertificatesServiceConfig(certificatesConfig);
      alert('تم حفظ إعدادات الشهادات بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddCertificate = () => {
    if (!newCertificateName || !newCertificatePrice || !certificatesConfig) return;
    const price = parseFloat(newCertificatePrice);
    if (isNaN(price) || price <= 0) {
      alert('يرجى إدخال سعر صحيح');
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

  // Digital Transformation handlers
  const handleSaveDigitalTransformationConfig = async () => {
    if (!digitalTransformationConfig || isSaving === 'digitalTransformation') return;
    setIsSaving('digitalTransformation');
    try {
      await updateDigitalTransformationConfig(digitalTransformationConfig);
      alert('تم حفظ الإعدادات بنجاح!');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddTransformationType = () => {
    if (!newTransformationTypeName || !newTransformationTypePrice || !digitalTransformationConfig) return;
    const price = parseFloat(newTransformationTypePrice);
    if (isNaN(price) || price <= 0) {
      alert('يرجى إدخال سعر صحيح');
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

  // Final Review handlers
  const handleSaveFinalReviewConfig = async () => {
    if (!finalReviewConfig || isSaving === 'finalReview') return;
    setIsSaving('finalReview');
    try {
      await updateFinalReviewConfig(finalReviewConfig);
      alert('تم حفظ إعدادات المراجعة النهائية بنجاح!');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };

  // Graduation Project handlers
  const handleSaveGraduationProjectConfig = async () => {
    if (!graduationProjectConfig || isSaving === 'graduationProject') return;
    setIsSaving('graduationProject');
    try {
      await updateGraduationProjectConfig(graduationProjectConfig);
      alert('تم حفظ إعدادات مشروع التخرج بنجاح!');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddGraduationProjectPrice = () => {
    if (!graduationProjectConfig) return;
    if (!newGradProjectPriceAmount) {
      alert('يرجى إدخال السعر');
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
      alert('يرجى إدخال الميزة');
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

  const handleEditCertificate = (certificate: CertificateItem) => {
    // Create a deep copy to avoid reference issues
    setEditingCertificate({
      ...certificate,
      fields: certificate.fields ? [...certificate.fields] : undefined
    });
  };

  const handleUpdateCertificate = async () => {
    if (!editingCertificate || !certificatesConfig || isSaving === 'updateCertificate') return;
    setIsSaving('updateCertificate');
    const updatedConfig = {
      ...certificatesConfig,
      certificates: certificatesConfig.certificates.map(c =>
        c.id === editingCertificate.id ? editingCertificate : c
      )
    };
    setCertificatesConfig(updatedConfig);
    setEditingCertificate(null);
    // Save to Firebase
    try {
      await updateCertificatesServiceConfig(updatedConfig);
      alert('تم حفظ التعديلات بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSaving(null);
    }
  };

  const handleImageUpload = (certificateId: string, file: File) => {
    if (!editingCertificate || editingCertificate.id !== certificateId) {
      console.error('Certificate ID mismatch or editingCertificate is null');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صحيح');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      if (imageUrl) {
        setEditingCertificate({ ...editingCertificate, imageUrl });
        console.log('Image uploaded successfully');
      }
    };
    reader.onerror = () => {
      alert('حدث خطأ أثناء قراءة الصورة');
    };
    reader.readAsDataURL(file);
  };

  const handleAddFeeYear = () => {
    if (!newFeeYear || !newFeeAmount || !feesConfig) return;
    const amount = parseFloat(newFeeAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
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

  const handleSearchStudent = async () => {
    if (!searchTerm.trim()) {
      // Reset to show all students - useEffect will handle this
      setAllStudents([]);
      return;
    }

    try {
      const results = await searchStudent(searchTerm);
      console.log('Search results:', results.length);
      setAllStudents(results);
    } catch (error: any) {
      console.error('Search error:', error);
      alert(error.message || 'حدث خطأ أثناء البحث');
    }
  };

  // Auto search on searchTerm change
  useEffect(() => {
    if (activeTab !== 'users' || isLoading) return;

    // If search term is empty, let the other useEffect handle showing all students
    if (!searchTerm.trim()) {
      return;
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearchStudent();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeTab, isLoading]);

  const handleEditStudent = (student: StudentData) => {
    setEditedStudentData({ ...student });
    setIsEditingStudent(true);
  };

  const handleSaveStudent = async () => {
    if (!editedStudentData || !editedStudentData.id || isSaving === 'student') return;
    setIsSaving('student');
    try {
      await updateStudentData(editedStudentData.id, editedStudentData);
      setIsEditingStudent(false);
      alert('تم تحديث بيانات المستخدم بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء تحديث البيانات');
    } finally {
      setIsSaving(null);
    }
  };

  const getStudentRequests = (studentId: string): ServiceRequest[] => {
    return serviceRequests.filter(r => r.studentId === studentId);
  };

  const getServiceName = (serviceId: string): string => {
    if (serviceId === '3' && bookConfig) {
      return bookConfig.serviceName;
    }
    if (serviceId === '5' && assignmentsConfig) {
      return assignmentsConfig.serviceName;
    }
    if (serviceId === '8' && finalReviewConfig) {
      return finalReviewConfig.serviceName;
    }
    const serviceNames: Record<string, string> = {
      '1': 'سجل بياناتك',
      '2': 'العميل المميز',
      '3': 'شحن الكتب الدراسية',
      '4': 'دفع المصروفات الدراسية',
      '5': 'حل وتسليم تكليفات',
      '6': 'شهادات اونلاين',
      '7': 'التقديم علي التحول الرقمي',
      '8': 'المراجعة النهائية',
      '9': 'مشروع التخرج',
      '10': 'استخراج مستندات'
    };
    return serviceNames[serviceId] || `خدمة ${serviceId}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge status-completed"><CheckCircle size={14} /> مكتمل</span>;
      case 'rejected':
        return <span className="status-badge status-rejected"><XCircle size={14} /> مرفوض</span>;
      default:
        return <span className="status-badge status-pending"><Clock size={14} /> قيد الانتظار</span>;
    }
  };


  if (isLoading) {
    return (
      <div className="admin-dashboard-page">
        <div className="loading-container">
          <div className="modern-loader">
            <div className="loader-spinner"></div>
            <p style={{ fontFamily: 'sans-serif', marginTop: '10px', color: '#64748b' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1>لوحة تحكم الإدارة</h1>
          <div className="admin-actions">
            <button onClick={onBack} className="back-button">
              رجوع
            </button>
            <button onClick={onLogout} className="logout-button">
              <LogOut size={18} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          جميع الطلبات
        </button>
        <button
          className={`tab-button ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          <Package size={18} />
          إدارة الكتب
        </button>
        <button
          className={`tab-button ${activeTab === 'fees' ? 'active' : ''}`}
          onClick={() => setActiveTab('fees')}
        >
          <CreditCard size={18} />
          المصروفات السن الدراسية للدبلومة
        </button>
        {onAssignmentsClick && (
          <button
            className="tab-button assignments-link-button"
            onClick={onAssignmentsClick}
            title="فتح صفحة إدارة التكليفات الدراسية الجزئية"
          >
            <FileCheck size={18} />
            إدارة التكليفات الدراسية الجزئية
          </button>
        )}
        <button
          className={`tab-button ${activeTab === 'certificates' ? 'active' : ''}`}
          onClick={() => setActiveTab('certificates')}
        >
          <Award size={18} />
          إدارة الشهادات
        </button>
        <button
          className={`tab-button ${activeTab === 'digitalTransformation' ? 'active' : ''}`}
          onClick={() => setActiveTab('digitalTransformation')}
        >
          <Zap size={18} />
          التحول الرقمي
        </button>
        <button
          className={`tab-button ${activeTab === 'digitalTransformationCodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('digitalTransformationCodes')}
        >
          <Zap size={18} />
          أكواد التحول الرقمي
        </button>
        <button
          className={`tab-button ${activeTab === 'electronicPaymentCodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('electronicPaymentCodes')}
        >
          <CreditCard size={18} />
          أكواد الدفع الإلكتروني
        </button>
        <button
          className={`tab-button ${activeTab === 'finalReview' ? 'active' : ''}`}
          onClick={() => setActiveTab('finalReview')}
        >
          <Search size={18} />
          المراجعة النهائية
        </button>
        <button
          className={`tab-button ${activeTab === 'graduationProject' ? 'active' : ''}`}
          onClick={() => setActiveTab('graduationProject')}
        >
          <GraduationCap size={18} />
          مشروع التخرج
        </button>
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} />
          المستخدمين
        </button>
      </div>

      {activeTab === 'requests' && (
        <div className="admin-content">
          <div className="requests-section">
            <h2>جميع الطلبات ({serviceRequests.length})</h2>

            {/* Services Files Grid */}
            <div className="services-files-grid">
              {SERVICES.map(service => {
                const serviceRequestsForService = serviceRequests.filter(r => r.serviceId === service.id);
                const newRequests = serviceRequestsForService.filter(r => r.status === 'pending').length;
                const totalRequests = serviceRequestsForService.length;
                const isSelected = selectedServiceId === service.id;
                let serviceName = service.nameAr;
                if (service.id === '3' && bookConfig) {
                  serviceName = bookConfig.serviceName;
                } else if (service.id === '5' && assignmentsConfig) {
                  serviceName = assignmentsConfig.serviceName;
                }

                // Get icon component based on service icon name
                const getServiceIcon = () => {
                  const iconProps = { size: 32 };
                  switch (service.icon) {
                    case 'clipboard-list': return <ClipboardList {...iconProps} />;
                    case 'user': return <User {...iconProps} />;
                    case 'package': return <Package {...iconProps} />;
                    case 'credit-card': return <CreditCard {...iconProps} />;
                    case 'book-open': return <BookOpen {...iconProps} />;
                    case 'graduation-cap': return <GraduationCap {...iconProps} />;
                    case 'file-check': return <FileCheck {...iconProps} />;
                    case 'award': return <Award {...iconProps} />;
                    default: return <FileText {...iconProps} />;
                  }
                };

                return (
                  <div
                    key={service.id}
                    className={`service-file ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedServiceId(isSelected ? null : service.id)}
                  >
                    <div className="service-file-icon" style={{ color: service.color }}>
                      {getServiceIcon()}
                    </div>
                    <div className="service-file-name">{serviceName}</div>
                    <div className="service-file-stats">
                      <div className="service-file-stat-item service-file-stat-new">
                        <span className="stat-label">جديدة</span>
                        <span className="stat-value">{newRequests}</span>
                      </div>
                      <div className="service-file-stat-item service-file-stat-total">
                        <span className="stat-label">الإجمالي</span>
                        <span className="stat-value">{totalRequests}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Display requests for selected service */}
            {selectedServiceId && (
              <div className="selected-service-requests">
                <div className="selected-service-header">
                  <h3>
                    {getServiceName(selectedServiceId)}
                  </h3>
                  <button
                    onClick={() => setSelectedServiceId(null)}
                    className="close-service-button"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="requests-grid">
                  {serviceRequests.filter(r => r.serviceId === selectedServiceId).length === 0 ? (
                    <div className="no-requests-message">
                      <p>لا توجد طلبات لهذه الخدمة</p>
                    </div>
                  ) : (
                    serviceRequests.filter(r => r.serviceId === selectedServiceId).map((request) => {
                      const studentData = students[request.studentId];
                      return (
                        <div key={request.id} className="request-card">
                          <div className="request-header">
                            <div className="request-info">
                              <h3>{getServiceName(request.serviceId)}</h3>
                              {getStatusBadge(request.status)}
                            </div>
                            <div className="request-actions">
                              <button
                                onClick={() => setSelectedRequest(request)}
                                className="view-button"
                                title="عرض التفاصيل"
                              >
                                <Eye size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="request-card-body">
                            {request.serviceId === '6' && request.data?.selectedCertificate?.imageUrl && (
                              <div className="certificate-image-preview">
                                <img
                                  src={request.data.selectedCertificate.imageUrl}
                                  alt={request.data.selectedCertificate.name}
                                  className="certificate-thumbnail-small"
                                />
                              </div>
                            )}
                            <div className="request-details">
                              <div className="detail-row">
                                <span className="detail-label">المستخدم:</span>
                                <span className="detail-value">
                                  {studentData?.fullNameArabic || 'غير متاح'}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">البريد:</span>
                                <span className="detail-value">
                                  {studentData?.email || 'غير متاح'}
                                </span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">التاريخ:</span>
                                <span className="detail-value">
                                  {request.createdAt
                                    ? new Date(request.createdAt).toLocaleString('ar-EG')
                                    : 'غير متاح'}
                                </span>
                              </div>
                              {request.paymentMethod && (
                                <div className="detail-row">
                                  <span className="detail-label">طريقة الدفع:</span>
                                  <span className="detail-value">{request.paymentMethod}</span>
                                </div>
                              )}
                              {request.serviceId === '6' && request.data?.selectedCertificate && (
                                <div className="detail-row">
                                  <span className="detail-label">الشهادة المختارة:</span>
                                  <span className="detail-value">{request.data.selectedCertificate.name}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="request-status-actions">
                            <button
                              onClick={() => handleStatusChange(request.id || '', 'completed', request.serviceId)}
                              className={`status-button ${request.status === 'completed' ? 'active' : ''}`}
                              disabled={request.status === 'completed'}
                            >
                              <CheckCircle size={16} />
                              قبول
                            </button>
                            <button
                              onClick={() => handleStatusChange(request.id || '', 'rejected', request.serviceId)}
                              className={`status-button reject ${request.status === 'rejected' ? 'active' : ''}`}
                              disabled={request.status === 'rejected'}
                            >
                              <XCircle size={16} />
                              رفض
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'books' && (
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
                  <button type="button" onClick={handleSaveBookConfig} className="save-button" disabled={isSaving === 'books'}>
                    <Save size={18} />
                    {isSaving === 'books' ? 'جاري الحفظ...' : 'حفظ'}
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
      )}

      {activeTab === 'fees' && (
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
                    <button type="button" onClick={handleSaveFeesConfig} className="save-button" disabled={isSaving === 'fees'}>
                      <Save size={18} />
                      {isSaving === 'fees' ? 'جاري الحفظ...' : 'حفظ'}
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
                            <div className="price-display">{price} جنيه</div>
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
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="admin-content">
          <div className="books-section">
            <div className="section-header">
              <h2>إعدادات خدمة الشهادات</h2>
              <button type="button" onClick={handleSaveCertificatesConfig} className="save-button" disabled={isSaving === 'certificates'}>
                <Save size={18} />
                {isSaving === 'certificates' ? 'جاري الحفظ...' : 'حفظ'}
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
                              <button type="button" onClick={handleUpdateCertificate} className="save-button" disabled={isSaving === 'updateCertificate'}>
                                <Save size={16} />
                                {isSaving === 'updateCertificate' ? 'جاري الحفظ...' : 'حفظ التعديلات'}
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
      )}

      {activeTab === 'finalReview' && (
        <div className="admin-content">
          <div className="books-section">
            <div className="section-header">
              <h2>إعدادات المراجعة النهائية</h2>
              <button type="button" onClick={handleSaveFinalReviewConfig} className="save-button" disabled={isSaving === 'finalReview'}>
                <Save size={18} />
                {isSaving === 'finalReview' ? 'جاري الحفظ...' : 'حفظ'}
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
      )}

      {activeTab === 'graduationProject' && (
        <div className="admin-content">
          <div className="books-section">
            <div className="section-header">
              <h2>إعدادات مشروع التخرج</h2>
              <button type="button" onClick={handleSaveGraduationProjectConfig} className="save-button" disabled={isSaving === 'graduationProject'}>
                <Save size={18} />
                {isSaving === 'graduationProject' ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>

            {graduationProjectConfig && (
              <div className="book-config-form">
                <div className="form-group">
                  <label>اسم السيكشن</label>
                  <input
                    type="text"
                    value={graduationProjectConfig.serviceName}
                    onChange={(e) => setGraduationProjectConfig({ ...graduationProjectConfig, serviceName: e.target.value })}
                    className="config-input"
                    placeholder="مشروع التخرج"
                  />
                </div>

                {/* Features Section */}
                <div className="form-group">
                  <label>المميزات</label>
                  <div className="features-admin-list">
                    {graduationProjectConfig.features.map((feature, index) => (
                      <div key={index} className="feature-admin-item">
                        <span>{feature}</span>
                        <button
                          onClick={() => handleRemoveGraduationProjectFeature(index)}
                          className="remove-price-button"
                          title="حذف"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="add-price-form" style={{ marginTop: '12px' }}>
                    <input
                      type="text"
                      placeholder="أضف ميزة جديدة"
                      value={newGradProjectFeature}
                      onChange={(e) => setNewGradProjectFeature(e.target.value)}
                      className="config-input"
                    />
                    <button onClick={handleAddGraduationProjectFeature} className="add-price-button">
                      إضافة ميزة
                    </button>
                  </div>
                </div>

                {/* Prices Section */}
                <div className="form-group">
                  <label>الأسعار</label>
                  <div className="prices-grid">
                    {(graduationProjectConfig.prices || []).map((priceItem) => (
                      <div key={priceItem.id} className="price-item">
                        <div className="price-item-info">
                          <span className="price-amount">{priceItem.price} جنيه</span>
                        </div>
                        <button
                          onClick={() => handleRemoveGraduationProjectPrice(priceItem.id)}
                          className="remove-price-button"
                          title="حذف"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="add-price-section" style={{ marginTop: '16px' }}>
                    <div className="add-price-form">
                      <input
                        type="number"
                        placeholder="السعر (جنيه)"
                        value={newGradProjectPriceAmount}
                        onChange={(e) => setNewGradProjectPriceAmount(e.target.value)}
                        className="config-input"
                        min="0"
                      />
                      <button onClick={handleAddGraduationProjectPrice} className="add-price-button">
                        إضافة سعر
                      </button>
                    </div>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="form-group">
                  <label>أرقام الدفع</label>
                  <div className="payment-numbers">
                    <div className="payment-item">
                      <label>instaPay</label>
                      <input
                        type="text"
                        value={graduationProjectConfig.paymentMethods.instaPay}
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
                        value={graduationProjectConfig.paymentMethods.cashWallet}
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
      )}

      {activeTab === 'users' && (
        <div className="admin-content">
          <div className="users-section">
            <h2>المستخدمين ({allStudents.length})</h2>

            {/* Search Bar */}
            <div className="search-bar">
              <div className="search-input-wrapper">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder="ابحث بأي بيانات: الاسم، الإيميل، رقم الهاتف، الرقم القومي، نوع الدبلومة، المسار، العنوان..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="users-grid">
              {allStudents.length === 0 ? (
                <div className="no-users-message">
                  <p>لا يوجد مستخدمين</p>
                </div>
              ) : (
                allStudents.map((student) => {
                  const studentRequests = getStudentRequests(student.id || '');
                  // Check if this student matches the search criteria
                  const isExactMatch = searchTerm.trim() && (
                    (student.nationalID && student.nationalID === searchTerm.trim()) ||
                    (student.whatsappNumber && student.whatsappNumber.includes(searchTerm.trim())) ||
                    (student.email && student.email.toLowerCase() === searchTerm.trim().toLowerCase())
                  );
                  return (
                    <div key={student.id} className={`user-card ${isExactMatch ? 'highlighted-match' : ''}`}>
                      <div className="user-card-header">
                        <div className="user-info">
                          <h3>{student.fullNameArabic}</h3>
                          <span className="user-email">{student.email}</span>
                        </div>
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="edit-user-button"
                          title="تعديل البيانات"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>

                      <div className="user-card-body">
                        <div className="user-details-grid">
                          <div className="detail-item">
                            <span className="detail-label">الاسم بالإنجليزية:</span>
                            <span className="detail-value">{student.vehicleNameEnglish || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">رقم الواتساب:</span>
                            <span className="detail-value">{student.whatsappNumber || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">الرقم القومي:</span>
                            <span className="detail-value">{student.nationalID || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">نوع الدبلومة:</span>
                            <span className="detail-value">{student.diplomaType || 'غير متاح'}</span>
                          </div>

                          <div className="detail-item">
                            <span className="detail-label">سنة الدبلومة:</span>
                            <span className="detail-value">{student.diplomaYear || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">المحافظة:</span>
                            <span className="detail-value">{student.address?.governorate || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">المدينة:</span>
                            <span className="detail-value">{student.address?.city || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">الشارع:</span>
                            <span className="detail-value">{student.address?.street || 'غير متاح'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">رقم المبنى:</span>
                            <span className="detail-value">{student.address?.building || 'غير متاح'}</span>
                          </div>
                        </div>

                        <div className="user-requests-section">
                          <h4>الطلبات ({studentRequests.length})</h4>
                          {studentRequests.length === 0 ? (
                            <p className="no-requests">لا توجد طلبات</p>
                          ) : (
                            <div className="user-requests-list">
                              {studentRequests.map((request) => (
                                <div key={request.id} className="user-request-item">
                                  <div className="request-item-header">
                                    <span className="request-service-name">
                                      {getServiceName(request.serviceId)}
                                    </span>
                                    {getStatusBadge(request.status)}
                                  </div>
                                  <div className="request-item-date">
                                    {request.createdAt ? new Date(request.createdAt).toLocaleDateString('ar-EG') : 'غير متاح'}
                                  </div>
                                  <button
                                    onClick={() => setSelectedRequest(request)}
                                    className="view-request-button"
                                  >
                                    <Eye size={16} />
                                    عرض التفاصيل
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditingStudent && editedStudentData && (
        <div className="request-modal-overlay" onClick={() => {
          setIsEditingStudent(false);
        }}>
          <div className="request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تعديل بيانات المستخدم</h2>
              <button
                onClick={() => {
                  setIsEditingStudent(false);
                }}
                className="close-button"
              >
                <X size={24} />
              </button>
            </div>

            <div className="modal-content">
              <div className="edit-student-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>الاسم بالعربية *</label>
                    <input
                      type="text"
                      value={editedStudentData.fullNameArabic || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        fullNameArabic: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>الاسم بالإنجليزية</label>
                    <input
                      type="text"
                      value={editedStudentData.vehicleNameEnglish || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        vehicleNameEnglish: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>رقم الواتساب *</label>
                    <input
                      type="text"
                      value={editedStudentData.whatsappNumber || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        whatsappNumber: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>الرقم القومي *</label>
                    <input
                      type="text"
                      value={editedStudentData.nationalID || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        nationalID: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>الإيميل *</label>
                    <input
                      type="email"
                      value={editedStudentData.email || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        email: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>نوع الدبلومة</label>
                    <input
                      type="text"
                      value={editedStudentData.diplomaType || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        diplomaType: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">

                  <div className="form-group">
                    <label>سنة الدبلومة</label>
                    <input
                      type="text"
                      value={editedStudentData.diplomaYear || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        diplomaYear: e.target.value
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>المحافظة</label>
                    <input
                      type="text"
                      value={editedStudentData.address?.governorate || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        address: {
                          ...editedStudentData.address,
                          governorate: e.target.value
                        }
                      })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>المدينة</label>
                    <input
                      type="text"
                      value={editedStudentData.address?.city || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        address: {
                          ...editedStudentData.address,
                          city: e.target.value
                        }
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>الشارع</label>
                    <input
                      type="text"
                      value={editedStudentData.address?.street || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        address: {
                          ...editedStudentData.address,
                          street: e.target.value
                        }
                      })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>رقم المبنى</label>
                    <input
                      type="text"
                      value={editedStudentData.address?.building || ''}
                      onChange={(e) => setEditedStudentData({
                        ...editedStudentData,
                        address: {
                          ...editedStudentData.address,
                          building: e.target.value
                        }
                      })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={handleSaveStudent} className="save-button" disabled={isSaving === 'student'}>
                    <Save size={18} />
                    {isSaving === 'student' ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingStudent(false);
                    }}
                    className="cancel-button"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="request-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="request-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تفاصيل الطلب</h2>
              <button onClick={() => setSelectedRequest(null)} className="close-button">
                <X size={24} />
              </button>
            </div>

            <div className="modal-content">
              <div className="modal-section">
                <h3>معلومات المستخدم</h3>
                {students[selectedRequest.studentId] && (
                  <div className="user-info-grid">
                    <div className="info-item">
                      <span className="info-label">الاسم:</span>
                      <span className="info-value">{students[selectedRequest.studentId].fullNameArabic}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">البريد:</span>
                      <span className="info-value">{students[selectedRequest.studentId].email}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">واتساب:</span>
                      <span className="info-value">{students[selectedRequest.studentId].whatsappNumber}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-section">
                <h3>بيانات الطلب</h3>
                <div className="request-data-grid">
                  {Object.entries(selectedRequest.data).map(([key, value]) => (
                    <div key={key} className="data-item">
                      <span className="data-label">{key}:</span>
                      <span className="data-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRequest.documents && selectedRequest.documents.length > 0 && (
                <div className="modal-section">
                  <h3>المرفقات ({selectedRequest.documents.length})</h3>
                  <div className="documents-grid">
                    {selectedRequest.documents.map((doc, index) => (
                      <div key={index} className="document-item">
                        {doc.type !== 'PDF' && doc.url ? (
                          <img
                            src={doc.url}
                            alt={doc.name}
                            className="document-image"
                            onClick={() => {
                              const img = document.createElement('img');
                              img.src = doc.url;
                              img.onload = () => {
                                const newWindow = window.open('', '_blank');
                                if (newWindow) {
                                  newWindow.document.write(`
                                    <html>
                                      <head>
                                        <title>${doc.name}</title>
                                        <style>
                                          body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
                                          img { max-width: 100%; max-height: 100vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
                                        </style>
                                      </head>
                                      <body>
                                        <img src="${doc.url}" alt="${doc.name}" />
                                      </body>
                                    </html>
                                  `);
                                }
                              };
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        ) : (
                          <div className="document-placeholder">PDF</div>
                        )}
                        <span className="document-name">{doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'digitalTransformation' && (
        <div className="admin-content digital-transformation-section">
          <div className="books-section">
            <div className="section-header">
              <h2>إعدادات خدمة التحول الرقمي</h2>
              <button type="button" onClick={handleSaveDigitalTransformationConfig} className="save-button" disabled={isSaving === 'digitalTransformation'}>
                <Save size={18} />
                {isSaving === 'digitalTransformation' ? 'جاري الحفظ...' : 'حفظ'}
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
      )}

      {activeTab === 'digitalTransformationCodes' && (
        <div className="admin-content">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2>أكواد التحول الرقمي المحفوظة ({dtCodes.length})</h2>
              <span style={{
                fontSize: '0.8rem',
                background: '#dcfce7',
                color: '#166534',
                padding: '4px 8px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
                مباشر (Real-time)
              </span>
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto' }}>
            {dtCodes.length > 0 ? (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px', textAlign: 'right' }}>الاسم</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>موبايل</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>البريد</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>النوع</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>القيمة</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>الحالة</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>تاريخ الحفظ</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>رقم فوري</th>
                  </tr>
                </thead>
                <tbody>
                  {dtCodes.map((code, index) => (
                    <tr key={code.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}>{code.name}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{code.mobile || code.phone}</td>
                      <td style={{ padding: '12px', fontSize: '0.85rem' }}>{code.email}</td>
                      <td style={{ padding: '12px' }}>{code.type}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{code.value}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          background: code.status === 'NEW' ? '#dcfce7' : '#f1f5f9',
                          color: code.status === 'NEW' ? '#166534' : '#64748b'
                        }}>
                          {code.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                        {code.updatedAt?.seconds ? new Date(code.updatedAt.seconds * 1000).toLocaleString('ar-EG') : 'الان'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', background: '#f0f9ff' }}>{code.fawryCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                لا توجد أكواد محفوظة حتى الآن
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'electronicPaymentCodes' && (
        <div className="admin-content">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2>أكواد الدفع الإلكتروني ({epCodes.length})</h2>
              <span style={{
                fontSize: '0.8rem',
                background: '#dcfce7',
                color: '#166534',
                padding: '4px 8px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
                مباشر (Real-time)
              </span>
            </div>
          </div>

          <div className="table-container" style={{ overflowX: 'auto' }}>
            {epCodes.length > 0 ? (
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px', textAlign: 'right' }}>الاسم</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>الموبايل</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>البريد الإلكتروني</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>الرقم القومي</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>الجهة</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>نوع الخدمة</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>تاريخ الإنشاء</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>رقم الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {epCodes.map((code, index) => (
                    <tr key={code.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px' }}>{code.name}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{code.mobile}</td>
                      <td style={{ padding: '12px', fontSize: '0.85rem' }}>{code.email}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem' }}>{code.nationalID}</td>
                      <td style={{ padding: '12px' }}>{code.entity}</td>
                      <td style={{ padding: '12px' }}>{code.serviceType}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                        {code.createdAt?.seconds
                          ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG')
                          : (code.createdAt || 'الان')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', background: '#f0f9ff' }}>{code.orderNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                لا توجد أكواد دفع إلكتروني محفوظة حتى الآن
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;

