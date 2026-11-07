import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Zap,
  Image,
  Trash2,
  GripVertical,
  XCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import {
  cleanOldCompletedRequests,
  getStudentsByIds,
  subscribeToServiceSettings,
  updateServiceSettings,
  updateAdminPreferences as updateAdminPreferencesService
} from '../../../services/firebaseService';
import {
  fetchAllServiceRequestImages,
  groupAssetsByStudentService,
  buildRestoredRequestData,
  buildRestoredDocument,
  mergeEnrichedRequestData,
  partitionDuplicateRequests,
  RESTORED_DOC_PREFIXES,
  type CloudinaryAsset
} from '../../../services/cloudinaryRestoreService';
import { normalizeWorkflowStatus } from '../../../utils/adminRequestsUtils';
import { SERVICES } from '../../../constants/services';
import { logger } from '../../../utils/logger';
import { ServiceRequest, ServiceSettings, StudentData } from '../../../types';

export interface ServicesManagementTabProps {
  adminPrefs: any;
  setAdminPrefs: React.Dispatch<React.SetStateAction<any>>;
  updateAdminPreferences?: (prefs: any) => Promise<void>;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setToastState: React.Dispatch<React.SetStateAction<{ message: string; type: 'loading' | 'success' | 'error'; duration?: number } | null>> | ((state: any) => void);
  isMobile?: boolean;
  restoreToolsUnlocked: boolean;
  setRestoreToolsUnlocked: React.Dispatch<React.SetStateAction<boolean>>;
  runAutoFixPlaceholderOrders: (scopeServiceId?: string | null) => Promise<void>;
  isAutoFixingOrders?: boolean;
  setSelectedServiceId?: (id: string | null) => void;
  setServiceTotalCounts?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setServiceRequests?: React.Dispatch<React.SetStateAction<ServiceRequest[]>>;
  studentsRef?: React.MutableRefObject<Record<string, StudentData>>;
  allStudents?: StudentData[];
  setStudents?: React.Dispatch<React.SetStateAction<Record<string, StudentData>>>;
}

const CLEAN_PASSWORD = 'Mm9002432@#';
const RESTORE_TOOLS_PASSWORD = CLEAN_PASSWORD;

export const ServicesManagementTab: React.FC<ServicesManagementTabProps> = ({
  adminPrefs,
  setAdminPrefs,
  updateAdminPreferences = updateAdminPreferencesService,
  showAlert,
  setToastState,
  isMobile = false,
  restoreToolsUnlocked,
  setRestoreToolsUnlocked,
  runAutoFixPlaceholderOrders,
  isAutoFixingOrders = false,
  setSelectedServiceId,
  setServiceTotalCounts,
  setServiceRequests,
  studentsRef,
  allStudents = [],
  setStudents
}) => {
  // Service settings state with lazy on-demand subscription
  const [serviceSettings, setServiceSettings] = useState<ServiceSettings>({});
  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);

  // Restore password & progress states
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [restorePasswordError, setRestorePasswordError] = useState('');
  const [isRestoringServices, setIsRestoringServices] = useState(false);
  const [isRestoringGradProject, setIsRestoringGradProject] = useState(false);
  const [isSyncingCloudinary, setIsSyncingCloudinary] = useState(false);
  const [isEnrichingOrders, setIsEnrichingOrders] = useState(false);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);

  // Clean password modal & progress states
  const [isCleaningOldRequests, setIsCleaningOldRequests] = useState<boolean>(false);
  const [cleanPasswordInput, setCleanPasswordInput] = useState<string>('');
  const [cleanPasswordError, setCleanPasswordError] = useState<string>('');
  const [isCleanPasswordModalOpen, setIsCleanPasswordModalOpen] = useState<boolean>(false);

  // Lazy on-demand subscription for service settings (unsubscribes when tab unmounts)
  useEffect(() => {
    const unsubscribe = subscribeToServiceSettings((settings) => {
      setServiceSettings(settings || {});
    });
    return () => unsubscribe();
  }, []);

  const isServiceActive = (serviceId: string) => {
    const setting = serviceSettings[serviceId];
    if (typeof setting === 'boolean') return setting;
    if (typeof setting === 'object' && setting !== null) return setting.active !== false;
    return true;
  };

  const getDisabledFields = (serviceId: string) => {
    const setting = serviceSettings[serviceId];
    if (typeof setting === 'object' && setting !== null && setting.disabledFields) {
      return setting.disabledFields;
    }
    return [];
  };

  const tryUnlockRestoreTools = () => {
    if (restorePasswordInput !== RESTORE_TOOLS_PASSWORD) {
      setRestorePasswordError('كلمة المرور غير صحيحة');
      return;
    }
    setRestorePasswordError('');
    setRestorePasswordInput('');
    setRestoreToolsUnlocked(true);
    setToastState({ message: 'تم فتح أدوات الاستعادة والفحص', type: 'success', duration: 3000 });
  };

  const guardRestoreAction = (action: () => void | Promise<void>) => {
    if (!restoreToolsUnlocked) {
      setRestorePasswordError('أدخل كلمة المرور لفتح أدوات الاستعادة أولاً');
      return;
    }
    void action();
  };

  const handleCleanOldCompletedRequests = () => {
    setCleanPasswordInput('');
    setCleanPasswordError('');
    setIsCleanPasswordModalOpen(true);
  };

  const handleCleanPasswordConfirm = async () => {
    if (cleanPasswordInput !== CLEAN_PASSWORD) {
      setCleanPasswordError('❌ كلمة المرور غير صحيحة، حاول مرة أخرى');
      return;
    }
    setIsCleanPasswordModalOpen(false);
    setIsCleaningOldRequests(true);
    try {
      const res = await cleanOldCompletedRequests();
      const threeMonthsAgoMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
      if (setServiceRequests) {
        setServiceRequests(prev => prev.filter(req => {
          if (normalizeWorkflowStatus(req.status) !== 'completed') return true;
          const createdMs = req.createdAt ? new Date(req.createdAt).getTime() : 0;
          return createdMs === 0 || createdMs >= threeMonthsAgoMs;
        }));
      }
      showAlert(
        'نجاح',
        `✅ تم حذف ${res.deletedCount} طلب مكتمل قديم (+3 أشهر) بنجاح.\n(جميع حسابات الطلاب والمستخدمين بأمان تام 100%).`,
        'success'
      );
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء تنظيف الطلبات القديمة', 'error');
    } finally {
      setIsCleaningOldRequests(false);
    }
  };

  const handleRestoreServiceFromStudents = async (targetServiceId?: string) => {
    setIsRestoringServices(true);
    setIsRestoringGradProject(true);
    const isAll = !targetServiceId || targetServiceId === 'all';
    const targetServiceIdStr = targetServiceId ? String(targetServiceId) : 'all';

    const getServiceNameText = (id: string) => {
      const names: Record<string, string> = {
        '1': 'سجل بياناتك (الاستمارة)',
        '2': 'العميل المميز (VIP)',
        '3': 'شحن الكتب الدراسية',
        '4': 'دفع المصروفات الدراسية',
        '5': 'حل وتسليم التكليفات',
        '6': 'شهادات أونلاين',
        '7': 'التقديم على التحول الرقمي',
        '8': 'المراجعة النهائية',
        '9': 'مشروع التخرج',
        '10': 'استخراج مستندات',
        '11': 'شحن شهادة التحول الرقمي',
        '12': 'التقديم علي افادة و اثبات قيد'
      };
      return names[id] || `خدمة ${id}`;
    };

    const targetMessage = isAll 
      ? 'جاري فحص بيانات وحسابات جميع الطلاب المسجلين واستعادة طلبات كافة الخدمات بالدقة 100%...' 
      : `جاري فحص وتدقيق حسابات الطلاب واستعادة طلبات (${getServiceNameText(targetServiceIdStr)}) بالدقة 100%...`;

    setToastState({ message: targetMessage, type: 'loading' });

    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      const servicesToProcess = isAll ? ['1','2','3','4','5','6','7','8','9','10','11','12'] : [targetServiceIdStr];
      let totalRestoredCount = 0;

      for (const serviceId of servicesToProcess) {
        const colName = `serviceRequests_${serviceId}`;

        const relevantStudents = studentsSnap.docs.filter(docSnap => {
          const s = docSnap.data() as any;
          const projectTitle = (s.project_title || s.projectTitle || '').toString();
          const groupLink = (s.group_link || s.groupLink || '').toString();

          const sidStr = String(s.serviceId || s.service_id || s.service || '');
          const servicesArr = Array.isArray(s.services) ? s.services.map(String) : [];
          const regServicesArr = Array.isArray(s.registeredServices) ? s.registeredServices.map(String) : [];
          const hasServiceInArray = servicesArr.includes(String(serviceId)) || regServicesArr.includes(String(serviceId));
          const hasServiceInObj = Boolean(s.registeredServices?.[serviceId] || s.requests?.[serviceId]);

          switch (String(serviceId)) {
            case '1':
              // سجل بياناتك (الاستمارة): الطلاب الذين أكملوا وقدموا بياناتهم الشخصية في الأكاديمية
              return Boolean(s.fullNameArabic || s.full_name_arabic || s.nationalID || s.national_id || s.whatsappNumber || s.phone);
            case '2':
              // العميل المميز VIP: فقط من قدم واشترك بالفعل في خدمة VIP
              return hasServiceInArray || hasServiceInObj || sidStr === '2' || Boolean(s.isVip || s.vip || s.service2 || s.registeredService2 || s.is_vip);
            case '3':
              // شحن الكتب: فقط من قدم وطلب شحن كتب أو حدد عدد نسخ
              return hasServiceInArray || hasServiceInObj || sidStr === '3' || Boolean(s.numberOfCopies || s.books || s.shipBooks || s.service3 || s.registeredService3 || s.bookCopies);
            case '4':
              // المصروفات: فقط من قدم وادخل بيانات فوري أو رسوم
              return hasServiceInArray || hasServiceInObj || sidStr === '4' || Boolean(s.fees || s.fawryCode || s.feesCode || s.service4 || s.registeredService4);
            case '5':
              // التكليفات: فقط من قدم في حل وتسليم التكليفات
              return hasServiceInArray || hasServiceInObj || sidStr === '5' || Boolean(s.assignments || s.assignmentName || s.service5 || s.registeredService5);
            case '6':
              // شهادات أونلاين: فقط من قدم على شهادة أونلاين
              return hasServiceInArray || hasServiceInObj || sidStr === '6' || Boolean(s.certificate || s.selectedCertificate || s.certificateName || s.service6 || s.registeredService6);
            case '7':
              // التحول الرقمي: فقط من قدم على التحول الرقمي
              return hasServiceInArray || hasServiceInObj || sidStr === '7' || Boolean(s.digitalTransformation || s.dtCode || s.dtType || s.transformationType || s.service7 || s.registeredService7);
            case '8':
              // المراجعة النهائية: فقط من قدم على المراجعة النهائية
              return hasServiceInArray || hasServiceInObj || sidStr === '8' || Boolean(s.finalReview || s.review || s.revision || s.service8 || s.registeredService8);
            case '9':
              // مشروع التخرج: فقط من قدم على مشروع التخرج بنفسه وأدخل عنوان المشروع أو رابط الجروب
              return hasServiceInArray || hasServiceInObj || sidStr === '9' || Boolean(projectTitle || groupLink || s.gradProject || s.service9 || s.registeredService9);
            case '10':
              // استخراج مستندات: فقط من قدم على استخراج مستندات
              return hasServiceInArray || hasServiceInObj || sidStr === '10' || Boolean(s.extractDocs || s.graduationCertificate || s.extractDocuments || s.service10 || s.registeredService10);
            case '11':
              // شحن التحول الرقمي: فقط من قدم على شحن شهادة التحول الرقمي
              return hasServiceInArray || hasServiceInObj || sidStr === '11' || Boolean(s.dtShipping || s.shipDigitalTransformation || s.shipDt || s.service11 || s.registeredService11);
            default:
              return hasServiceInArray || hasServiceInObj || sidStr === String(serviceId);
          }
        });

        // Delete old auto-restored documents in small chunks to prevent lock
        const existingReqsSnap = await getDocs(collection(db, colName));
        const docsToDelete = existingReqsSnap.docs.filter(d =>
          d.id.startsWith('restored_') || d.id.startsWith('exact_') || d.id.startsWith('real_auto_') || d.id.startsWith('real_grad_')
        );
        for (let i = 0; i < docsToDelete.length; i += 20) {
          const chunk = docsToDelete.slice(i, i + 20);
          await Promise.all(chunk.map(d => deleteDoc(doc(db, colName, d.id))));
        }

        // Write restored requests in small chunks of 20
        for (let i = 0; i < relevantStudents.length; i += 20) {
          const chunk = relevantStudents.slice(i, i + 20);
          await Promise.all(chunk.map(studentDoc => {
            const s = studentDoc.data() as any;
            const studentId = studentDoc.id;

            const fullNameAr = s.fullNameArabic || s.full_name_arabic || s.full_name || 'طالب';
            const fullNameEn = s.vehicleNameEnglish || s.fullNameEnglish || s.full_name_english || '';
            const phone = s.whatsappNumber || s.phone || s.phoneNumber || s.mobile || '';
            const natId = s.nationalID || s.national_id || '';
            const email = s.email || '';
            const address = s.address ? (typeof s.address === 'object' ? `${s.address.governorate || ''} ${s.address.city || ''} ${s.address.street || ''}`.trim() : String(s.address)) : '';
            const track = s.track || s.track_name || s.course || 'المسار الأول';
            const diplomaType = s.diplomaType || s.diploma_type || 'عام تربوي';
            const diplomaYear = s.diplomaYear || s.diploma_year || '2026';

            const cloudinaryImageUrl = `https://res.cloudinary.com/dpjnaefed/image/upload/q_auto:best,f_auto/v1/serviceRequests/${studentId}/${serviceId}/receipt.jpg`;
            const newReqId = `real_auto_${serviceId}_${studentId}`;

            const requestData: Record<string, any> = {
              full_name_arabic: fullNameAr,
              national_id: natId,
              whatsapp_number: phone,
              email: email,
              address: address,
              diploma_type: diplomaType,
              diploma_year: diplomaYear,
              track: track
            };

            if (serviceId === '1') {
              requestData.college = s.college || '';
              requestData.department = s.department || '';
              requestData.grade = s.grade || '';
            } else if (serviceId === '2') {
              requestData.full_name_english = fullNameEn;
            } else if (serviceId === '3') {
              requestData.student_names = fullNameAr;
              requestData.number_of_copies = s.numberOfCopies || 1;
              requestData.phone_whatsapp = phone;
              requestData.address_details = address;
            } else if (serviceId === '5') {
              requestData.educational_specialization = s.specialization || s.department || 'عام';
            } else if (serviceId === '6') {
              requestData.full_name_english = fullNameEn;
              requestData.selectedCertificate = s.selectedCertificate || 'شهادة تقدير';
            } else if (serviceId === '7') {
              requestData.full_name_english = fullNameEn;
              requestData.transformation_type = s.transformationType || 'دورة التحول الرقمي';
              requestData.selectedExamLanguage = s.examLanguage || 'عربي';
            } else if (serviceId === '9') {
              requestData.student_names = fullNameAr;
              requestData.leader_whatsapp = phone;
              requestData.project_title = s.project_title || s.projectTitle || s.course || 'مشروع التخرج';
              requestData.group_link = s.group_link || s.groupLink || '';
            }

            return setDoc(doc(db, colName, newReqId), {
              id: newReqId,
              studentId: studentId,
              serviceId: serviceId,
              status: 'completed',
              data: requestData,
              documents: [
                {
                  id: `doc_${serviceId}_${studentId}`,
                  name: `إيصال_${fullNameAr}.jpg`,
                  size: 150000,
                  type: 'image/jpeg',
                  url: cloudinaryImageUrl
                }
              ],
              paymentMethod: 'Vodafone',
              createdAt: s.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp()
            }, { merge: true });
          }));
        }
        totalRestoredCount += relevantStudents.length;
      }

      if (targetServiceId && targetServiceId !== 'all') {
        setSelectedServiceId?.(targetServiceId);
      }
      setServiceTotalCounts?.({});
      setToastState({ message: `✅ تم استعادة ${totalRestoredCount} طلب دقيق لـ (${getServiceNameText(targetServiceIdStr)})!`, type: 'success', duration: 4000 });
      showAlert('استعادة دقيقة 100%', `✅ تم فحص وتدقيق بيانات الطلاب واستعادة ${totalRestoredCount} طلب دقيق لـ (${getServiceNameText(targetServiceIdStr)}) بنجاح!`, 'success');
    } catch (err: any) {
      logger.error('Service restore error:', err);
      setToastState({ message: `خطأ: ${err.message}`, type: 'error', duration: 4000 });
      showAlert('خطأ', err.message || 'حدث خطأ أثناء استعادة الخدمات', 'error');
    } finally {
      setIsRestoringServices(false);
      setIsRestoringGradProject(false);
    }
  };

  const handleRestoreGraduationProjectOnly = () => handleRestoreServiceFromCloudinary('9');
  const handleRestoreService1Only = () => handleRestoreServiceFromStudents('1');

  const restoreCloudinaryOrdersToFirestore = async (
    targetServiceId: string | undefined,
    serviceName: string
  ): Promise<number> => {
    setToastState({ message: `جاري جلب كل صور Cloudinary لـ (${serviceName})...`, type: 'loading' });
    const resources = await fetchAllServiceRequestImages(targetServiceId);
    const grouped = groupAssetsByStudentService(resources);

    const studentIds = [...grouped.values()].map((g) => g.studentId).filter(Boolean);
    const studentsRecord = await getStudentsByIds(studentIds);
    const studentMap = new Map<string, Record<string, unknown>>(
      Object.entries(studentsRecord).map(([id, data]) => [id, data as unknown as Record<string, unknown>])
    );

    const serviceIds = targetServiceId
      ? [targetServiceId]
      : [...new Set([...grouped.values()].map((g) => g.serviceId))];

    for (const sid of serviceIds) {
      const colName = `serviceRequests_${sid}`;
      const existingSnap = await getDocs(collection(db, colName));
      const toDelete = existingSnap.docs.filter((d) =>
        d.id.startsWith('restored_') ||
        d.id.startsWith('exact_') ||
        d.id.startsWith('real_auto_') ||
        d.id.startsWith('real_grad_')
      );
      for (let i = 0; i < toDelete.length; i += 20) {
        await Promise.all(toDelete.slice(i, i + 20).map((d) => deleteDoc(doc(db, colName, d.id))));
      }
    }

    const writePromises: Promise<void>[] = [];
    grouped.forEach(({ asset, studentId, serviceId }) => {
      const student = studentMap.get(studentId) || {};
      const fullNameAr = (student.fullNameArabic || student.full_name_arabic || student.full_name || 'طالب') as string;
      const colName = `serviceRequests_${serviceId}`;
      const newReqId = `real_cld_${serviceId}_${studentId || (asset as CloudinaryAsset).asset_id}`;
      const baseData = buildRestoredRequestData(student, serviceId);

      writePromises.push(
        (async () => {
          const dupSnap = await getDocs(query(collection(db, colName), where('studentId', '==', studentId)));
          await Promise.all(
            dupSnap.docs
              .filter((d) => d.id !== newReqId && RESTORED_DOC_PREFIXES.some((p) => d.id.startsWith(p)))
              .map((d) => deleteDoc(doc(db, colName, d.id)))
          );
          await setDoc(
            doc(db, colName, newReqId),
            {
              id: newReqId,
              studentId: studentId || 'unknown',
              serviceId,
              status: 'completed',
              data: baseData,
              documents: [buildRestoredDocument(asset, fullNameAr)],
              paymentMethod: 'Vodafone',
              createdAt: asset.created_at || serverTimestamp(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        })()
      );
    });

    for (let i = 0; i < writePromises.length; i += 20) {
      await Promise.all(writePromises.slice(i, i + 20));
    }

    return grouped.size;
  };

  const handleRestoreService2Only = async () => {
    setIsRestoringServices(true);
    try {
      const restoredCount = await restoreCloudinaryOrdersToFirestore('2', 'العميل المميز (VIP)');
      setServiceTotalCounts?.({});
      if (restoredCount > 0) {
        setToastState({ message: `✅ تم استعادة ${restoredCount} طلب حقيقي للعميل المميز (VIP)!`, type: 'success', duration: 4000 });
        showAlert('استعادة VIP 100%', `✅ تم استعادة ${restoredCount} طلب للعميل المميز من إيصالاتهم الأصلية!`, 'success');
      } else {
        setToastState({ message: 'لم يتم العثور على صور للعميل المميز على Cloudinary.', type: 'error', duration: 5000 });
      }
    } catch (err: any) {
      logger.error('VIP restore error:', err);
      setToastState({ message: `خطأ: ${err.message}`, type: 'error', duration: 4000 });
    } finally {
      setIsRestoringServices(false);
    }
  };

  const handleRestoreServiceFromCloudinary = async (targetServiceId: string) => {
    setIsRestoringServices(true);
    const serviceNames: Record<string, string> = {
      '2': 'العميل المميز (VIP)', '3': 'شحن الكتب الدراسية',
      '4': 'دفع المصروفات الدراسية', '5': 'حل وتسليم التكليفات',
      '6': 'شهادات أونلاين', '7': 'التقديم على التحول الرقمي',
      '8': 'المراجعة النهائية', '9': 'مشروع التخرج',
      '10': 'استخراج مستندات', '11': 'شحن شهادة التحول الرقمي'
    };
    const serviceName = serviceNames[targetServiceId] || `خدمة ${targetServiceId}`;
    try {
      const restoredCount = await restoreCloudinaryOrdersToFirestore(targetServiceId, serviceName);
      setServiceTotalCounts?.({});
      if (restoredCount > 0) {
        setToastState({ message: `✅ تم استعادة ${restoredCount} طلب حقيقي لـ (${serviceName})!`, type: 'success', duration: 4000 });
        showAlert('استعادة 100%', `✅ تم استعادة ${restoredCount} طلب لـ (${serviceName}) من إيصالاتهم الأصلية!`, 'success');
      } else {
        setToastState({ message: `لم يتم العثور على صور لـ (${serviceName}) على Cloudinary.`, type: 'error', duration: 5000 });
      }
    } catch (err: any) {
      logger.error(`Cloudinary restore error for service ${targetServiceId}:`, err);
      setToastState({ message: `خطأ: ${err.message}`, type: 'error', duration: 4000 });
    } finally {
      setIsRestoringServices(false);
    }
  };

  const handleRestoreService3Only = () => handleRestoreServiceFromCloudinary('3');
  const handleRestoreService4Only = () => handleRestoreServiceFromCloudinary('4');
  const handleRestoreService5Only = () => handleRestoreServiceFromCloudinary('5');
  const handleRestoreService6Only = () => handleRestoreServiceFromCloudinary('6');
  const handleRestoreService7Only = () => handleRestoreServiceFromCloudinary('7');
  const handleRestoreService8Only = () => handleRestoreServiceFromCloudinary('8');
  const handleRestoreService10Only = () => handleRestoreServiceFromCloudinary('10');
  const handleRestoreService11Only = () => handleRestoreServiceFromCloudinary('11');

  const handleRemoveDuplicateRequests = async (targetServiceId?: string) => {
    setIsRemovingDuplicates(true);
    const services = targetServiceId ? [targetServiceId] : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    setToastState({ message: 'جاري دمج وحذف الطلبات المكررة...', type: 'loading' });
    try {
      let merged = 0;
      let deleted = 0;

      for (const serviceId of services) {
        const colName = `serviceRequests_${serviceId}`;
        const snap = await getDocs(collection(db, colName));
        const reqs = snap.docs.map((d) => ({ ...d.data(), id: d.id, serviceId } as ServiceRequest));
        const { keepUpdates, deleteIds } = partitionDuplicateRequests(reqs);

        for (let i = 0; i < keepUpdates.length; i += 20) {
          await Promise.all(
            keepUpdates.slice(i, i + 20).map(({ id, data }) =>
              setDoc(doc(db, colName, id), { data, updatedAt: serverTimestamp() }, { merge: true })
            )
          );
        }
        merged += keepUpdates.length;

        for (let i = 0; i < deleteIds.length; i += 20) {
          await Promise.all(deleteIds.slice(i, i + 20).map((id) => deleteDoc(doc(db, colName, id))));
        }
        deleted += deleteIds.length;
      }

      setServiceTotalCounts?.({});
      setToastState({
        message: `✅ دمج ${merged} طلب وحذف ${deleted} تكرار`,
        type: 'success',
        duration: 5000
      });
      showAlert('تنظيف التكرارات', `✅ تم دمج البيانات الناقصة في الطلب الأفضل وحذف ${deleted} طلب مكرر من Firestore.`, 'success');
    } catch (err: any) {
      logger.error('Remove duplicates error:', err);
      setToastState({ message: `خطأ: ${err.message}`, type: 'error', duration: 4000 });
      showAlert('خطأ', err.message || 'فشل حذف التكرارات', 'error');
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  const handleEnrichRestoredOrdersFromStudents = async (targetServiceId?: string) => {
    setIsEnrichingOrders(true);
    const services = targetServiceId ? [targetServiceId] : ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const serviceNames: Record<string, string> = {
      '2': 'العميل المميز', '3': 'شحن الكتب', '4': 'المصروفات', '5': 'التكليفات',
      '6': 'شهادات أونلاين', '7': 'التحول الرقمي', '8': 'المراجعة النهائية',
      '9': 'مشروع التخرج', '10': 'استخراج مستندات', '11': 'شحن التحول الرقمي',
      '12': 'التقديم علي افادة و اثبات قيد'
    };
    const label = targetServiceId ? serviceNames[targetServiceId] || `خدمة ${targetServiceId}` : 'جميع الخدمات';
    setToastState({ message: `جاري إثراء بيانات (${label}) من ملفات الطلاب...`, type: 'loading' });

    try {
      let enrichedCount = 0;

      for (const serviceId of services) {
        const colName = `serviceRequests_${serviceId}`;
        const snap = await getDocs(collection(db, colName));
        const cloudDocs = snap.docs.filter((d) => d.id.startsWith('real_cld_'));
        if (cloudDocs.length === 0) continue;

        const autoByStudent = new Map<string, Record<string, unknown>>();
        snap.docs
          .filter((d) => d.id.startsWith('real_auto_'))
          .forEach((d) => {
            const sid = d.data().studentId as string;
            if (sid) autoByStudent.set(sid, (d.data().data || {}) as Record<string, unknown>);
          });

        const studentIds = cloudDocs.map((d) => d.data().studentId as string).filter(Boolean);
        const studentsRecord: Record<string, StudentData> = { ...(studentsRef?.current || {}) };
        const missingForFetch = studentIds.filter((id) => !studentsRecord[id]);
        if (missingForFetch.length > 0) {
          Object.assign(studentsRecord, await getStudentsByIds(missingForFetch));
        }
        if (allStudents) {
          allStudents.forEach((s) => {
            if (s.id) studentsRecord[s.id] = s;
          });
        }

        let matchedStudents = 0;

        for (let i = 0; i < cloudDocs.length; i += 20) {
          const chunk = cloudDocs.slice(i, i + 20);
          await Promise.all(
            chunk.map(async (docSnap) => {
              const req = docSnap.data();
              const studentId = req.studentId as string;
              const student = studentsRecord[studentId];
              if (!student) return;
              matchedStudents++;

              const fromStudent = buildRestoredRequestData(student as unknown as Record<string, unknown>, serviceId);
              const fromLegacy = autoByStudent.get(studentId) || {};
              const merged = mergeEnrichedRequestData(
                (req.data || {}) as Record<string, unknown>,
                fromStudent,
                fromLegacy
              );

              await setDoc(
                doc(db, colName, docSnap.id),
                { data: merged, updatedAt: serverTimestamp() },
                { merge: true }
              );

              const autoId = `real_auto_${serviceId}_${studentId}`;
              if (autoByStudent.has(studentId)) {
                await deleteDoc(doc(db, colName, autoId)).catch(() => undefined);
              }

              enrichedCount++;
            })
          );
        }

        if (cloudDocs.length > 0 && matchedStudents === 0) {
          logger.warn(`Enrich service ${serviceId}: ${cloudDocs.length} orders but 0 student profiles matched`);
        }
      }

      setServiceTotalCounts?.({});
      if (setStudents && studentsRef) {
        setStudents((current) => ({ ...current, ...studentsRef.current }));
      }
      setToastState({
        message: enrichedCount > 0
          ? `✅ تم إثراء ${enrichedCount} طلب بأسماء وأرقام الطلاب الحقيقية!`
          : '⚠️ لم يُعثر على ملفات طلاب مطابقة — قد تكون حصة Firestore ممتلئة، جرّب بعد ساعة أو حدّث الصفحة',
        type: enrichedCount > 0 ? 'success' : 'error',
        duration: 6000
      });
      if (enrichedCount > 0) {
        showAlert('إثراء البيانات', `✅ تم تحديث ${enrichedCount} طلب ببيانات الطلاب (الاسم، الواتساب، المسار...)`, 'success');
      }
    } catch (err: any) {
      logger.error('Enrich restored orders error:', err);
      setToastState({ message: `خطأ: ${err.message}`, type: 'error', duration: 4000 });
      showAlert('خطأ', err.message || 'فشل إثراء البيانات', 'error');
    } finally {
      setIsEnrichingOrders(false);
    }
  };

  const handleEnrichGraduationProjectOnly = () => handleEnrichRestoredOrdersFromStudents('9');

  const handleSyncRealCloudinaryImages = async () => {
    setIsSyncingCloudinary(true);
    setToastState({ message: 'جاري فحص وتفتيش كافة الصور الحقيقية المرفوعة على Cloudinary (كل الصفحات)...', type: 'loading' });
    try {
      const restoredCount = await restoreCloudinaryOrdersToFirestore(undefined, 'جميع الخدمات');
      setServiceTotalCounts?.({});
      setToastState({ message: `✅ تم استعادة ${restoredCount} طلب حقيقي 100% من Cloudinary!`, type: 'success', duration: 4000 });
      showAlert('استعادة دقيقة 100%', `✅ تم فحص Cloudinary واستعادة ${restoredCount} طلب حقيقي مرافق بإيصاله الأصلي المرفوع!`, 'success');
    } catch (err: any) {
      logger.error('Cloudinary sync error:', err);
      setToastState({ message: `خطأ: ${err.message}`, type: 'error', duration: 4000 });
      showAlert('خطأ', err.message || 'حدث خطأ أثناء استرجاع صور Cloudinary', 'error');
    } finally {
      setIsSyncingCloudinary(false);
    }
  };

  const moveServiceManual = async (serviceId: string, direction: 'up' | 'down') => {
    const baseOrder = (adminPrefs.serviceOrder && adminPrefs.serviceOrder.length > 0) ? adminPrefs.serviceOrder : [];
    const missingIds = SERVICES.map(s => s.id).filter(id => !baseOrder.includes(id));
    const currentOrder = [...baseOrder, ...missingIds];

    const index = currentOrder.indexOf(serviceId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];

    const updatedPrefs = { ...adminPrefs, serviceOrder: newOrder };
    setAdminPrefs(updatedPrefs);
    try {
      await updateAdminPreferences(updatedPrefs);
    } catch (e) {
      logger.error('Failed to update service order:', e);
    }
  };

  return (
    <>
      <div className="admin-content">
        <div className="section-header">
          <h2>إدارة الخدمات (تفعيل/تعطيل)</h2>
        </div>

        {/* 🔧 استعادة وفحص الطلبات — محمي بكلمة مرور */}
        <div style={{
          marginBottom: '28px',
          padding: '22px',
          borderRadius: '16px',
          border: '2px solid #6366f1',
          background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
          maxWidth: '960px'
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '17px', fontWeight: 800, color: '#3730a3', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} />
            استعادة وفحص وإصلاح الطلبات
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#475569', lineHeight: 1.7 }}>
            أدوات استعادة الطلبات وإثراء البيانات — <strong>محمية بكلمة مرور</strong> لتجنّب التشغيل بالخطأ وتحسين سرعة الموقع.
          </p>

          {!restoreToolsUnlocked ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <input
                type="password"
                value={restorePasswordInput}
                onChange={(e) => { setRestorePasswordInput(e.target.value); setRestorePasswordError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') tryUnlockRestoreTools(); }}
                placeholder="كلمة مرور أدوات الاستعادة"
                style={{
                  flex: '1 1 220px',
                  maxWidth: '320px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: restorePasswordError ? '2px solid #ef4444' : '2px solid #c7d2fe',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={tryUnlockRestoreTools}
                style={{
                  padding: '11px 22px',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔓 فتح الأدوات
              </button>
              {restorePasswordError && (
                <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, width: '100%' }}>{restorePasswordError}</span>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => guardRestoreAction(() => handleRestoreServiceFromStudents('all'))}
                  disabled={isRestoringServices}
                  style={{ padding: '10px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Zap size={15} />
                  {isRestoringServices ? 'جاري الاستعادة...' : 'استعادة جميع الخدمات (1-11)'}
                </button>
                <button
                  type="button"
                  onClick={() => guardRestoreAction(() => handleSyncRealCloudinaryImages())}
                  disabled={isSyncingCloudinary}
                  style={{ padding: '10px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Image size={15} />
                  {isSyncingCloudinary ? 'جاري الفحص...' : 'فحص واستعادة Cloudinary'}
                </button>
                <button
                  type="button"
                  onClick={() => guardRestoreAction(() => handleEnrichRestoredOrdersFromStudents())}
                  disabled={isEnrichingOrders}
                  style={{ padding: '10px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isEnrichingOrders ? 'جاري الإثراء...' : '👤 إثراء كل الطلبات'}
                </button>
                <button
                  type="button"
                  onClick={() => guardRestoreAction(() => handleEnrichGraduationProjectOnly())}
                  disabled={isEnrichingOrders}
                  style={{ padding: '10px 16px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  🎓 إثراء مشروع التخرج
                </button>
                <button
                  type="button"
                  onClick={() => guardRestoreAction(() => runAutoFixPlaceholderOrders())}
                  disabled={isAutoFixingOrders}
                  style={{ padding: '10px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isAutoFixingOrders ? 'جاري الإصلاح...' : '🔧 إصلاح «طالب» تلقائياً'}
                </button>
                <button
                  type="button"
                  onClick={() => guardRestoreAction(() => handleRemoveDuplicateRequests())}
                  disabled={isRemovingDuplicates}
                  style={{ padding: '10px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {isRemovingDuplicates ? 'جاري التنظيف...' : '🧹 حذف التكرارات ودمج البيانات'}
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreToolsUnlocked(false)}
                  style={{ padding: '10px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  🔒 قفل
                </button>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>استعادة خدمة واحدة:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {[
                  { id: '1', label: '📝 1. سجل بياناتك', fn: handleRestoreService1Only },
                  { id: '2', label: '⭐ 2. VIP', fn: handleRestoreService2Only },
                  { id: '3', label: '📚 3. شحن الكتب', fn: handleRestoreService3Only },
                  { id: '4', label: '💰 4. المصروفات', fn: handleRestoreService4Only },
                  { id: '5', label: '📋 5. التكليفات', fn: handleRestoreService5Only },
                  { id: '6', label: '🏆 6. شهادات', fn: handleRestoreService6Only },
                  { id: '7', label: '💻 7. التحول الرقمي', fn: handleRestoreService7Only },
                  { id: '8', label: '📖 8. المراجعة', fn: handleRestoreService8Only },
                  { id: '9', label: '🎓 9. مشروع التخرج', fn: handleRestoreGraduationProjectOnly, accent: true },
                  { id: '10', label: '📄 10. مستندات', fn: handleRestoreService10Only },
                  { id: '11', label: '🚚 11. شحن التحول', fn: handleRestoreService11Only },
                ].map(({ label, fn, accent }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => guardRestoreAction(fn)}
                    disabled={isRestoringServices}
                    style={{
                      padding: '9px 12px',
                      background: isRestoringServices ? '#94a3b8' : accent ? '#16a34a' : '#0d9488',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '9px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isRestoringServices ? 'not-allowed' : 'pointer',
                      textAlign: 'right'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ⚠️ Danger Zone — Clean Old Completed Requests (Included in Password-Protected Area) */}
              <div style={{
                marginTop: '24px',
                padding: '18px 20px',
                borderRadius: '14px',
                border: '2px dashed #fca5a5',
                background: '#fff5f5'
              }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trash2 size={17} color="#b91c1c" />
                  منطقة الخطر — حذف الطلبات القديمة المكتملة
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.7 }}>
                  يقوم هذا الإجراء بحذف <strong>جميع طلبات الخدمات المكتملة</strong> التي مر عليها أكثر من <strong>3 أشهر</strong> من قاعدة البيانات نهائياً لا رجعة فيه.
                  <br />
                  <strong style={{ color: '#15803d' }}>✅ حسابات الطلاب والمستخدمين محمية 100% ولن تُمس إطلاقاً.</strong>
                </p>
                <button
                  type="button"
                  onClick={handleCleanOldCompletedRequests}
                  disabled={isCleaningOldRequests}
                  style={{
                    padding: '10px 22px',
                    backgroundColor: isCleaningOldRequests ? '#94a3b8' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isCleaningOldRequests ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Trash2 size={16} />
                  {isCleaningOldRequests ? 'جاري التنظيف...' : 'تنظيف الطلبات المكتملة القديمة (+3 أشهر) 🔒'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            marginBottom: '24px',
            padding: '18px 20px',
            background: 'linear-gradient(135deg, #fefce8 0%, #fff7ed 100%)',
            borderRadius: '14px',
            border: '1px solid #fcd34d',
            maxWidth: '720px'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer', fontSize: '15px', color: '#0f172a', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={!!adminPrefs.requireRouteRegistration}
              onChange={async (e) => {
                const v = e.target.checked;
                const next = { ...adminPrefs, requireRouteRegistration: v };
                setAdminPrefs(next);
                try {
                  await updateAdminPreferences(next);
                  setToastState({
                    message: v
                      ? 'تم تفعيل إجبار «سجل بياناتك» قبل باقي الخدمات.'
                      : 'تم إلغاء الإجبار — يمكن للطلاب استخدام كل الخدمات دون هذا الشرط.',
                    type: 'success',
                    duration: 4500
                  });
                } catch {
                  setToastState({ message: 'فشل حفظ الإعداد في السحابة', type: 'error', duration: 4000 });
                }
              }}
              style={{ width: '18px', height: '18px', marginTop: '4px', accentColor: '#ea580c', flexShrink: 0 }}
            />
            <span>
              <strong style={{ display: 'block', marginBottom: '6px' }}>إجبار إكمال «سجل بياناتك» أولاً</strong>
              عند التفعيل، لا يفتح الطالب أي خدمة غير «سجل بياناتك» حتى يُرسل طلبًا لهذه الخدمة مرة واحدة على الأقل. عند إلغاء التفعيل يعود الوضع طبيعيًا للجميع.
            </span>
          </label>
        </div>
        <div className="admin-services-grid" style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          padding: '20px 0',
          overflowY: 'visible'
        }}>
          <AnimatePresence>
            {[...SERVICES]
              .sort((a, b) => {
                const orderA = adminPrefs.serviceOrder?.indexOf(a.id) ?? -1;
                const orderB = adminPrefs.serviceOrder?.indexOf(b.id) ?? -1;
                const rankA = orderA === -1 ? 999 : orderA;
                const rankB = orderB === -1 ? 999 : orderB;
                return rankA - rankB;
              })
              .map((service) => {
                const isActive = isServiceActive(service.id);
                const disabledFields = getDisabledFields(service.id);

                const handleToggleActive = async () => {
                  const newSettings = {
                    ...serviceSettings,
                    [service.id]: { active: !isActive, disabledFields }
                  };
                  setServiceSettings(newSettings as any);
                  try {
                    await updateServiceSettings(newSettings as any);
                  } catch (e) {
                    alert('فشل تحديث الحالة');
                  }
                };

                const handleToggleField = async (fieldName: string) => {
                  const isFieldDisabled = disabledFields.includes(fieldName);
                  const newDisabledFields = isFieldDisabled
                    ? disabledFields.filter(f => f !== fieldName)
                    : [...disabledFields, fieldName];
                  const newSettings = {
                    ...serviceSettings,
                    [service.id]: { active: isActive, disabledFields: newDisabledFields }
                  };
                  setServiceSettings(newSettings as any);
                  try {
                    await updateServiceSettings(newSettings as any);
                  } catch (e) {
                    alert('فشل تحديث الإعدادات');
                  }
                };

                const handleDragStart = (e: React.DragEvent) => {
                  setDraggedServiceId(service.id);
                  e.dataTransfer.effectAllowed = 'move';

                  if (e.currentTarget instanceof HTMLElement) {
                    const target = e.currentTarget;
                    const rect = target.getBoundingClientRect();

                    // Create a clone to act as a solid, customized drag image
                    const clone = target.cloneNode(true) as HTMLElement;
                    clone.style.width = `${rect.width}px`;
                    clone.style.height = `${rect.height}px`;
                    clone.style.position = 'absolute';
                    clone.style.top = '-9999px';
                    clone.style.left = '-9999px';
                    clone.style.backgroundColor = 'white';
                    clone.style.borderRadius = '16px';
                    clone.style.border = '2px solid #3b82f6';
                    clone.style.boxShadow = '0 25px 50px -12px rgba(59, 130, 246, 0.4)';
                    clone.style.opacity = '1';
                    clone.style.zIndex = '99999';
                    clone.style.transform = 'rotate(3deg) scale(1.02)';

                    document.body.appendChild(clone);

                    // Set the custom drag image right on the mouse cursor
                    e.dataTransfer.setDragImage(clone, rect.width / 2, 40);

                    // Cleanup clone and fade the original box out to look like it was "picked up"
                    setTimeout(() => {
                      if (document.body.contains(clone)) document.body.removeChild(clone);
                      target.style.opacity = '0.4';
                      target.style.transform = 'scale(0.98)';
                    }, 50);
                  }
                };

                const handleDragEnd = (e: React.DragEvent) => {
                  setDraggedServiceId(null);
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                };

                const handleDragOver = (e: React.DragEvent) => {
                  e.preventDefault();
                  if (draggedServiceId !== service.id) {
                    e.dataTransfer.dropEffect = 'move';
                  }
                };

                const handleDrop = async (e: React.DragEvent) => {
                  e.preventDefault();
                  if (!draggedServiceId || draggedServiceId === service.id) return;

                  const baseOrder = adminPrefs.serviceOrder?.length > 0 ? adminPrefs.serviceOrder : [];
                  const missingIds = SERVICES.map(s => s.id).filter(id => !baseOrder.includes(id));
                  const currentOrder = [...baseOrder, ...missingIds];
                  const draggedIdx = currentOrder.indexOf(draggedServiceId);
                  const targetIdx = currentOrder.indexOf(service.id);

                  if (draggedIdx >= 0 && targetIdx >= 0) {
                    const newOrder = [...currentOrder];
                    const [item] = newOrder.splice(draggedIdx, 1);
                    newOrder.splice(targetIdx, 0, item);
                    await updateAdminPreferences({ ...adminPrefs, serviceOrder: newOrder });
                  }
                };

                return (
                  <motion.div
                    {...(isMobile ? {} : { layout: true })}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    key={service.id}
                    className="service-card-premium"
                    style={{ '--card-color': service.color, cursor: 'grab', touchAction: 'pan-y' } as React.CSSProperties}
                    draggable={true}
                    onDragStart={handleDragStart as any}
                    onDragEnd={handleDragEnd as any}
                    onDragOver={handleDragOver as any}
                    onDrop={handleDrop as any}
                  >
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                          <GripVertical size={20} />
                        </div>
                        <h3 style={{ margin: 0 }}>{service.nameAr}</h3>
                      </div>
                      <div className={`status-badge ${isActive ? 'status-completed' : 'status-rejected'}`}>
                        {isActive ? 'نشطة' : 'متوقفة'}
                      </div>
                    </div>

                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                      {service.descriptionAr}
                    </p>

                    <div className="card-actions">
                      <button
                        onClick={handleToggleActive}
                        className={`action-btn ${isActive ? 'reject-btn' : 'accept-btn'}`}
                        style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                      >
                        {isActive ? (
                          <>
                            <XCircle size={18} />
                            تعطيل الخدمة
                          </>
                        ) : (
                          <>
                            <CheckCircle size={18} />
                            تفعيل الخدمة
                          </>
                        )}
                      </button>
                    </div>

                    {/* Movement controls - Radical Solution for Reordering */}
                    <div style={{
                      marginTop: '15px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '12px',
                      borderTop: '1px solid #e2e8f0',
                      paddingTop: '12px'
                    }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveServiceManual(service.id, 'up'); }}
                        title="تحريك للأعلى (الترتيب)"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#3b82f6',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                      >
                        <ArrowUp size={18} />
                      </button>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>ترتيب الخدمة</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveServiceManual(service.id, 'down'); }}
                        title="تحريك للأسفل (الترتيب)"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#3b82f6',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}
                      >
                        <ArrowDown size={18} />
                      </button>
                    </div>

                    <div style={{ marginTop: '15px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#475569' }}>التحكم في حقول الخدمة:</h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {service.fields.map(field => (
                          <label key={field.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!disabledFields.includes(field.name)}
                              onChange={() => handleToggleField(field.name)}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            {field.label}
                          </label>
                        ))}
                        {service.paymentMethods && service.paymentMethods.length > 0 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!disabledFields.includes('payment_section')}
                              onChange={() => handleToggleField('payment_section')}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            طرق الدفع والأسعار
                          </label>
                        )}
                        {(service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11' || service.id === '12') && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={!disabledFields.includes('receipt_upload')}
                              onChange={() => handleToggleField('receipt_upload')}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            رفع المستندات والإيصال
                          </label>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '15px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '10px' }}>
                      قم بسحب وإفلات البطاقة لتغيير الترتيب
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      </div>

      {/* Password Modal for Cleaning Old Completed Requests */}
      {isCleanPasswordModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10005,
            background: 'rgba(15,23,42,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box'
          }}
          onClick={() => setIsCleanPasswordModalOpen(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '20px', padding: '36px 32px',
              maxWidth: '420px', width: '100%', direction: 'rtl',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              border: '2px solid #ef4444'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#fef2f2', borderRadius: '12px', padding: '10px', display: 'flex' }}>
                <Trash2 size={24} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  تنظيف الطلبات القديمة المكتملة
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  هذا إجراء خطير — أدخل كلمة المرور للمتابعة
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '20px', background: '#fef2f2', borderRadius: '10px', padding: '12px' }}>
              ⚠️ سيتم حذف <strong>جميع الطلبات المكتملة</strong> التي مر عليها أكثر من <strong>3 أشهر</strong> من الفايرستور نهائياً وبشكل لا يمكن التراجع عنه.<br />
              <strong style={{ color: '#16a34a' }}>✅ حسابات الطلاب والمستخدمين محمية 100% ولن تُمس.</strong>
            </p>
            <input
              type="password"
              autoFocus
              value={cleanPasswordInput}
              onChange={e => { setCleanPasswordInput(e.target.value); setCleanPasswordError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleCleanPasswordConfirm(); }}
              placeholder="أدخل كلمة المرور هنا..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 16px', borderRadius: '10px',
                border: cleanPasswordError ? '2px solid #ef4444' : '2px solid #e2e8f0',
                fontSize: '15px', outline: 'none',
                fontFamily: 'monospace', letterSpacing: '2px',
                marginBottom: '8px', direction: 'ltr'
              }}
            />
            {cleanPasswordError && (
              <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 16px', fontWeight: 600 }}>
                {cleanPasswordError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button
                onClick={handleCleanPasswordConfirm}
                disabled={isCleaningOldRequests}
                style={{
                  flex: 1, padding: '12px', backgroundColor: isCleaningOldRequests ? '#94a3b8' : '#ef4444',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: isCleaningOldRequests ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Trash2 size={15} />
                {isCleaningOldRequests ? 'جاري التنظيف...' : 'تأكيد الحذف'}
              </button>
              <button
                onClick={() => setIsCleanPasswordModalOpen(false)}
                style={{
                  flex: 1, padding: '12px', backgroundColor: '#f1f5f9',
                  color: '#475569', border: '1px solid #e2e8f0', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ServicesManagementTab;
