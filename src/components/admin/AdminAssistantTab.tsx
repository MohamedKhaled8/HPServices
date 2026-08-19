import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  User,
  Search,
  Send,
  Trash2,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  FileCheck,
  Phone,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Layers
} from 'lucide-react';
import { SERVICES } from '../../constants/services';
import { ServiceRequest, StudentData, ServiceRequestWorkflowStatus } from '../../types';
import { searchStudent, updateServiceRequestStatus } from '../../services/firebaseService';
import '../../styles/AdminAssistantTab.css';

interface AdminAssistantTabProps {
  serviceRequests: ServiceRequest[];
  students: Record<string, StudentData>;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  dtCodes?: any[];
  epCodes?: any[];
}

export type AdminChatMessage = {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  selectedServiceId?: string;
  studentResult?: StudentData | null;
  requestsResult?: ServiceRequest[];
  multipleStudentsResult?: StudentData[];
};

const SESSION_KEY = 'admin_assistant_chat_history_v2';
const SERVICE_KEY = 'admin_assistant_selected_svc_v2';

export const AdminAssistantTab: React.FC<AdminAssistantTabProps> = ({
  serviceRequests,
  students,
  showAlert,
  dtCodes = [],
  epCodes = []
}) => {
  // Load saved chat history or default human welcome message
  const [messages, setMessages] = useState<AdminChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'welcome-1',
        sender: 'bot',
        text: 'أهلاً بك في قسم الاستعلامات الإدارية.\nيمكنك البحث باسم الطالب، رقم الواتساب، أو الرقم القومي للاستعلام الفوري عن بياناته وتقديماته.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SERVICE_KEY) || null;
    } catch (e) {
      return null;
    }
  });

  const [inputText, setInputText] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  // Save messages to sessionStorage to preserve chat history when switching tabs
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages]);

  useEffect(() => {
    try {
      if (selectedServiceId) sessionStorage.setItem(SERVICE_KEY, selectedServiceId);
      else sessionStorage.removeItem(SERVICE_KEY);
    } catch (e) {}
  }, [selectedServiceId]);

  // Strip markdown asterisks and robotic symbols for clean human text formatting
  const cleanHumanText = (text: string): string => {
    if (!text) return '';
    return text.replace(/\*\*/g, '').replace(/[⚡📌🌐🔍⚠️👋]/g, '').trim();
  };

  // Scroll to TOP of target element (never jump to bottom)
  const scrollToElementTop = (elementId: string) => {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Robust Receipt URL extractor across all schema variations
  const getReceiptUrl = (req: ServiceRequest): string | null => {
    const d = req.data || {};
    const candidates = [
      d.receiptUrl,
      d.receipt_url,
      d.receipt_upload,
      d.receipt,
      d.paymentReceipt,
      d.imageUrl,
      d.url,
      d.fawryReceipt,
      d.instaPayReceipt
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().startsWith('http')) {
        return c.trim();
      }
    }
    if (req.documents && req.documents.length > 0) {
      for (const doc of req.documents) {
        if (doc.url && typeof doc.url === 'string' && doc.url.trim().startsWith('http')) {
          return doc.url.trim();
        }
      }
    }
    return null;
  };

  // Safe Copy Helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    showAlert('تم النسخ', `تم نسخ ${label} بنجاح`, 'success');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Update Request Workflow Status directly from Card
  const handleStatusChange = async (req: ServiceRequest, newStatus: ServiceRequestWorkflowStatus) => {
    if (!req.id || !req.serviceId) return;
    setUpdatingRequestId(req.id);
    try {
      await updateServiceRequestStatus(req.id, newStatus, req.serviceId);
      showAlert('تم تحديث حالة الطلب', 'تمت المعالجة بنجاح وتحديث البيانات', 'success');

      // Update in message history state
      setMessages(prev =>
        prev.map(msg => {
          if (msg.requestsResult) {
            return {
              ...msg,
              requestsResult: msg.requestsResult.map(r => (r.id === req.id ? { ...r, status: newStatus } : r))
            };
          }
          return msg;
        })
      );
    } catch (err: any) {
      showAlert('خطأ', err.message || 'فشل تحديث حالة الطلب', 'error');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  // Find student & requests in RAM or fallback to Firestore search
  const executeAdminSearch = async (rawQuery: string, targetServiceId?: string | null) => {
    const cleanQuery = rawQuery.trim();
    if (!cleanQuery) return;

    setIsSearching(true);
    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now()}`;

    // Add user message
    const userMsg: AdminChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: cleanQuery,
      timestamp: timeStr,
      selectedServiceId: targetServiceId || undefined
    };

    setMessages(prev => [...prev, userMsg]);

    const digits = cleanQuery.replace(/\D/g, '');
    const isNationalId = digits.length === 14;
    const isPhone = digits.length >= 10 && digits.length <= 12;
    const hasLetters = /[a-zA-Z\u0600-\u06FF]/.test(cleanQuery);
    const normText = cleanQuery.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

    // 1. Search in local RAM first (Zero DB cost)
    const matchingStudents: StudentData[] = [];
    const studentIdsSet = new Set<string>();

    Object.values(students).forEach(st => {
      if (!st) return;
      const s = st as any;
      const stNatId = String(st.nationalID || s.national_id || '').replace(/\D/g, '');
      const stPhone = String(st.whatsappNumber || s.phone || s.phoneNumber || '').replace(/\D/g, '');
      const stNameAr = String(st.fullNameArabic || s.full_name_arabic || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
      const stEmail = String(st.email || '').toLowerCase();

      let isMatch = false;

      if (isNationalId && stNatId.length >= 6) {
        if (stNatId === digits || stNatId.includes(digits)) isMatch = true;
      } else if (isPhone && stPhone.length >= 8) {
        const p10 = stPhone.length >= 10 ? stPhone.slice(-10) : stPhone;
        const d10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (stPhone.includes(digits) || digits.includes(stPhone) || p10 === d10) {
          isMatch = true;
        }
      } else if (hasLetters && normText.length >= 2) {
        if (stNameAr.includes(normText) || stEmail.includes(normText)) {
          isMatch = true;
        }
      }

      if (isMatch && st.id && !studentIdsSet.has(st.id)) {
        studentIdsSet.add(st.id);
        matchingStudents.push(st);
      }
    });

    // Also search matching requests in serviceRequests RAM to discover student IDs
    serviceRequests.forEach(req => {
      const rd = req.data || {};
      const rNatId = String(rd.national_id || rd.nationalID || '').replace(/\D/g, '');
      const rPhone = String(rd.whatsapp_number || rd.phone_whatsapp || rd.phone || '').replace(/\D/g, '');
      const rNameAr = String(rd.full_name_arabic || rd.full_name || rd.student_names || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

      let isMatch = false;

      if (isNationalId && rNatId.length >= 6) {
        if (rNatId === digits || rNatId.includes(digits)) isMatch = true;
      } else if (isPhone && rPhone.length >= 8) {
        const p10 = rPhone.length >= 10 ? rPhone.slice(-10) : rPhone;
        const d10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (rPhone.includes(digits) || digits.includes(rPhone) || p10 === d10) {
          isMatch = true;
        }
      } else if (hasLetters && normText.length >= 2) {
        if (rNameAr.includes(normText)) isMatch = true;
      }

      if (isMatch && req.studentId && !studentIdsSet.has(req.studentId)) {
        const studentObj = students[req.studentId] || {
          id: req.studentId,
          fullNameArabic: String(rd.full_name_arabic || rd.full_name || 'طالب'),
          whatsappNumber: String(rd.whatsapp_number || rd.phone_whatsapp || ''),
          nationalID: String(rd.national_id || rd.nationalID || ''),
          email: String(rd.email || ''),
          diplomaType: String(rd.diploma_type || rd.diplomaType || '—'),
          diplomaYear: String(rd.diploma_year || rd.diplomaYear || '—'),
          course: String(rd.track || rd.course || '—')
        };
        studentIdsSet.add(req.studentId);
        matchingStudents.push(studentObj);
      }
    });

    // 2. If no match in RAM and query looks like a specific search term, check Firebase
    if (matchingStudents.length === 0 && (isNationalId || isPhone || cleanQuery.length >= 3)) {
      try {
        const remoteResults = await searchStudent(cleanQuery);
        if (remoteResults && remoteResults.length > 0) {
          remoteResults.forEach(st => {
            if (st.id && !studentIdsSet.has(st.id)) {
              studentIdsSet.add(st.id);
              matchingStudents.push(st);
            }
          });
        }
      } catch (err) {
        console.error('Remote search error:', err);
      }
    }

    setIsSearching(false);

    // 3. Process Bot Reply
    if (matchingStudents.length === 0) {
      setMessages(prev => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: `لم نجد طالباً يطابق البيانات المدخلة: «${cleanQuery}».\nيرجى التأكد من كتابة الاسم أو رقم الهاتف أو الرقم القومي بشكل صحيح ومحاولة البحث مجدداً.`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      scrollToElementTop(botMsgId);
      return;
    }

    // Single Student Matched
    if (matchingStudents.length === 1) {
      const matchedStudent = matchingStudents[0];
      const studentReqs = serviceRequests.filter(r => r.studentId === matchedStudent.id);

      let serviceFilteredReqs = studentReqs;
      if (targetServiceId) {
        serviceFilteredReqs = studentReqs.filter(r => String(r.serviceId) === String(targetServiceId));
      }

      const serviceObj = SERVICES.find(s => String(s.id) === String(targetServiceId));

      let replyText = `تم العثور على ملف الطالب بنجاح وتوضيح التقديمات الخاصة به:`;
      if (targetServiceId && serviceObj) {
        replyText += `\n(التصفية الحالية: ${serviceObj.nameAr})`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: botMsgId,
          sender: 'bot',
          text: replyText,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          studentResult: matchedStudent,
          requestsResult: serviceFilteredReqs.length > 0 ? serviceFilteredReqs : studentReqs
        }
      ]);
      scrollToElementTop(botMsgId);
      return;
    }

    // Multiple Students Matched
    setMessages(prev => [
      ...prev,
      {
        id: botMsgId,
        sender: 'bot',
        text: `تم العثور على أكثر من طالب يطابق البحث «${cleanQuery}».\nيرجى اختيار الطالب المطلوب لعرض بياناته وتقديماته:`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        multipleStudentsResult: matchingStudents
      }
    ]);
    scrollToElementTop(botMsgId);
  };

  const handleSelectStudentFromMultiple = (selectedStudent: StudentData) => {
    const studentReqs = serviceRequests.filter(r => r.studentId === selectedStudent.id);
    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const botMsgId = `bot-select-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      {
        id: `user-select-${Date.now()}`,
        sender: 'user',
        text: `عرض بيانات: ${selectedStudent.fullNameArabic || selectedStudent.email}`,
        timestamp: timeStr
      },
      {
        id: botMsgId,
        sender: 'bot',
        text: `تم اختيار ملف الطالب: ${selectedStudent.fullNameArabic || 'غير مسمى'}`,
        timestamp: timeStr,
        studentResult: selectedStudent,
        requestsResult: studentReqs
      }
    ]);

    scrollToElementTop(botMsgId);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    const txt = inputText;
    setInputText('');
    executeAdminSearch(txt, selectedServiceId);
  };

  const handleServiceChipClick = (serviceId: string | null) => {
    setSelectedServiceId(serviceId);
    const serviceObj = SERVICES.find(s => String(s.id) === String(serviceId));
    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const msgId = `bot-mode-${Date.now()}`;

    if (serviceId === null) {
      setMessages(prev => [
        ...prev,
        {
          id: msgId,
          sender: 'bot',
          text: 'تم تفعيل وضع الاستعلام الشامل لجميع الخدمات.\nاكتب اسم الطالب أو هاتفه أو رقمه القومي للاستعلام.',
          timestamp: timeStr
        }
      ]);
    } else {
      setMessages(prev => [
        ...prev,
        {
          id: msgId,
          sender: 'bot',
          text: `تم التصفية على خدمة: ${serviceObj?.nameAr}.\nاكتب اسم الطالب أو رقم هاتفه للاستعلام عن طلبه.`,
          timestamp: timeStr
        }
      ]);
    }
  };

  const handleClearChat = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SERVICE_KEY);
    } catch (e) {}

    setMessages([
      {
        id: 'welcome-reset',
        sender: 'bot',
        text: 'تم مسح المحادثة.\nأدخل اسم الطالب، رقم الهاتف، أو الرقم القومي لبدء البحث من جديد.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setSelectedServiceId(null);
  };

  const getWorkflowBadge = (status?: string) => {
    const st = (status || '').toLowerCase();
    if (st === 'completed') {
      return <span className="status-badge status-approved"><CheckCircle size={13} /> تمت الموافقة</span>;
    }
    if (st === 'rejected') {
      return <span className="status-badge status-rejected"><XCircle size={13} /> مرفوض</span>;
    }
    if (st === 'receipt_sent') {
      return <span className="status-badge status-receipt"><FileCheck size={13} /> إيصال مرسل</span>;
    }
    if (st === 'submitted') {
      return <span className="status-badge status-submitted"><Clock size={13} /> تم التقديم</span>;
    }
    return <span className="status-badge status-pending"><Clock size={13} /> قيد الانتظار</span>;
  };

  return (
    <div className="admin-assistant-container">
      {/* Header Bar */}
      <div className="admin-assistant-header">
        <div className="admin-assistant-header-left">
          <div className="admin-assistant-logo-icon">
            <Bot size={26} color="#ffffff" />
          </div>
          <div>
            <h3 className="admin-assistant-header-title">
              الاستعلامات الإدارية المباشرة
            </h3>
            <p className="admin-assistant-header-subtitle">
              بحث محلي سريع عن ملفات الطلاب والتحكم في حالات التقديمات
            </p>
          </div>
        </div>

        <div className="admin-assistant-header-right">
          <div className="admin-assistant-ram-badge">
            <Layers size={14} />
            <span>الذاكرة: <strong>{Object.keys(students).length}</strong> طالب | <strong>{serviceRequests.length}</strong> طلب</span>
          </div>
          <button onClick={handleClearChat} className="admin-assistant-clear-btn" title="تفريغ شاشة المحادثة">
            <Trash2 size={16} />
            <span>مسح المحادثة</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-assistant-filter-bar">
        <span className="admin-assistant-filter-label">
          <Filter size={15} color="#3b82f6" />
          <span>تصفية بالخدمة:</span>
        </span>
        <button
          onClick={() => handleServiceChipClick(null)}
          className={`admin-assistant-chip ${selectedServiceId === null ? 'active' : ''}`}
        >
          كل الخدمات
        </button>
        {SERVICES.map(svc => {
          const isSel = String(svc.id) === String(selectedServiceId);
          return (
            <button
              key={svc.id}
              onClick={() => handleServiceChipClick(svc.id)}
              className={`admin-assistant-chip ${isSel ? 'active' : ''}`}
            >
              {svc.nameAr}
            </button>
          );
        })}
      </div>

      {/* Stream Area */}
      <div className="admin-assistant-messages-body">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              id={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`admin-chat-msg-row ${msg.sender}`}
            >
              {/* Bubble Text with Human Formatting */}
              <div className="admin-chat-bubble">
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem', fontWeight: 500, color: msg.sender === 'user' ? '#ffffff' : '#334155', lineHeight: '1.6' }}>
                  {cleanHumanText(msg.text)}
                </div>

                {/* Multiple Candidates Selector */}
                {msg.multipleStudentsResult && msg.multipleStudentsResult.length > 0 && (
                  <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                    {msg.multipleStudentsResult.map(st => (
                      <div
                        key={st.id}
                        onClick={() => handleSelectStudentFromMultiple(st)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '12px',
                          padding: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <User size={18} color="#2563eb" />
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{st.fullNameArabic || st.email || 'طالب'}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              قومي: {st.nationalID || '—'} | هاتف: {st.whatsappNumber || (st as any).phone || '—'}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.8rem', background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>
                          عرض البيانات 👈
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span className="admin-chat-timestamp">{msg.timestamp}</span>

              {/* Matched Student Full Details Banner & Responsive Requests Grid */}
              {msg.studentResult && (
                <div className="admin-student-result-container">
                  {/* Top Profile Card */}
                  <div className="admin-student-profile-card">
                    <div className="admin-student-profile-header">
                      <div className="admin-student-profile-user">
                        <div className="admin-student-avatar">
                          <User size={26} />
                        </div>
                        <div>
                          <h4 className="admin-student-name">
                            {msg.studentResult.fullNameArabic || 'اسم الطالب غير محدد'}
                          </h4>
                          <span className="admin-student-email">
                            {msg.studentResult.email || 'لا يوجد بريد إلكتروني'}
                          </span>
                        </div>
                      </div>

                      {msg.studentResult.whatsappNumber && (
                        <a
                          href={`https://wa.me/2${msg.studentResult.whatsappNumber.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-student-wa-btn"
                        >
                          <Phone size={15} />
                          <span>تواصل واتساب مباشر</span>
                        </a>
                      )}
                    </div>

                    <div className="admin-student-info-grid">
                      <div className="admin-student-info-box">
                        <span className="admin-student-info-label">الرقم القومي</span>
                        <div className="admin-student-info-value">{msg.studentResult.nationalID || '—'}</div>
                      </div>
                      <div className="admin-student-info-box">
                        <span className="admin-student-info-label">رقم للتواصل والشحن</span>
                        <div className="admin-student-info-value">{msg.studentResult.whatsappNumber || (msg.studentResult as any).phone || '—'}</div>
                      </div>
                      <div className="admin-student-info-box">
                        <span className="admin-student-info-label">نوع وسنة الدبلومة</span>
                        <div className="admin-student-info-value">{msg.studentResult.diplomaType || '—'} ({msg.studentResult.diplomaYear || '—'})</div>
                      </div>
                      <div className="admin-student-info-box">
                        <span className="admin-student-info-label">الكلية / المسار</span>
                        <div className="admin-student-info-value">{msg.studentResult.course || msg.studentResult.college || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Submissions Section with MULTI-COLUMN GRID */}
                  <div className="admin-requests-section-card">
                    <h5 className="admin-requests-heading">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={18} color="#2563eb" />
                        <span>جميع تقديمات وطلبات الطالب المسجلة ({msg.requestsResult?.length || 0}):</span>
                      </span>
                    </h5>

                    {(!msg.requestsResult || msg.requestsResult.length === 0) ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem', background: '#f8fafc', borderRadius: '10px' }}>
                        لا توجد تقديمات مسجلة لهذا الطالب على النظام بعد.
                      </div>
                    ) : (
                      <div className="admin-requests-responsive-grid">
                        {msg.requestsResult.map(req => {
                          const service = SERVICES.find(s => String(s.id) === String(req.serviceId));
                          const dtCode = dtCodes.find((c: any) => c.requestId === req.id);
                          const epCode = epCodes.find((c: any) => c.requestId === req.id);
                          const fawryVal = dtCode?.fawryCode || dtCode?.serialNumber;
                          const orderVal = epCode?.orderNumber;
                          const receiptUrl = getReceiptUrl(req);
                          const isUpdating = updatingRequestId === req.id;

                          return (
                            <div key={req.id} className="admin-request-item-card">
                              <div>
                                <div className="admin-request-item-header">
                                  <div className="admin-request-service-title">
                                    <span className="admin-request-color-dot" style={{ background: service?.color || '#2563eb' }} />
                                    <span>{service?.nameAr || `خدمة ${req.serviceId}`}</span>
                                  </div>
                                  {getWorkflowBadge(req.status)}
                                </div>

                                <div className="admin-request-details-list">
                                  <div className="admin-request-detail-row">
                                    <span>التاريخ:</span>
                                    <strong>{req.createdAt ? new Date(req.createdAt).toLocaleDateString('ar-EG') : '—'}</strong>
                                  </div>

                                  {req.data?.totalPrice && (
                                    <div className="admin-request-detail-row">
                                      <span>المبلغ:</span>
                                      <strong style={{ color: '#059669' }}>{req.data.totalPrice} ج.م</strong>
                                    </div>
                                  )}

                                  {req.paymentMethod && (
                                    <div className="admin-request-detail-row">
                                      <span>طريقة الدفع:</span>
                                      <strong>{req.paymentMethod}</strong>
                                    </div>
                                  )}
                                </div>

                                {/* Payment Codes with 1-Click Copy */}
                                {fawryVal && (
                                  <div className="admin-code-box">
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>كود فوري (التحول الرقمي):</span>
                                      <span className="admin-code-value">{fawryVal}</span>
                                    </div>
                                    <button
                                      onClick={() => handleCopy(fawryVal, 'كود فوري')}
                                      className="admin-copy-icon-btn"
                                      title="نسخ الكود"
                                    >
                                      {copiedText === fawryVal ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                )}

                                {orderVal && (
                                  <div className="admin-code-box" style={{ background: '#f0fdf4', borderColor: '#22c55e' }}>
                                    <div>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>رقم الطلب (المصروفات):</span>
                                      <span className="admin-code-value" style={{ color: '#15803d' }}>{orderVal}</span>
                                    </div>
                                    <button
                                      onClick={() => handleCopy(orderVal, 'رقم الطلب')}
                                      className="admin-copy-icon-btn"
                                      style={{ color: '#16a34a' }}
                                      title="نسخ رقم الطلب"
                                    >
                                      {copiedText === orderVal ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Status Action Buttons MATCHING MAIN TABLE (Screenshot 2) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: '700', color: '#64748b' }}>حالة الطلب:</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'nowrap' }}>
                                  {(() => {
                                    const cur = (req.status || 'pending').toLowerCase();
                                    const baseBtn: React.CSSProperties = {
                                      padding: '5px',
                                      borderRadius: '6px',
                                      border: '1px solid',
                                      cursor: isUpdating ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: '30px',
                                      minHeight: '30px',
                                      transition: 'all 0.15s ease'
                                    };

                                    const steps = [
                                      {
                                        key: 'pending' as const,
                                        title: 'قيد الانتظار',
                                        Icon: Clock,
                                        active: { background: '#fffbeb', borderColor: '#fcd34d', color: '#d97706', boxShadow: '0 1px 2px rgba(245, 158, 11, 0.2)' }
                                      },
                                      {
                                        key: 'submitted' as const,
                                        title: 'تم التقديم',
                                        Icon: Send,
                                        active: { background: '#eff6ff', borderColor: '#93c5fd', color: '#2563eb', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)' }
                                      },
                                      {
                                        key: 'receipt_sent' as const,
                                        title: 'تم إرسال الإيصال',
                                        Icon: FileText,
                                        active: { background: '#ecfdf5', borderColor: '#6ee7b7', color: '#047857', boxShadow: '0 1px 2px rgba(5, 150, 105, 0.15)' }
                                      },
                                      {
                                        key: 'completed' as const,
                                        title: 'مكتمل / تمت الموافقة',
                                        Icon: CheckCircle,
                                        active: { background: '#f0fdf4', borderColor: '#86efac', color: '#166534', boxShadow: '0 1px 2px rgba(22, 101, 52, 0.12)' }
                                      },
                                      {
                                        key: 'rejected' as const,
                                        title: 'مرفوض',
                                        Icon: XCircle,
                                        active: { background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', boxShadow: '0 1px 2px rgba(220, 38, 38, 0.12)' }
                                      }
                                    ];

                                    return steps.map(({ key, title, Icon, active: activeStyle }) => {
                                      const isOn = cur === key;
                                      const style: React.CSSProperties = isOn
                                        ? { ...baseBtn, ...activeStyle }
                                        : { ...baseBtn, background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' };

                                      return (
                                        <button
                                          key={key}
                                          type="button"
                                          title={title}
                                          disabled={isUpdating}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleStatusChange(req, key);
                                          }}
                                          style={style}
                                        >
                                          <Icon size={15} strokeWidth={isOn ? 2.25 : 1.75} />
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>

                              {/* Receipt Footer - Only shown if receiptUrl exists */}
                              {receiptUrl && (
                                <div className="admin-request-item-footer">
                                  <a
                                    href={receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-receipt-link"
                                  >
                                    <ExternalLink size={14} />
                                    <span>معاينة إيصال الدفع</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isSearching && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.85rem', padding: '10px 16px', background: '#ffffff', borderRadius: '20px', width: 'fit-content', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <RefreshCw size={15} className="spin-animation" />
            <span>جاري البحث عن بيانات الطالب...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="admin-assistant-footer-input">
        <div className="admin-assistant-input-wrapper">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={
              selectedServiceId
                ? `استعلام عن طالب في "${SERVICES.find(s => String(s.id) === String(selectedServiceId))?.nameAr}" (اسم، هاتف، قومي)...`
                : 'اكتب اسم الطالب، أو رقم الواتساب/الهاتف، أو الرقم القومي للاستعلام المباشر...'
            }
            className="admin-assistant-text-field"
          />
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '16px' }} />
        </div>

        <button
          type="submit"
          disabled={!inputText.trim() || isSearching}
          className="admin-assistant-submit-btn"
        >
          <span>استعلام</span>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default AdminAssistantTab;
