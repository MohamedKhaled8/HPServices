import React, { useState, useEffect, useMemo } from 'react';
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
  Smartphone
} from 'lucide-react';
import { SERVICES } from '../../constants/services';
import { StudentData } from '../../types';
import { callWhatsAppApi } from '../../utils/whatsapp';
import { logger } from '../../utils/logger';

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
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
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
  const [apiToken, setApiToken] = useState(adminPrefs.wapilotToken || 'P4VNqf576wkKpew05rKOtdtr24Ug89nEQ4kzslhhs7');
  const [instanceId, setInstanceId] = useState(adminPrefs.wapilotInstanceId || '');
  const [globalEnabled, setGlobalEnabled] = useState(adminPrefs.wapilotEnabled !== false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

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
  const [campaignTarget, setCampaignTarget] = useState<'selected' | 'all'>('selected');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [campaignMessage, setCampaignMessage] = useState('');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [campaignLogs, setCampaignLogs] = useState<string[]>([]);

  // Fetch status on instanceId changes
  useEffect(() => {
    if (apiToken && instanceId) {
      checkInstanceStatus(apiToken, instanceId);
    }
  }, [instanceId]);

  // Load instances list on mount if token exists
  useEffect(() => {
    if (apiToken) {
      fetchInstancesList(apiToken);
    }
  }, []);

  const fetchInstancesList = async (token: string) => {
    setIsFetchingInstances(true);
    try {
      const res = await callWhatsAppApi('instances', { token });
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

  const checkInstanceStatus = async (token: string, instId: string) => {
    if (!token || !instId) return;
    setIsCheckingStatus(true);
    setConnectionStatus(null);
    setQrCode(null);
    try {
      const res = await callWhatsAppApi('status', { token, instanceId: instId });
      if (res && res.success && res.status) {
        setConnectionStatus(res.status); // WORKING, CONNECTING, DISCONNECTED, etc.
        if (res.status !== 'WORKING') {
          // Fetch QR code if not connected
          fetchQrCode(token, instId);
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

  const fetchQrCode = async (token: string, instId: string) => {
    setIsFetchingQr(true);
    setQrCode(null);
    try {
      const res = await callWhatsAppApi('qr-code', { token, instanceId: instId });
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
    if (!apiToken || !instanceId) return;
    setIsSessionActionLoading(true);
    try {
      const res = await callWhatsAppApi('start', { token: apiToken, instanceId });
      showAlert('تنبيه', 'تم إرسال طلب تشغيل الجلسة، جاري التحقق من الحالة...', 'info');
      setTimeout(() => checkInstanceStatus(apiToken, instanceId), 3000);
    } catch (err: any) {
      showAlert('خطأ', err.message || 'فشل تشغيل الجلسة', 'error');
    } finally {
      setIsSessionActionLoading(false);
    }
  };

  const handleLogoutSession = async () => {
    if (!apiToken || !instanceId) return;
    showConfirm('تسجيل الخروج', 'هل أنت متأكد من قطع اتصال الواتس اب الحالي؟ سيتطلب إرسال الرسائل مسح كود QR مجدداً.', async () => {
      setIsSessionActionLoading(true);
      try {
        const res = await callWhatsAppApi('logout', { token: apiToken, instanceId });
        showAlert('نجاح', 'تم تسجيل الخروج وقطع الجلسة بنجاح.', 'success');
        checkInstanceStatus(apiToken, instanceId);
      } catch (err: any) {
        showAlert('خطأ', err.message || 'فشل تسجيل الخروج', 'error');
      } finally {
        setIsSessionActionLoading(false);
      }
    });
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
      checkInstanceStatus(apiToken, instanceId);
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

  // Convert student record to list for search
  const studentList = useMemo(() => Object.values(students || {}), [students]);

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
    let targets: StudentData[] = [];
    if (campaignTarget === 'all') {
      targets = studentList.filter(s => !!s.whatsappNumber);
    } else {
      targets = studentList.filter(s => s.id && selectedStudentIds.has(s.id));
    }

    if (targets.length === 0) {
      showAlert('تنبيه', 'يرجى اختيار طالب واحد على الأقل كمسلم للرسالة.', 'warning');
      return;
    }

    showConfirm('تأكيد الحملة', `هل أنت متأكد من إرسال هذه الرسالة إلى ${targets.length} طالب؟`, async () => {
      setIsSendingCampaign(true);
      setCampaignProgress({ current: 0, total: targets.length, success: 0, failed: 0 });
      setCampaignLogs([`🚀 بدء حملة الإرسال لـ ${targets.length} طالب...`]);

      const token = apiToken;
      const instId = instanceId;
      const message = campaignMessage;

      // Loop and send sequentially to respect queue
      for (let i = 0; i < targets.length; i++) {
        const student = targets[i];
        const num = student.whatsappNumber;
        const name = student.fullNameArabic || 'طالب مسجل';

        setCampaignProgress(prev => ({ ...prev, current: i + 1 }));
        setCampaignLogs(prev => [...prev, `جاري الإرسال إلى ${name} (${num})...`]);

        try {
          const res = await callWhatsAppApi('send-message', {
            token,
            instanceId: instId,
            chatId: num,
            text: message
          });

          if (res && res.success) {
            setCampaignProgress(prev => ({ ...prev, success: prev.success + 1 }));
            setCampaignLogs(prev => [...prev, `✅ تم الإرسال بنجاح إلى ${name}.`]);
          } else {
            setCampaignProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
            setCampaignLogs(prev => [...prev, `❌ فشل الإرسال إلى ${name}: ${res?.message || 'رد غير معروف'}`]);
          }
        } catch (err: any) {
          setCampaignProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
          setCampaignLogs(prev => [...prev, `❌ خطأ أثناء الإرسال إلى ${name}: ${err.message || 'عطل اتصال'}`]);
        }

        // Delay 100ms between calls
        await new Promise(r => setTimeout(r, 100));
      }

      setIsSendingCampaign(false);
      setCampaignLogs(prev => [...prev, `🏁 اكتملت الحملة! النجاح: ${campaignProgress.success + 1}، الفشل: ${campaignProgress.failed}`]);
      showAlert('اكتمل الإرسال', `تم الانتهاء من إرسال الحملة. إجمالي المحاولات: ${targets.length}`, 'success');
    });
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Integration config section */}
          <div className="config-section" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div className="section-header-compact" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div className="header-icon-hex" style={{ padding: '10px', background: 'rgba(37,99,235,0.1)', borderRadius: '8px' }}>
                <Key size={24} color="#2563eb" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>إعدادات حساب Wapilot</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>أدخل بيانات ربط الحساب للاتصال بـ WhatsApp API.</p>
              </div>
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
                    onClick={() => fetchInstancesList(apiToken)}
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
                    onClick={() => checkInstanceStatus(apiToken, instanceId)}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              
              {/* Message content and settings */}
              <div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>الجمهور المستهدف (المرسل إليهم)</label>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#0f172a', fontWeight: '500' }}>
                      <input
                        type="radio"
                        name="campaign_target"
                        checked={campaignTarget === 'selected'}
                        onChange={() => setCampaignTarget('selected')}
                        style={{ width: '16px', height: '16px' }}
                      />
                      طلاب محددين بالبحث والتحديد ({selectedStudentIds.size})
                    </label>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#0f172a', fontWeight: '500' }}>
                      <input
                        type="radio"
                        name="campaign_target"
                        checked={campaignTarget === 'all'}
                        onChange={() => setCampaignTarget('all')}
                        style={{ width: '16px', height: '16px' }}
                      />
                      جميع الطلاب المسجلين بالنظام ({studentList.length} طالب)
                    </label>
                  </div>
                </div>

                <div className="form-group-full" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>محتوى الرسالة المراد إرسالها</label>
                  <textarea
                    className="premium-textarea"
                    value={campaignMessage}
                    onChange={(e) => setCampaignMessage(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    style={{ width: '100%', minHeight: '160px', padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '14px', lineHeight: '1.6' }}
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
                    disabled={isSendingCampaign || (campaignTarget === 'selected' && selectedStudentIds.size === 0)}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: 'none', 
                      background: (campaignTarget === 'selected' && selectedStudentIds.size === 0) ? '#e2e8f0' : '#f59e0b', 
                      color: (campaignTarget === 'selected' && selectedStudentIds.size === 0) ? '#94a3b8' : '#fff', 
                      fontWeight: 'bold', 
                      cursor: (campaignTarget === 'selected' && selectedStudentIds.size === 0) ? 'not-allowed' : 'pointer',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '15px',
                      boxShadow: (campaignTarget === 'selected' && selectedStudentIds.size === 0) ? 'none' : '0 4px 6px -1px rgba(245,158,11,0.2)'
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

              {/* Recipient Selection search (Visible only when campaignTarget is 'selected') */}
              <div style={{ opacity: campaignTarget === 'selected' ? 1 : 0.4, pointerEvents: campaignTarget === 'selected' ? 'auto' : 'none' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>ابحث وحدد الطلاب المستهدفين</label>
                
                {/* Search Bar */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type="text"
                      className="premium-input"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ابحث بالاسم، الرقم القومي، رقم الهاتف..."
                      style={{ width: '100%', padding: '10px 36px 10px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '13px' }}
                    />
                    <Search size={16} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                </div>

                {/* Matching results table */}
                <div 
                  style={{ 
                    maxHeight: '320px', 
                    overflowY: 'auto', 
                    borderRadius: '8px', 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1',
                    padding: '8px'
                  }}
                >
                  {filteredStudents.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', marginBottom: '4px' }}>
                        <button 
                          onClick={handleSelectAllFiltered}
                          style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          تحديد نتائج البحث كاملة
                        </button>
                        <button 
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 10px', textAlign: 'center' }}>
                      <Users size={32} color="#475569" style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                        {searchTerm.trim() ? 'لا توجد نتائج مطابقة لعملية البحث' : 'ابدأ بكتابة اسم الطالب أو الرقم في خانة البحث لعرض النتائج وتحديدها.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Selected counter info */}
                {selectedStudentIds.size > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                    <span>تم تحديد: {selectedStudentIds.size} طالب</span>
                    <button 
                      onClick={handleClearSelection}
                      style={{ border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}
                    >
                      تصفير الاختيار
                    </button>
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
