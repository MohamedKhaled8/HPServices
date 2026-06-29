import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, 
  Key, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Send, 
  Users, 
  Search, 
  Settings, 
  Play, 
  LogOut,
  Smartphone,
  FileText,
  Upload,
  Plus,
  Trash2,
  Edit,
  Lock
} from 'lucide-react';
import { SERVICES } from '../../constants/services';
import { StudentData } from '../../types';
import { callWhatsAppApi } from '../../utils/whatsapp';
import { logger } from '../../utils/logger';
import * as XLSX from 'xlsx';

// ─── TemplateField: stable component (must be OUTSIDE AdminWhatsAppTab) ──────
// Defined here so React never re-mounts it on parent re-render,
// which would reset the textarea cursor on every keystroke.
const PLACEHOLDER_TAGS = [
  { tag: '{name}',       label: 'اسم الطالب' },
  { tag: '{service}',   label: 'اسم الخدمة' },
  { tag: '{status}',    label: 'الحالة' },
  { tag: '{id}',        label: 'رقم الطلب' },
  { tag: '{nationalId}',label: 'الرقم القومي' },
  { tag: '{address}',   label: 'العنوان' },
];




interface TemplateFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  serviceName?: string; // real service name for live preview
  show?: boolean;
}

const TemplateField: React.FC<TemplateFieldProps> = ({ id, label, placeholder, value, onChange, serviceName, show = true }) => {
  if (!show) return null;

  // Build sample map — use real serviceName if provided
  const sample: Record<string, string> = {
    '{name}': 'محمد أحمد',
    '{service}': serviceName || 'الخدمة',
    '{status}': 'مكتمل',
    '{id}': 'REQ-001',
    '{nationalId}': '29901234567890',
    '{address}': 'القاهرة، مصر',
  };

  // Insert a tag at the current cursor position of the textarea
  const insert = (tag: string) => {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (el) {
      const s = el.selectionStart ?? value.length;
      const e = el.selectionEnd ?? value.length;
      const next = value.slice(0, s) + tag + value.slice(e);
      onChange(next);
      setTimeout(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length); }, 0);
    } else {
      onChange(value + tag);
    }
  };

  // Build live preview
  const preview = value.trim()
    ? Object.entries(sample).reduce((msg, [k, v]) =>
        msg.replace(new RegExp(k.replace(/[{}]/g, '\\$&'), 'g'), v), value)
    : null;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>{label}</label>

      {/* Insert-tag buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {PLACEHOLDER_TAGS.map(({ tag, label: tLabel }) => (
          <button
            key={tag}
            type="button"
            onClick={() => insert(tag)}
            style={{ padding: '3px 10px', borderRadius: '20px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: 'monospace' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='#2563eb'; (e.currentTarget as HTMLButtonElement).style.color='#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='#eff6ff'; (e.currentTarget as HTMLButtonElement).style.color='#1e40af'; }}
          >
            + {tag} <span style={{ opacity: 0.65, fontFamily: 'inherit' }}>({tLabel})</span>
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', minHeight: '80px', padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '13px', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box' }}
      />

      {/* Live preview */}
      {preview && (
        <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803d', display: 'block', marginBottom: '4px' }}>👁 معاينة (ببيانات تجريبية):</span>
          <span style={{ fontSize: '12px', color: '#166534', lineHeight: '1.7', whiteSpace: 'pre-wrap', display: 'block' }}>{preview}</span>
        </div>
      )}
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

interface AdminWhatsAppTabProps {
  showAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
  adminPrefs: any;
  updateAdminPreferences: (prefs: any) => Promise<void>;
  students: Record<string, StudentData>;
}

const AdminWhatsAppTab: React.FC<AdminWhatsAppTabProps> = ({
  showAlert,
  showConfirm,
  adminPrefs,
  updateAdminPreferences,
  students
}) => {
  // Sub-tabs
  const [subTab, setSubTab] = useState<'config' | 'campaign'>('config');

  // API Config settings
  const [apiToken, setApiToken] = useState<string>(adminPrefs.wapilotToken || '');
  const [instanceId, setInstanceId] = useState<string>(adminPrefs.wapilotInstanceId || '');
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(adminPrefs.wapilotEnabled !== false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  // Flag to ensure we only sync from Firebase on the FIRST load, not on every subscription update
  // This prevents Firebase from overwriting the user's in-progress edits
  const hasLoadedPrefsRef = useRef(false);

  // Instance status & connection state
  const [instances, setInstances] = useState<any[]>([]);
  const [isFetchingInstances, setIsFetchingInstances] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [isSessionActionLoading, setIsSessionActionLoading] = useState(false);

  // Service automated reply templates
  // Format inside adminPrefs: { serviceReplies: { [serviceId]: { enabled: boolean, pendingTemplate: string, completedTemplate: string, rejectedTemplate: string, receiptSentTemplate?: string } } }
  const [serviceReplies, setServiceReplies] = useState<Record<string, any>>(adminPrefs.serviceReplies || {});
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // Direct send/Campaign state
  const [campaignTarget, setCampaignTarget] = useState<'selected' | 'all' | 'custom'>('selected');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [campaignMessage, setCampaignMessage] = useState('');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [campaignLogs, setCampaignLogs] = useState<string[]>([]);

  // Custom (external) numbers state
  const [customNumbers, setCustomNumbers] = useState<string[]>([]);
  const [manualNumberInput, setManualNumberInput] = useState('');
  const [bulkNumbersInput, setBulkNumbersInput] = useState('');
  const [customSearchTerm, setCustomSearchTerm] = useState('');
  const [isParsingFile, setIsParsingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const campaignMessageRef = useRef<HTMLTextAreaElement>(null);
  
  // Search dropdown open/close states
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Click outside search wrapper handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Config unlock state
  const [isConfigUnlocked, setIsConfigUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('admin_whatsapp_config_unlocked') === '1';
    } catch {
      return false;
    }
  });
  const [lockPasswordInput, setLockPasswordInput] = useState('');
  const [lockError, setLockError] = useState('');

  const handleUnlockConfig = () => {
    if (lockPasswordInput === '0100500500@##') {
      setIsConfigUnlocked(true);
      setLockError('');
      try {
        sessionStorage.setItem('admin_whatsapp_config_unlocked', '1');
      } catch {
        // ignore
      }
    } else {
      setLockError('كلمة المرور غير صحيحة!');
    }
  };

  // Sync state from Firebase adminPrefs — but ONLY ONCE on first load.
  // After that, the user controls the form. This prevents Firebase subscription
  // updates (from unrelated changes) from overwriting the user's in-progress edits.
  useEffect(() => {
    if (adminPrefs && !hasLoadedPrefsRef.current) {
      // Only populate when we have actual saved data (prefs have arrived from Firebase)
      if (adminPrefs.wapilotToken || adminPrefs.wapilotInstanceId) {
        setApiToken(adminPrefs.wapilotToken || '');
        setInstanceId(adminPrefs.wapilotInstanceId || '');
        setGlobalEnabled(adminPrefs.wapilotEnabled !== false);
        if (adminPrefs.serviceReplies) setServiceReplies(adminPrefs.serviceReplies);
        hasLoadedPrefsRef.current = true;
      }
    }
  }, [adminPrefs]);

  // Check connection status whenever instanceId changes to a real value
  useEffect(() => {
    if (instanceId) {
      checkInstanceStatus(instanceId);
    }
  }, [instanceId]);

  // Load instances list once on mount (not on every token keystroke)
  useEffect(() => {
    fetchInstancesList();
  }, []);

  const fetchInstancesList = async () => {
    setIsFetchingInstances(true);
    try {
      // Pass the current UI token so the backend uses it, not the saved Firebase one
      const res = await callWhatsAppApi('instances', { token: apiToken, wapilotToken: apiToken });
      if (res && res.success && res.instances) {
        setInstances(res.instances);
        // If instanceId is empty, auto-select the first one
        if (!instanceId && res.instances.length > 0) {
          setInstanceId(res.instances[0].instance_uniquename || res.instances[0].id.toString());
        }
      } else {
        logger.warn('Failed to fetch instances:', res);
      }
    } catch (err: any) {
      logger.error('Error fetching instances list:', err);
    } finally {
      setIsFetchingInstances(false);
    }
  };

  const checkInstanceStatus = async (instId: string) => {
    if (!instId) return;
    setIsCheckingStatus(true);
    setConnectionStatus(null);
    setQrCode(null);
    try {
      // Pass current UI token so backend doesn't use the stale Firebase value
      const res = await callWhatsAppApi('status', { instanceId: instId, token: apiToken, wapilotToken: apiToken, wapilotInstanceId: instId });
      if (res && res.success && res.status) {
        setConnectionStatus(res.status);
        if (res.status !== 'WORKING') {
          fetchQrCode(instId);
        }
      } else if (res && res.message) {
        setConnectionStatus('error');
        logger.warn('Instance status failed message:', res.message);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      logger.error('Error checking connection status:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const fetchQrCode = async (instId: string) => {
    setIsFetchingQr(true);
    setQrCode(null);
    try {
      const res = await callWhatsAppApi('qr-code', { instanceId: instId, token: apiToken, wapilotToken: apiToken, wapilotInstanceId: instId });
      if (res && res.success && res.qr) {
        setQrCode(res.qr);
      }
    } catch (err) {
      logger.error('Error fetching QR code:', err);
    } finally {
      setIsFetchingQr(false);
    }
  };

  const handleStartSession = async () => {
    if (!instanceId) return;
    setIsSessionActionLoading(true);
    try {
      const res = await callWhatsAppApi('start', { instanceId, token: apiToken, wapilotToken: apiToken, wapilotInstanceId: instanceId });
      showAlert('تنبيه', 'تم إرسال طلب تشغيل الجلسة، جاري التحقق من الحالة...', 'info');
      setTimeout(() => checkInstanceStatus(instanceId), 3000);
    } catch (err: any) {
      showAlert('خطأ', err.message || 'فشل تشغيل الجلسة', 'error');
    } finally {
      setIsSessionActionLoading(false);
    }
  };

  const handleLogoutSession = async () => {
    if (!instanceId) return;
    showConfirm('تسجيل الخروج', 'هل أنت متأكد من قطع اتصال الواتس اب الحالي؟ سيتطلب إرسال الرسائل مسح كود QR مجدداً.', async () => {
      setIsSessionActionLoading(true);
      try {
        const res = await callWhatsAppApi('logout', { instanceId, token: apiToken, wapilotToken: apiToken, wapilotInstanceId: instanceId });
        showAlert('نجاح', 'تم تسجيل الخروج وقطع الجلسة بنجاح.', 'success');
        checkInstanceStatus(instanceId);
      } catch (err: any) {
        showAlert('خطأ', err.message || 'فشل تسجيل الخروج', 'error');
      } finally {
        setIsSessionActionLoading(false);
      }
    }, 'قطع الاتصال');
  };

  const handleSaveApiSettings = async () => {
    if (!apiToken.trim() || !instanceId.trim()) {
      showAlert('تنبيه', 'يرجى إدخال مفتاح الـ API ومعرف الجلسة.', 'warning');
      return;
    }
    setIsSavingConfig(true);
    try {
      const updatedPrefs = {
        ...adminPrefs,
        wapilotToken: apiToken,
        wapilotInstanceId: instanceId,
        wapilotEnabled: globalEnabled,
        serviceReplies: serviceReplies
      };
      await updateAdminPreferences(updatedPrefs);
      showAlert('نجاح', 'تم حفظ إعدادات ربط واتساب بنجاح.', 'success');
      // Refresh status
      checkInstanceStatus(instanceId);
    } catch (error: any) {
      logger.error('Error saving API settings:', error);
      showAlert('خطأ', 'حدث خطأ أثناء حفظ الإعدادات في خادم البيانات.', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleServiceEnabled = (serviceId: string) => {
    const current = serviceReplies[serviceId] || {};
    const updated = {
      ...serviceReplies,
      [serviceId]: {
        ...current,
        enabled: !current.enabled
      }
    };
    setServiceReplies(updated);
  };

  const handleTemplateChange = (serviceId: string, field: string, value: string) => {
    const current = serviceReplies[serviceId] || {};
    const updated = {
      ...serviceReplies,
      [serviceId]: {
        ...current,
        [field]: value
      }
    };
    setServiceReplies(updated);
  };

  // Helper to extract phone numbers from text using Regex
  const extractPhoneNumbersFromText = (text: string): string[] => {
    const regex = /(?:\+?20|0)?1[0125]\d{8}\b|\b01[0125]\d{8}\b|\b\+?\d{10,14}\b/g;
    const matches = text.match(regex) || [];
    
    const validNumbers: string[] = [];
    matches.forEach(m => {
      const digits = m.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 15) {
        let formatted = digits;
        if (formatted.length === 11 && formatted.startsWith('01')) {
          // Standard Egyptian format
        } else if (formatted.length === 12 && formatted.startsWith('201')) {
          formatted = '0' + formatted.slice(2);
        } else if (formatted.length === 10 && formatted.startsWith('1')) {
          formatted = '0' + formatted;
        }
        validNumbers.push(formatted);
      }
    });
    return Array.from(new Set(validNumbers));
  };

  // Helper to parse Excel file
  const parseExcelFile = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const numbers: string[] = [];
          
          workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const sheetJson: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            sheetJson.forEach(row => {
              if (Array.isArray(row)) {
                row.forEach(cell => {
                  if (cell !== undefined && cell !== null) {
                    const str = String(cell).trim();
                    const extracted = extractPhoneNumbersFromText(str);
                    numbers.push(...extracted);
                  }
                });
              }
            });
          });
          resolve(Array.from(new Set(numbers)));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  // Helper to parse PDF file by dynamically loading pdf.js
  const parsePdfFile = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const runExtraction = async (pdfjsLib: any) => {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const numbers: string[] = [];
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            const extracted = extractPhoneNumbersFromText(pageText);
            numbers.push(...extracted);
          }
          resolve(Array.from(new Set(numbers)));
        } catch (err) {
          reject(err);
        }
      };

      if ((window as any).pdfjsLib) {
        runExtraction((window as any).pdfjsLib);
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
          runExtraction(pdfjsLib);
        };
        script.onerror = () => reject(new Error('فشل تحميل مكتبة قراءة ملفات PDF من خادم CDN.'));
        document.body.appendChild(script);
      }
    });
  };

  // File Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsingFile(true);
    try {
      let extracted: string[] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension === 'xlsx' || extension === 'xls') {
        extracted = await parseExcelFile(file);
      } else if (extension === 'pdf') {
        extracted = await parsePdfFile(file);
      } else {
        showAlert('خطأ', 'الملف غير مدعوم. يرجى رفع ملف Excel أو PDF فقط.', 'error');
        setIsParsingFile(false);
        return;
      }

      if (extracted.length === 0) {
        showAlert('تنبيه', 'لم يتم العثور على أي أرقام هواتف في هذا الملف.', 'warning');
      } else {
        const merged = Array.from(new Set([...customNumbers, ...extracted]));
        setCustomNumbers(merged);
        showAlert('نجاح', `تم استخراج ${extracted.length} رقم بنجاح من الملف.`, 'success');
      }
    } catch (err: any) {
      logger.error('File parsing error:', err);
      showAlert('خطأ', `فشل استخراج الأرقام: ${err.message || 'عطل غير معروف'}`, 'error');
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add Manual Phone Number
  const handleAddManualNumber = () => {
    const num = manualNumberInput.replace(/\D/g, '');
    if (!num) {
      showAlert('تنبيه', 'يرجى إدخال رقم صحيح.', 'warning');
      return;
    }
    
    if (num.length < 10 || num.length > 15) {
      showAlert('تنبيه', 'يجب أن يكون رقم الهاتف بين 10 و 15 رقم.', 'warning');
      return;
    }

    let formatted = num;
    if (formatted.length === 11 && formatted.startsWith('01')) {
      // standard Egyptian format
    } else if (formatted.length === 10 && formatted.startsWith('1')) {
      formatted = '0' + formatted;
    }

    if (customNumbers.includes(formatted)) {
      showAlert('تنبيه', 'هذا الرقم مضاف بالفعل في القائمة.', 'warning');
      return;
    }

    setCustomNumbers([...customNumbers, formatted]);
    setManualNumberInput('');
  };

  // Add Bulk Numbers from Textarea
  const handleAddBulkNumbers = () => {
    if (!bulkNumbersInput.trim()) {
      showAlert('تنبيه', 'يرجى كتابة أو لصق أرقام أولاً.', 'warning');
      return;
    }
    const extracted = extractPhoneNumbersFromText(bulkNumbersInput);
    if (extracted.length === 0) {
      showAlert('تنبيه', 'لم يتم العثور على أي أرقام هواتف صالحة في النص المدخل.', 'warning');
      return;
    }

    const merged = Array.from(new Set([...customNumbers, ...extracted]));
    const newlyAddedCount = merged.length - customNumbers.length;
    
    setCustomNumbers(merged);
    setBulkNumbersInput('');
    showAlert('نجاح', `تمت إضافة ${newlyAddedCount} رقم جديد إلى القائمة (مع استبعاد المكرر).`, 'success');
  };

  // Remove single number from custom list
  const handleRemoveCustomNumber = (num: string) => {
    setCustomNumbers(customNumbers.filter(n => n !== num));
  };

  // Insert placeholder variables at textarea cursor position
  const insertPlaceholder = (ph: string) => {
    const textarea = campaignMessageRef.current;
    if (!textarea) {
      // Fallback: append if not focused/rendered yet
      setCampaignMessage(prev => prev + ph);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    setCampaignMessage(before + ph + after);

    // Refocus and place cursor after the inserted placeholder
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + ph.length;
    }, 50);
  };

  // Clear all custom numbers
  const handleClearAllCustomNumbers = () => {
    showConfirm('تأكيد الحذف', 'هل أنت متأكد من مسح جميع الأرقام المضافة؟', () => {
      setCustomNumbers([]);
    }, 'مسح الكل');
  };

  // Convert student record to list for search
  const studentList = useMemo(() => Object.values(students || {}), [students]);

  // Filter custom numbers based on search term
  const filteredCustomNumbers = useMemo(() => {
    const term = customSearchTerm.trim().toLowerCase();
    if (!term) return customNumbers;
    return customNumbers.filter(num => num.includes(term));
  }, [customNumbers, customSearchTerm]);

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const query = searchTerm.toLowerCase();
    return studentList.filter(s => 
      s.fullNameArabic?.toLowerCase().includes(query) ||
      s.whatsappNumber?.includes(query) ||
      s.nationalID?.includes(query)
    );
  }, [studentList, searchTerm]);

  const handleSelectAllFiltered = () => {
    const updated = new Set(selectedStudentIds);
    filteredStudents.forEach(s => {
      if (s.id) updated.add(s.id);
    });
    setSelectedStudentIds(updated);
  };

  const handleToggleSelectStudent = (id: string) => {
    const updated = new Set(selectedStudentIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedStudentIds(updated);
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };
  // Execute campaign/Bulk send
  const handleSendCampaign = async () => {
    if (!apiToken || !instanceId) {
      showAlert('تنبيه', 'يرجى إدخال إعدادات ربط واتساب وتفعيلها أولاً.', 'warning');
      return;
    }
    if (!campaignMessage.trim()) {
      showAlert('تنبيه', 'يرجى كتابة محتوى الرسالة المراد إرسالها.', 'warning');
      return;
    }

    // Determine target list
    let targets: { fullNameArabic: string; whatsappNumber: string }[] = [];
    if (campaignTarget === 'all') {
      targets = studentList
        .filter(s => !!s.whatsappNumber)
        .map(s => ({ fullNameArabic: s.fullNameArabic || 'طالب مسجل', whatsappNumber: s.whatsappNumber }));
    } else if (campaignTarget === 'selected') {
      targets = studentList
        .filter(s => s.id && selectedStudentIds.has(s.id))
        .map(s => ({ fullNameArabic: s.fullNameArabic || 'طالب مسجل', whatsappNumber: s.whatsappNumber }));
    } else if (campaignTarget === 'custom') {
      targets = customNumbers.map(num => ({ fullNameArabic: `رقم خارجي (${num})`, whatsappNumber: num }));
    }

    if (targets.length === 0) {
      showAlert('تنبيه', 'يرجى اختيار مستلم واحد على الأقل للرسالة.', 'warning');
      return;
    }

    showConfirm('تأكيد الحملة', `هل أنت متأكد من إرسال هذه الرسالة إلى ${targets.length} جهة اتصال؟`, async () => {
      setIsSendingCampaign(true);
      setCampaignProgress({ current: 0, total: targets.length, success: 0, failed: 0 });
      setCampaignLogs([`🚀 بدء حملة الإرسال لـ ${targets.length} جهة اتصال...`]);

      const token = apiToken;
      const instId = instanceId;
      const message = campaignMessage;

      let successCount = 0;
      let failedCount = 0;

      // Loop and send sequentially to respect queue
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const num = target.whatsappNumber;
        const name = target.fullNameArabic;

        // Custom number check: fallback to "عميلنا العزيز"
        const isCustom = name.startsWith('رقم خارجي');
        const replacementName = isCustom ? 'عميلنا العزيز' : name;
        
        const personalizedMessage = message
          .replace(/{name}/g, replacementName)
          .replace(/{phone}/g, num);

        setCampaignProgress(prev => ({ ...prev, current: i + 1 }));
        setCampaignLogs(prev => [...prev, `جاري الإرسال إلى ${name} (${num})...`]);

        try {
          const res = await callWhatsAppApi('send-message', {
            instanceId: instId,
            wapilotInstanceId: instId,
            chatId: num,
            text: personalizedMessage,
            token: token,
            wapilotToken: token,
          });

          if (res && res.success) {
            successCount++;
            setCampaignProgress(prev => ({ ...prev, success: successCount }));
            setCampaignLogs(prev => [...prev, `✅ تم الإرسال بنجاح إلى ${name}.`]);
          } else {
            failedCount++;
            setCampaignProgress(prev => ({ ...prev, failed: failedCount }));
            setCampaignLogs(prev => [...prev, `❌ فشل الإرسال إلى ${name}: ${res?.message || 'رد غير معروف'}`]);
          }
        } catch (err: any) {
          failedCount++;
          setCampaignProgress(prev => ({ ...prev, failed: failedCount }));
          setCampaignLogs(prev => [...prev, `❌ خطأ أثناء الإرسال إلى ${name}: ${err.message || 'عطل اتصال'}`]);
        }

        // Delay 100ms between calls
        await new Promise(r => setTimeout(r, 100));
      }

      setIsSendingCampaign(false);
      setCampaignLogs(prev => [...prev, `🏁 اكتملت الحملة! النجاح: ${successCount}، الفشل: ${failedCount}`]);
      showAlert('اكتمل الإرسال', `تم الانتهاء من إرسال الحملة. إجمالي المحاولات: ${targets.length}. النجاح: ${successCount}، الفشل: ${failedCount}`, 'success');
    }, 'نعم، إرسال');
  };
  return (
    <div className="admin-content" style={{ direction: 'rtl', color: '#0f172a' }}>
      {/* Sub tabs switcher */}
      <div className="tabs-header" style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <button
          className={`tab-button inner-tab ${subTab === 'config' ? 'active' : ''}`}
          onClick={() => setSubTab('config')}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '8px', 
            border: 'none', 
            cursor: 'pointer',
            background: subTab === 'config' ? '#2563eb' : '#f1f5f9',
            color: subTab === 'config' ? '#ffffff' : '#475569',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            boxShadow: subTab === 'config' ? '0 4px 6px -1px rgba(37,99,235,0.2)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Settings size={16} style={{ marginLeft: '6px' }} />
          إعدادات الربط والردود التلقائية
        </button>
        <button
          className={`tab-button inner-tab ${subTab === 'campaign' ? 'active' : ''}`}
          onClick={() => setSubTab('campaign')}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '8px', 
            border: 'none', 
            cursor: 'pointer',
            background: subTab === 'campaign' ? '#2563eb' : '#f1f5f9',
            color: subTab === 'campaign' ? '#ffffff' : '#475569',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            boxShadow: subTab === 'campaign' ? '0 4px 6px -1px rgba(37,99,235,0.2)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Send size={16} style={{ marginLeft: '6px' }} />
          الإرسال المباشر والحملات
        </button>
      </div>

      {subTab === 'config' ? (
        !isConfigUnlocked ? (
          <div className="config-section" style={{ padding: '32px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '480px', margin: '40px auto', textAlign: 'center' }}>
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Lock size={24} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>قسم إعدادات الربط والردود التلقائية مغلق</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>يرجى إدخال كلمة المرور المخصصة لإجراء تعديلات على الربط أو قوالب الرسائل.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                className="premium-input"
                value={lockPasswordInput}
                onChange={(e) => {
                  setLockPasswordInput(e.target.value);
                  setLockError('');
                }}
                placeholder="أدخل كلمة مرور الإعدادات..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', textAlign: 'center' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUnlockConfig();
                }}
              />
              {lockError && <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>{lockError}</span>}
              
              <button
                type="button"
                onClick={handleUnlockConfig}
                style={{ padding: '10px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}
              >
                فتح قسم الإعدادات
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 1. Integration config section */}
            <div className="config-section" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div className="section-header-compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="header-icon-hex" style={{ padding: '10px', background: 'rgba(37,99,235,0.1)', borderRadius: '8px' }}>
                    <Key size={24} color="#2563eb" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>إعدادات حساب Wapilot</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>أدخل بيانات ربط الحساب للاتصال بـ WhatsApp API.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfigUnlocked(false);
                    setLockPasswordInput('');
                    try {
                      sessionStorage.removeItem('admin_whatsapp_config_unlocked');
                    } catch {}
                  }}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #f87171', background: '#fef2f2', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Lock size={12} /> قفل القسم
                </button>
              </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>Wapilot API Token</label>
                <input
                  type="password"
                  className="premium-input"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="أدخل رمز الـ Token..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '14px' }}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>قناة الجلسة (Instance ID / Unique Name)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {instances.length > 0 ? (
                    <select
                      className="premium-input"
                      value={instanceId}
                      onChange={(e) => setInstanceId(e.target.value)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '14px' }}
                    >
                      <option value="">اختر القناة...</option>
                      {instances.map(inst => (
                        <option key={inst.id} value={inst.instance_uniquename}>
                          {inst.instance_name} ({inst.instance_uniquename}) - {inst.status}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="premium-input"
                      value={instanceId}
                      onChange={(e) => setInstanceId(e.target.value)}
                      placeholder="مثال: Sales أو id"
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '14px' }}
                    />
                  )}
                  <button
                    className="action-button-secondary"
                    onClick={() => fetchInstancesList()}
                    disabled={isFetchingInstances || !apiToken}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="تحديث قائمة القنوات من Wapilot"
                  >
                    {isFetchingInstances ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} color="#475569" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Connection status card */}
            {instanceId && (
              <div style={{ 
                padding: '16px', 
                background: connectionStatus === 'WORKING' ? '#f0fdf4' : '#fef2f2', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                marginBottom: '16px', 
                border: connectionStatus === 'WORKING' ? '1px solid #bbf7d0' : '1px solid #fecaca' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={20} color={connectionStatus === 'WORKING' ? '#16a34a' : '#dc2626'} />
                  <div>
                    <span style={{ fontSize: '13px', color: '#475569' }}>حالة اتصال الواتساب: </span>
                    {isCheckingStatus ? (
                      <span style={{ fontSize: '13px', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Loader2 size={12} className="animate-spin" /> جاري الفحص...
                      </span>
                    ) : connectionStatus === 'WORKING' ? (
                      <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={14} /> متصل ونشط
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={14} /> غير متصل ({connectionStatus || 'مجهول'})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {connectionStatus !== 'WORKING' && (
                    <button
                      onClick={handleStartSession}
                      disabled={isSessionActionLoading || isCheckingStatus}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                    >
                      <Play size={12} /> ربط الجلسة / تشغيل
                    </button>
                  )}
                  {connectionStatus === 'WORKING' && (
                    <button
                      onClick={handleLogoutSession}
                      disabled={isSessionActionLoading}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
                    >
                      <LogOut size={12} /> قطع الاتصال
                    </button>
                  )}
                  <button
                    onClick={() => checkInstanceStatus(instanceId)}
                    disabled={isCheckingStatus}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', cursor: 'pointer' }}
                    title="تحديث الحالة"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* QR Code display */}
            {qrCode && connectionStatus !== 'WORKING' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px', width: 'fit-content', margin: '16px auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#0f172a', fontSize: '14px', fontWeight: 'bold' }}>امسح كود QR بالواتساب لربط الهاتف</h4>
                <img src={qrCode} alt="Wapilot QR Code" style={{ width: '200px', height: '200px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
                <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '11px', textAlign: 'center' }}>افتح الواتساب ➔ الأجهزة المرتبطة ➔ ربط جهاز جديد.</p>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={globalEnabled}
                  onChange={(e) => setGlobalEnabled(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>تفعيل الردود التلقائية للواتساب بشكل عام على النظام</span>
              </label>

              <button
                className="save-button-premium"
                onClick={handleSaveApiSettings}
                disabled={isSavingConfig}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(37,99,235,0.2)' }}
              >
                {isSavingConfig ? <Loader2 size={16} className="animate-spin" /> : null}
                حفظ الإعدادات
              </button>
            </div>
          </div>

          {/* 2. Automated replies templates list */}
          <div className="config-section" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div className="section-header-compact" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div className="header-icon-hex" style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: '8px' }}>
                <MessageSquare size={24} color="#10b981" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>قوالب الردود التلقائية للخدمات</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>قم بتهيئة القوالب النصية للرسائل التي ستصل للطلاب بشكل تلقائي لكل خدمة وحالة.</p>
              </div>
            </div>

            {/* List of services cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {SERVICES.map(service => {
                const config = serviceReplies[service.id] || { enabled: false };
                const isExpanded = expandedServiceId === service.id;
                
                return (
                  <div 
                    key={service.id} 
                    style={{ 
                      borderRadius: '8px', 
                      background: isExpanded ? '#ffffff' : '#f8fafc', 
                      border: `1px solid ${isExpanded ? '#3b82f6' : '#e2e8f0'}`,
                      overflow: 'hidden',
                      transition: 'all 0.2s',
                      boxShadow: isExpanded ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                    }}
                  >
                    {/* Card Header */}
                    <div 
                      style={{ 
                        padding: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: isExpanded ? '#eff6ff' : 'transparent'
                      }}
                      onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: service.color || '#3b82f6' }} />
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{service.nameAr}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginRight: '8px' }}>({service.nameEn})</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} onClick={e => e.stopPropagation()}>
                        {/* Toggle switch */}
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!config.enabled}
                            onChange={() => handleToggleServiceEnabled(service.id)}
                            style={{ width: '14px', height: '14px' }}
                          />
                          <span style={{ fontSize: '12px', color: config.enabled ? '#16a34a' : '#64748b', fontWeight: '600' }}>
                            {config.enabled ? 'مفعل' : 'معطل'}
                          </span>
                        </label>

                        <button
                          onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}
                        >
                          {isExpanded ? 'إغلاق القوالب ▲' : 'تعديل القوالب ▼'}
                        </button>
                      </div>
                    </div>

                    {/* Card Templates Body — uses stable <TemplateField> defined outside this component */}
                    {isExpanded && (
                      <div style={{ padding: '16px', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>

                        {/* Placeholder info bar */}
                        <div style={{ padding: '8px 14px', background: '#eff6ff', borderRadius: '8px', marginBottom: '14px', border: '1px solid #bfdbfe', fontSize: '11px', color: '#1e40af' }}>
                          💡 اضغط على الأزرار أدناه لإضافة متغير في مكان المؤشر — يُستبدل تلقائياً ببيانات الطالب عند الإرسال
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <TemplateField
                            id={`tpl-${service.id}-pending`}
                            label="📨 رسالة قيد الانتظار (قيد المراجعة / الانتظار)"
                            placeholder={`مرحباً {name}، طلبك لخدمة {service} قيد الانتظار والمراجعة الآن. رقم الطلب: {id}.`}
                            value={config.pendingTemplate || ''}
                            onChange={v => handleTemplateChange(service.id, 'pendingTemplate', v)}
                            serviceName={service.nameAr}
                          />
                          <TemplateField
                            id={`tpl-${service.id}-submitted`}
                            label="📨 رسالة تم التقديم (تم تقديم الطلب)"
                            placeholder={`مرحباً {name}، تم تقديم طلبك لخدمة {service} بنجاح. رقم الطلب: {id}. وسنباشر العمل عليه.`}
                            value={config.submittedTemplate || ''}
                            onChange={v => handleTemplateChange(service.id, 'submittedTemplate', v)}
                            serviceName={service.nameAr}
                          />
                          <TemplateField
                            id={`tpl-${service.id}-receipt`}
                            label="🧾 رسالة إيصال الدفع (تم إرسال الإيصال)"
                            placeholder={`مرحباً {name}، تم إرسال إيصال الدفع لطلبك ({service}) بنجاح. سنتحقق ونؤكد قريباً.`}
                            value={config.receiptSentTemplate || ''}
                            onChange={v => handleTemplateChange(service.id, 'receiptSentTemplate', v)}
                            serviceName={service.nameAr}
                            show={!!(service.paymentMethods && service.paymentMethods.length > 0)}
                          />
                          <TemplateField
                            id={`tpl-${service.id}-completed`}
                            label="✅ رسالة الاكتمال (مقبول / مكتمل)"
                            placeholder={`عزيزي {name}، يسعدنا إبلاغك بأن طلبك لخدمة {service} قد اكتمل بنجاح!`}
                            value={config.completedTemplate || ''}
                            onChange={v => handleTemplateChange(service.id, 'completedTemplate', v)}
                            serviceName={service.nameAr}
                          />
                          <TemplateField
                            id={`tpl-${service.id}-rejected`}
                            label="❌ رسالة الرفض (مرفوض)"
                            placeholder={`مرحباً {name}، نود إعلامك بأن طلبك لخدمة {service} قد تم رفضه. يرجى التواصل مع الدعم.`}
                            value={config.rejectedTemplate || ''}
                            onChange={v => handleTemplateChange(service.id, 'rejectedTemplate', v)}
                            serviceName={service.nameAr}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className="save-button-premium"
                onClick={handleSaveApiSettings}
                disabled={isSavingConfig}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16,185,129,0.2)' }}
              >
                {isSavingConfig ? <Loader2 size={16} className="animate-spin" /> : null}
                حفظ كافة قوالب الردود
              </button>
            </div>
          </div>

        </div>
      )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Direct Messaging section */}
          <div className="config-section" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div className="section-header-compact" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div className="header-icon-hex" style={{ padding: '10px', background: 'rgba(245,158,11,0.1)', borderRadius: '8px' }}>
                <Users size={24} color="#F59E0B" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>إرسال رسائل وحملات جماعية للطلاب</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>ابحث وحدد الطلاب المسجلين لإرسال رسالة واتساب مخصصة لهم مباشرة.</p>
              </div>
            </div>

            {/* Form layout */}
            <div className="wa-campaign-grid">
              
              {/* Right Column: Audience definition / selection inputs */}
              <div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>الجمهور المستهدف (المرسل إليهم)</label>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#0f172a', fontWeight: '500' }}>
                      <input
                        type="radio"
                        name="campaign_target"
                        checked={campaignTarget === 'selected'}
                        onChange={() => setCampaignTarget('selected')}
                        style={{ width: '16px', height: '16px' }}
                      />
                      طلاب محددين بالبحث والتحديد ({selectedStudentIds.size})
                    </label>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#0f172a', fontWeight: '500' }}>
                      <input
                        type="radio"
                        name="campaign_target"
                        checked={campaignTarget === 'all'}
                        onChange={() => setCampaignTarget('all')}
                        style={{ width: '16px', height: '16px' }}
                      />
                      جميع الطلاب المسجلين بالنظام ({studentList.length} طالب)
                    </label>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#0f172a', fontWeight: '500' }}>
                      <input
                        type="radio"
                        name="campaign_target"
                        checked={campaignTarget === 'custom'}
                        onChange={() => setCampaignTarget('custom')}
                        style={{ width: '16px', height: '16px' }}
                      />
                      أرقام خارجية (مخصصة / ملف Excel أو PDF) ({customNumbers.length} رقم)
                    </label>
                  </div>
                </div>

                {campaignTarget === 'custom' && (
                  <>
                    <div style={{ padding: '16px', border: '1px dashed #3b82f6', borderRadius: '10px', background: '#f8fafc', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      
                      {/* Add Single / Manual Number */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>إضافة رقم يدوي فردي</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="premium-input"
                            value={manualNumberInput}
                            onChange={(e) => setManualNumberInput(e.target.value)}
                            placeholder="اكتب رقم الهاتف (مثال: 01012345678)..."
                            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddManualNumber(); }}
                          />
                          <button
                            type="button"
                            onClick={handleAddManualNumber}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '13px' }}
                          >
                            <Plus size={14} /> إضافة
                          </button>
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>أو</span>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                      </div>

                      {/* File Upload Dropzone */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>رفع ملف يحتوي على أرقام (Excel أو PDF)</label>
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          style={{ 
                            border: '2px dashed #3b82f6', 
                            borderRadius: '8px', 
                            padding: '16px', 
                            background: '#eff6ff', 
                            textAlign: 'center', 
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xlsx,.xls,.pdf"
                            style={{ display: 'none' }}
                          />
                          {isParsingFile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                              <Loader2 size={24} className="animate-spin" />
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>جاري استخراج الأرقام من الملف...</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#1e40af' }}>
                              <Upload size={24} />
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>اضغط هنا لاختيار ملف Excel (.xlsx/.xls) أو PDF</span>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>سيقوم النظام باستخراج جميع أرقام الهواتف الصالحة منه</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Divider */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>أو</span>
                        <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                      </div>

                      {/* Bulk numbers textarea */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>لصق أرقام متعددة (مفصولة بفاصلة أو سطر جديد)</label>
                        <textarea
                          className="premium-textarea"
                          value={bulkNumbersInput}
                          onChange={(e) => setBulkNumbersInput(e.target.value)}
                          placeholder={`الصق قائمة أرقام هنا، على سبيل المثال:
01012345678, 01198765432
01211111111`}
                          style={{ width: '100%', minHeight: '85px', padding: '8px 12px', borderRadius: '8px', background: '#fff', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          onClick={handleAddBulkNumbers}
                          style={{ width: '100%', marginTop: '6px', padding: '8px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                        >
                          معالجة واستخراج الأرقام من النص
                        </button>
                      </div>

                    </div>

                    {/* قائمة الأرقام المضافة */}
                    <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #cbd5e1', borderRadius: '10px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ margin: 0, fontSize: '13px', color: '#1e3a8a', fontWeight: 'bold' }}>قائمة الأرقام الخارجية المضافة</label>
                        {customNumbers.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllCustomNumbers}
                            style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            <Trash2 size={12} /> حذف الكل
                          </button>
                        )}
                      </div>

                      {/* Custom Numbers Search Bar */}
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <input
                          type="text"
                          className="premium-input"
                          value={customSearchTerm}
                          onChange={(e) => setCustomSearchTerm(e.target.value)}
                          placeholder="البحث في الأرقام المضافة..."
                          style={{ width: '100%', padding: '8px 32px 8px 8px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '12px' }}
                        />
                        <Search size={14} color="#64748b" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                      </div>

                      {/* Matching results table */}
                      <div 
                        style={{ 
                          maxHeight: '200px', 
                          overflowY: 'auto', 
                          borderRadius: '8px', 
                          background: '#ffffff', 
                          border: '1px solid #cbd5e1',
                          padding: '8px'
                        }}
                      >
                        {filteredCustomNumbers.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {filteredCustomNumbers.map((num, idx) => (
                              <div 
                                key={num + '-' + idx} 
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'space-between', 
                                  padding: '6px 10px', 
                                  borderRadius: '6px', 
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  transition: 'all 0.1s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>#{idx + 1}</span>
                                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace' }}>{num}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomNumber(num)}
                                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="حذف الرقم من القائمة"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 10px', textAlign: 'center' }}>
                            <Users size={24} color="#64748b" style={{ marginBottom: '6px' }} />
                            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                              {customNumbers.length === 0 ? 'القائمة فارغة. أضف أرقاماً أعلاه.' : 'لا توجد أرقام مطابقة للبحث.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {customNumbers.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>
                          إجمالي الأرقام المضافة حالياً: {customNumbers.length} رقم
                        </div>
                      )}
                    </div>
                  </>
                )}

                {campaignTarget === 'selected' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>ابحث وحدد الطلاب المستهدفين</label>
                    
                    {/* Search & dropdown container */}
                    <div ref={searchWrapperRef} style={{ position: 'relative', marginBottom: '12px' }}>
                      {/* Search Bar */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type="text"
                            className="premium-input"
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                              setShowSearchDropdown(true);
                            }}
                            onFocus={() => setShowSearchDropdown(true)}
                            placeholder="ابحث بالاسم، الرقم القومي، رقم الهاتف..."
                            style={{ width: '100%', padding: '10px 36px 10px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '13px' }}
                          />
                          <Search size={16} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                      </div>

                      {/* Matching results table as dropdown */}
                      {showSearchDropdown && searchTerm.trim() !== '' && (
                        <div 
                          style={{ 
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            maxHeight: '220px', 
                            overflowY: 'auto', 
                            borderRadius: '8px', 
                            background: '#ffffff', 
                            border: '1px solid #cbd5e1',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            padding: '8px',
                            zIndex: 50
                          }}
                        >
                          {filteredStudents.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', marginBottom: '4px' }}>
                                <button 
                                  type="button"
                                  onClick={handleSelectAllFiltered}
                                  style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  تحديد نتائج البحث كاملة
                                </button>
                                <button 
                                  type="button"
                                  onClick={handleClearSelection}
                                  style={{ border: 'none', background: 'transparent', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                  إلغاء التحديد الحالي
                                </button>
                              </div>

                              {filteredStudents.map(student => {
                                const isSelected = student.id && selectedStudentIds.has(student.id);
                                return (
                                  <div 
                                    key={student.id} 
                                    onClick={() => student.id && handleToggleSelectStudent(student.id)}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '10px', 
                                      padding: '8px', 
                                      borderRadius: '6px', 
                                      cursor: 'pointer',
                                      background: isSelected ? '#eff6ff' : 'transparent',
                                      border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                                      transition: 'all 0.1s'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!isSelected}
                                      onChange={() => {}} // Done via row click
                                      style={{ pointerEvents: 'none' }}
                                    />
                                    <div style={{ flex: 1, textAlign: 'right' }}>
                                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>{student.fullNameArabic}</div>
                                      <div style={{ fontSize: '11px', color: '#475569', display: 'flex', gap: '8px', marginTop: '2px' }}>
                                        <span>📞 {student.whatsappNumber || 'بدون رقم'}</span>
                                        <span>🆔 {student.nationalID}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 10px', textAlign: 'center' }}>
                              <Users size={28} color="#475569" style={{ marginBottom: '6px' }} />
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                لا توجد نتائج مطابقة لعملية البحث
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected counter info */}
                    {selectedStudentIds.size > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                        <span>تم تحديد: {selectedStudentIds.size} طالب</span>
                        <button 
                          type="button"
                          onClick={handleClearSelection}
                          style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}
                        >
                          إلغاء اختيار الكل
                        </button>
                      </div>
                    )}

                    {/* الطلاب المختارون حالياً (مباشرة ليرى المستخدم من اختار) */}
                    {selectedStudentIds.size > 0 && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid #cbd5e1', paddingTop: '12px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#1e3a8a', fontWeight: 'bold' }}>
                          الطلاب المختارون حالياً ({selectedStudentIds.size} طالب):
                        </label>
                        <div style={{ 
                          maxHeight: '180px', 
                          overflowY: 'auto', 
                          background: '#f8fafc', 
                          border: '1px solid #cbd5e1', 
                          borderRadius: '8px', 
                          padding: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          {studentList.filter(s => s.id && selectedStudentIds.has(s.id)).map(student => (
                            <div 
                              key={student.id} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '6px 10px', 
                                borderRadius: '6px', 
                                background: '#ffffff',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              <div style={{ fontSize: '12px', color: '#0f172a', fontWeight: 'bold', textAlign: 'right' }}>
                                {student.fullNameArabic}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{student.whatsappNumber || 'بدون رقم'}</span>
                                <button
                                  type="button"
                                  onClick={() => student.id && handleToggleSelectStudent(student.id)}
                                  style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                                  title="إلغاء تحديد هذا الطالب"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Left Column: Message composition and sending actions */}
              <div>
                
                {/* Target Audience Summary Info Card */}
                {campaignTarget === 'all' && (
                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #bbf7d0', background: '#f0fdf4', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', marginBottom: '16px' }}>
                    <Users size={32} color="#16a34a" />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#14532d', fontWeight: 'bold' }}>إرسال عام لجميع الطلاب</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#166534', lineHeight: '1.5' }}>
                        سيتم إرسال هذه الرسالة إلى جميع الطلاب الذين يمتلكون أرقام هواتف مسجلة.
                      </p>
                      <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 'bold', color: '#15803d' }}>
                        العدد المستهدف الحالي: {studentList.filter(s => !!s.whatsappNumber).length} طالب
                      </div>
                    </div>
                  </div>
                )}

                {campaignTarget === 'custom' && (
                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #bfdbfe', background: '#eff6ff', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', marginBottom: '16px' }}>
                    <Smartphone size={32} color="#2563eb" />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e3a8a', fontWeight: 'bold' }}>حملة أرقام خارجية مخصصة</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#1e40af', lineHeight: '1.5' }}>
                        سيتم إرسال هذه الرسالة إلى الأرقام الخارجية التي قمت بإضافتها أو استيرادها.
                      </p>
                      <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 'bold', color: '#2563eb' }}>
                        إجمالي الأرقام المستهدفة حالياً: {customNumbers.length} رقم
                      </div>
                    </div>
                  </div>
                )}

                {campaignTarget === 'selected' && (
                  <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #fef08a', background: '#fefcbf', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center', marginBottom: '16px' }}>
                    <Users size={32} color="#ca8a04" />
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#854d0e', fontWeight: 'bold' }}>إرسال لطلاب محددين</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#a16207', lineHeight: '1.5' }}>
                        سيتم إرسال هذه الرسالة فقط للطلاب الذين قمت بتحديدهم بالبحث بالأعلى.
                      </p>
                      <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 'bold', color: '#ca8a04' }}>
                        العدد المستهدف الحالي: {selectedStudentIds.size} طالب
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Content composition */}
                <div className="form-group-full" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ margin: 0, fontSize: '13px', color: '#334155', fontWeight: '600' }}>محتوى الرسالة المراد إرسالها</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>إدراج متغير:</span>
                      <button
                        type="button"
                        onClick={() => insertPlaceholder('{name}')}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s' }}
                        title="سيتم استبداله باسم الطالب تلقائياً (أو 'عميلنا العزيز' للأرقام الخارجية)"
                      >
                        {"{الاسم}"}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertPlaceholder('{phone}')}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.15s' }}
                        title="سيتم استبداله برقم الهاتف تلقائياً"
                      >
                        {"{الهاتف}"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={campaignMessageRef}
                    className="premium-textarea"
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    style={{ width: '100%', minHeight: '160px', padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '14px', lineHeight: '1.6', boxSizing: 'border-box' }}
                  />
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#64748b' }}>يرجى كتابة نص الرسالة بوضوح وتجنب الروابط المشبوهة لمنع حظر الرقم من WhatsApp.</p>
                </div>

                {isSendingCampaign ? (
                  <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: '#334155', fontWeight: 'bold' }}>
                      <span>جاري الإرسال: {campaignProgress.current} من {campaignProgress.total}</span>
                      <span>نسبة الإنجاز: {Math.round((campaignProgress.current / campaignProgress.total) * 100)}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${(campaignProgress.current / campaignProgress.total) * 100}%`, background: '#f59e0b', transition: 'width 0.1s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 'bold' }}>
                      <span style={{ color: '#16a34a' }}>نجح: {campaignProgress.success}</span>
                      <span style={{ color: '#dc2626' }}>فشل: {campaignProgress.failed}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleSendCampaign}
                    disabled={isSendingCampaign || 
                      (campaignTarget === 'selected' && selectedStudentIds.size === 0) ||
                      (campaignTarget === 'custom' && customNumbers.length === 0)
                    }
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: 'none', 
                      background: (
                        (campaignTarget === 'selected' && selectedStudentIds.size === 0) ||
                        (campaignTarget === 'custom' && customNumbers.length === 0)
                      ) ? '#e2e8f0' : '#f59e0b', 
                      color: (
                        (campaignTarget === 'selected' && selectedStudentIds.size === 0) ||
                        (campaignTarget === 'custom' && customNumbers.length === 0)
                      ) ? '#94a3b8' : '#fff', 
                      fontWeight: 'bold', 
                      cursor: (
                        (campaignTarget === 'selected' && selectedStudentIds.size === 0) ||
                        (campaignTarget === 'custom' && customNumbers.length === 0)
                      ) ? 'not-allowed' : 'pointer',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '15px',
                      boxShadow: (
                        (campaignTarget === 'selected' && selectedStudentIds.size === 0) ||
                        (campaignTarget === 'custom' && customNumbers.length === 0)
                      ) ? 'none' : '0 4px 6px -1px rgba(245,158,11,0.2)'
                    }}
                  >
                    <Send size={16} />
                    إرسال الرسائل الآن عبر واتساب
                  </button>
                )}

                {/* Live Progress Logs */}
                {campaignLogs.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: '#334155', fontWeight: '600' }}>سجل عمليات الإرسال الحالية</label>
                    <div 
                      style={{ 
                        height: '140px', 
                        overflowY: 'auto', 
                        background: '#0f172a', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        fontFamily: 'monospace', 
                        fontSize: '12px', 
                        color: '#34d399', 
                        lineHeight: '1.6',
                        border: '1px solid #1e293b'
                      }}
                    >
                      {campaignLogs.map((log, idx) => (
                        <div key={idx}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default AdminWhatsAppTab;
