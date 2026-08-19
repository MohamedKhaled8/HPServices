import React, { useState, useEffect } from 'react';
import {
  Database,
  DownloadCloud,
  UploadCloud,
  ShieldCheck,
  RefreshCw,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Cloud,
  Layers,
  Users,
  Trash2,
  RotateCcw,
  Server,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  generateFullDatabaseBackup,
  downloadBackupAsJSON,
  uploadBackupToSupabase,
  restoreFullDatabaseBackup,
  listSupabaseBackups,
  deleteSupabaseBackup,
  fetchSupabaseBackupPayload,
  SupabaseBackupFile,
  FullBackupPayload
} from '../../services/backupService';
import { getCountFromServer, collection } from 'firebase/firestore';
import { db } from '../../config/firebase';

interface AdminBackupTabProps {
  showAlert?: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void) => void;
}

// SHA-256 Hash of backup-tab password for in-memory encrypted verification
const TARGET_PASSWORD_HASH = '0dcc63cd5736f21c0c28966460732ed5ae889b3f46e6f6434fc0ec17295abda7';

const AdminBackupTab: React.FC<AdminBackupTabProps> = ({ showAlert, showConfirm }) => {
  // Lock / Unlock Password Protection State (Isolated to Backup Tab)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('hp_backup_tab_unlocked') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Backup Operations State
  const [isExporting, setIsExporting] = useState(false);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  const [lastBackupInfo, setLastBackupInfo] = useState<{
    date: string;
    totalDocs: number;
    collectionsCount: number;
  } | null>(null);

  const [liveStats, setLiveStats] = useState({
    studentsCount: 0,
    requestsCount: 0,
    loading: true
  });

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingRestorePayload, setPendingRestorePayload] = useState<FullBackupPayload | null>(null);
  const [confirmInputText, setConfirmInputText] = useState('');

  // Supabase Storage Backups State
  const [supabaseBackups, setSupabaseBackups] = useState<SupabaseBackupFile[]>([]);
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false);
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);

  // Helper for SHA-256 password hashing
  const hashPasswordSHA256 = async (pwd: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // Password Unlock Handler with Encrypted Verification
  const handleUnlockSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setIsVerifyingPassword(true);

    try {
      const inputHash = await hashPasswordSHA256(passwordInput.trim());
      // Encrypted in-memory comparison
      if (inputHash === TARGET_PASSWORD_HASH) {
        setIsUnlocked(true);
        sessionStorage.setItem('hp_backup_tab_unlocked', 'true');
        setPasswordInput('');
        if (showAlert) {
          showAlert('تم الفتح بنجاح 🔓', 'أهلاً بك في قسم النسخ الاحتياطي وإدارة السحابة.', 'success');
        }
      } else {
        setPasswordError('كلمة المرور غير صحيحة! يرجى التأكد وإعادة المحاولة.');
      }
    } catch (err) {
      console.error(err);
      setPasswordError('حدث خطأ أثناء فحص كلمة المرور.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Lock Tab Handler
  const handleLockSection = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('hp_backup_tab_unlocked');
    setPasswordInput('');
    setPasswordError('');
    if (showAlert) {
      showAlert('تم قفل القسم 🔒', 'تم قفل قسم النسخ الاحتياطي لحماية البيانات.', 'info');
    }
  };

  const fetchCloudBackups = async () => {
    setLoadingCloudBackups(true);
    try {
      const list = await listSupabaseBackups();
      setSupabaseBackups(list);
    } catch (err) {
      console.warn('تعذر جلب النسخ الاحتياطية من Supabase:', err);
    } finally {
      setLoadingCloudBackups(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      const fetchQuickStats = async () => {
        try {
          const studentsSnap = await getCountFromServer(collection(db, 'students'));
          const requestsSnap = await getCountFromServer(collection(db, 'serviceRequests'));

          setLiveStats({
            studentsCount: studentsSnap.data().count || 0,
            requestsCount: requestsSnap.data().count || 0,
            loading: false
          });
        } catch (err) {
          console.warn('تعذر جلب الإحصائيات السريعة:', err);
          setLiveStats((prev) => ({ ...prev, loading: false }));
        }
      };
      fetchQuickStats();
      fetchCloudBackups();
    }
  }, [isUnlocked]);

  // 1. إجراء التصدير والتنزيل المحلي
  const handleExportAndDownload = async () => {
    setIsExporting(true);
    setProgressText('بدء فحص وتجميع قواعد البيانات...');
    setProgressPercent(5);

    try {
      const payload = await generateFullDatabaseBackup((text, pct) => {
        setProgressText(text);
        setProgressPercent(pct);
      });

      downloadBackupAsJSON(payload);

      setLastBackupInfo({
        date: new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          day: 'numeric',
          month: 'short'
        }),
        totalDocs: payload.metadata.totalDocuments,
        collectionsCount: payload.metadata.collectionsSummary.length
      });

      if (showAlert) {
        showAlert(
          'تم بنجاح! 🚀',
          `تم تنزيل النسخة الاحتياطية بنجاح وتضم (${payload.metadata.totalDocuments}) مستند وبث كامل 100% لكافة الخدمات.`
        );
      }
    } catch (err: any) {
      console.error(err);
      if (showAlert) {
        showAlert('خطأ في التصدير', err.message || 'حدث خطأ أثناء تجميع النسخة الاحتياطية.');
      }
    } finally {
      setIsExporting(false);
      setProgressText('');
      setProgressPercent(0);
    }
  };

  // 2. إجراء التصدير والحفظ في Supabase Storage
  const handleExportToSupabase = async () => {
    setIsUploadingCloud(true);
    setProgressText('توليد النسخة الشاملة للتخزين السحابي...');
    setProgressPercent(10);

    try {
      const payload = await generateFullDatabaseBackup((text, pct) => {
        setProgressText(text);
        setProgressPercent(Math.round(pct * 0.8));
      });

      setProgressText('جاري رفع الملف وحفظه سحابياً على Supabase...');
      setProgressPercent(85);

      const res = await uploadBackupToSupabase(payload);
      if (!res.success) {
        throw new Error(res.error || 'فشل رفع الملف إلى Supabase');
      }

      setProgressPercent(100);
      if (showAlert) {
        showAlert('تم الحفظ السحابي بنجاح ☁️', `تم رفع النسخة الاحتياطية إلى Supabase Storage بنجاح المسار: (${res.path})`);
      }
      await fetchCloudBackups();
    } catch (err: any) {
      console.error(err);
      if (showAlert) {
        showAlert('خطأ التخزين السحابي', err.message || 'تعذر رفع الباك أب لسحابة Supabase.');
      }
    } finally {
      setIsUploadingCloud(false);
      setProgressText('');
      setProgressPercent(0);
    }
  };

  // 3. حذف نسخة احتياطية محددة من Supabase Storage
  const handleDeleteCloudBackup = (file: SupabaseBackupFile) => {
    const confirmMsg = `هل أنت متأكد من حذف النسخة الاحتياطية (${file.name}) بشكل نهائي من Supabase؟ لن تتمكن من استرجاعها بعد الحذف.`;

    const doDelete = async () => {
      setDeletingFileName(file.name);
      try {
        const res = await deleteSupabaseBackup(file.name);
        if (!res.success) {
          throw new Error(res.error || 'تعذر حذف الملف');
        }

        if (showAlert) {
          showAlert('تم الحذف بنجاح 🗑️', `تم حذف النسخة الاحتياطية (${file.name}) من Supabase Storage.`);
        }
        await fetchCloudBackups();
      } catch (err: any) {
        console.error(err);
        if (showAlert) {
          showAlert('خطأ في الحذف ❌', err.message || 'فشلت عملية الحذف من Supabase.');
        }
      } finally {
        setDeletingFileName(null);
      }
    };

    if (showConfirm) {
      showConfirm('تأكيد حذف نسخة احتياطية سحابية', confirmMsg, doDelete);
    } else if (window.confirm(confirmMsg)) {
      doDelete();
    }
  };

  // 4. حذف أحدث نسخة احتياطية سحابية
  const handleDeleteLatestCloudBackup = () => {
    if (supabaseBackups.length === 0) {
      if (showAlert) showAlert('تنبيـه', 'لا توجد أي نسخ احتياطية محفوظة حالياً في Supabase لحذفها.', 'info');
      return;
    }
    const latestFile = supabaseBackups[0];
    handleDeleteCloudBackup(latestFile);
  };

  // 5. استرجاع مباشر من ملف سحابي في Supabase Storage
  const handleRestoreFromCloud = async (file: SupabaseBackupFile) => {
    setIsRestoring(true);
    setProgressText(`جاري تحميل ملف النسخة الاحتياطية (${file.name}) من Supabase...`);
    setProgressPercent(10);

    try {
      const payload = await fetchSupabaseBackupPayload(file.name);
      if (!payload || !payload.metadata || !payload.collections) {
        throw new Error('تعذر قراءة أو تحميل ملف النسخة الاحتياطية من السحابة.');
      }

      setPendingRestorePayload(payload);
      setConfirmInputText('');
      setShowRestoreModal(true);
    } catch (err: any) {
      console.error(err);
      if (showAlert) {
        showAlert('خطأ في تحميل السحابة ❌', err.message || 'تعذر جلب ملف الباك أب من Supabase.');
      }
    } finally {
      setIsRestoring(false);
      setProgressText('');
      setProgressPercent(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 6. اختيار ملف الباك أب المحلي لقراءته قبل الاسترجاع
  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonContent = JSON.parse(event.target?.result as string);
        if (!jsonContent.metadata || !jsonContent.collections) {
          throw new Error('ملف النسخة الاحتياطية غير صالح أو لا يحتوي على بنية HP Services المعتمدة.');
        }

        setPendingRestorePayload(jsonContent as FullBackupPayload);
        setConfirmInputText('');
        setShowRestoreModal(true);
      } catch (err: any) {
        if (showAlert) {
          showAlert('ملف غير صالح ❌', err.message || 'الملف الذي اخترته ليس ملف JSON بخاصية النسخ الاحتياطي.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 7. تنفيذ الاسترجاع الفعلي بعد التأكيد
  const executeRestore = async () => {
    if (!pendingRestorePayload) return;
    setShowRestoreModal(false);
    setIsRestoring(true);
    setProgressText('بدء عملية الاسترجاع وكتابة البيانات...');
    setProgressPercent(5);

    try {
      const result = await restoreFullDatabaseBackup(pendingRestorePayload, (text, pct) => {
        setProgressText(text);
        setProgressPercent(pct);
      });

      if (!result.success) {
        throw new Error(result.error || 'حدث خطأ غير متوقع أثناء كتابة البيانات.');
      }

      if (showAlert) {
        showAlert(
          'تم الاسترجاع بنجاح! 🎉',
          `تم استرجاع (${result.restoredCount}) مستند ومجموعة بنجاح إلى Firebase بدون أي فقدان في التواريخ أو المعرفات الأصلية.`
        );
      }
    } catch (err: any) {
      console.error(err);
      if (showAlert) {
        showAlert('خطأ في الاسترجاع', err.message || 'فشلت عملية استرجاع النسخة الاحتياطية.');
      }
    } finally {
      setIsRestoring(false);
      setPendingRestorePayload(null);
      setProgressText('');
      setProgressPercent(0);
    }
  };

  const totalCloudStorageBytes = supabaseBackups.reduce((acc, f) => acc + (f.size || 0), 0);

  // IF SECTION IS LOCKED -> RENDER PASSWORD LOCK SCREEN
  if (!isUnlocked) {
    return (
      <div
        style={{
          padding: '60px 20px',
          color: '#F8FAFC',
          maxWidth: '540px',
          margin: '40px auto',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#1E293B',
            borderRadius: '20px',
            padding: '36px 32px',
            border: '1px solid #334155',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}
          >
            <Lock size={32} />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
            قسم مغلق لدواعي الأمان 🔐
          </h2>
          <p style={{ fontSize: '14px', color: '#CBD5E1', lineHeight: '1.6', marginBottom: '28px' }}>
            يرجى إدخال كلمة المرور المخصصة لإدارة النسخ الاحتياطية لفتح التحكم الكامل في قواعد البيانات والسحابة.
          </p>

          <form onSubmit={handleUnlockSection}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showPasswordText ? 'text' : 'password'}
                placeholder="أدخل كلمة المرور الخاصة بالنسخ الاحتياطي"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError('');
                }}
                style={{
                  width: '100%',
                  padding: '14px 44px 14px 16px',
                  borderRadius: '12px',
                  border: passwordError ? '1px solid #EF4444' : '1px solid #475569',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  outline: 'none',
                  textAlign: 'center',
                  fontWeight: 600
                }}
              />
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPasswordText ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {passwordError && (
              <div style={{ color: '#FCA5A5', fontSize: '13px', marginBottom: '16px', fontWeight: 600 }}>
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifyingPassword || !passwordInput.trim()}
              style={{
                width: '100%',
                background: isVerifyingPassword ? '#475569' : '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 20px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: isVerifyingPassword || !passwordInput.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
              }}
            >
              <KeyRound size={18} />
              {isVerifyingPassword ? 'جاري التحقق...' : 'فتح خيارات النسخ الاحتياطي'}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // MAIN UNLOCKED BACKUP DASHBOARD UI
  return (
    <div style={{ padding: '32px 24px', color: '#F8FAFC', maxWidth: '1280px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Sleek Top Banner */}
      <div
        style={{
          background: '#1E293B',
          borderRadius: '16px',
          padding: '24px 28px',
          border: '1px solid #334155',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <Server size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>
              مركز إدارة النسخ الاحتياطية والإنقاذ (Backup & Recovery)
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#CBD5E1', fontSize: '14px' }}>
              إنشاء وحفظ وتنزيل النسخ الاحتياطية لقواعد البيانات سحابياً ومحلياً مع إمكانية الحذف الفوري لأي نسخة غير مكتملة.
            </p>
          </div>
        </div>

        {/* Quick Top Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleExportToSupabase}
            disabled={isExporting || isUploadingCloud || isRestoring}
            style={{
              background: '#2563EB',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: isUploadingCloud ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <UploadCloud size={16} />
            {isUploadingCloud ? 'جاري الرفع...' : 'رفع نسخة إلى Supabase'}
          </button>

          <button
            onClick={handleDeleteLatestCloudBackup}
            disabled={supabaseBackups.length === 0 || deletingFileName !== null}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#FCA5A5',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: supabaseBackups.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Trash2 size={16} />
            حذف أحدث نسخة سحابية
          </button>

          <button
            onClick={handleLockSection}
            style={{
              background: '#334155',
              color: '#F8FAFC',
              border: '1px solid #475569',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Lock size={15} color="#94A3B8" /> قفل القسم
          </button>
        </div>
      </div>

      {/* Dynamic Progress Bar */}
      {(isExporting || isUploadingCloud || isRestoring) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: '#1E293B',
            border: '1px solid #3B82F6',
            borderRadius: '14px',
            padding: '18px 20px',
            marginBottom: '28px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={16} className="animate-spin" color="#3B82F6" />
              {progressText || 'جاري تنفيذ العملية...'}
            </span>
            <span style={{ fontWeight: 800, color: '#3B82F6', fontSize: '14px' }}>{progressPercent}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3 }}
              style={{
                height: '100%',
                background: '#3B82F6',
                borderRadius: '4px'
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        <div style={{ background: '#1E293B', borderRadius: '14px', padding: '20px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#CBD5E1', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
            <span>سجلات البيانات الحية</span>
            <Database size={18} color="#3B82F6" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>
            {liveStats.loading ? 'جاري الفحص...' : `${liveStats.studentsCount} طالب / ${liveStats.requestsCount} طلب`}
          </div>
          <span style={{ fontSize: '12px', color: '#10B981', display: 'block', marginTop: '6px', fontWeight: 600 }}>100% تغطية متزامنة في Firestore</span>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '14px', padding: '20px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#CBD5E1', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
            <span>النسخ السحابية في Supabase</span>
            <Cloud size={18} color="#10B981" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>
            {loadingCloudBackups ? 'جاري التحميل...' : `${supabaseBackups.length} ملفات سحابية`}
          </div>
          <span style={{ fontSize: '12px', color: '#CBD5E1', display: 'block', marginTop: '6px', fontWeight: 600 }}>
            الحجم الإجمالي: {formatFileSize(totalCloudStorageBytes)}
          </span>
        </div>

        <div style={{ background: '#1E293B', borderRadius: '14px', padding: '20px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#CBD5E1', fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
            <span>آخر تصدير في هذه الجلسة</span>
            <CheckCircle2 size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
            {lastBackupInfo ? lastBackupInfo.date : 'لم يتم الآن'}
          </div>
          <span style={{ fontSize: '12px', color: '#CBD5E1', display: 'block', marginTop: '6px', fontWeight: 600 }}>
            {lastBackupInfo ? `${lastBackupInfo.totalDocs} مستند` : 'جاهز للنسخ الآن'}
          </span>
        </div>
      </div>

      {/* Main Operational Options Heading - HIGH CONTRAST CLEAR WHITE */}
      <div style={{ borderRight: '4px solid #3B82F6', paddingRight: '12px', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          خيارات النسخ والاسترجاع المتاحة
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {/* Option 1: Download JSON */}
        <div style={{ background: '#1E293B', borderRadius: '14px', padding: '24px', border: '1px solid #475569', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '10px', borderRadius: '10px', color: '#3B82F6' }}>
                <HardDrive size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>تنزيل نسخة محلياً (JSON)</h3>
                <span style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 600 }}>حفظ مباشر على جهاز الكمبيوتر</span>
              </div>
            </div>
            <p style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              تصدير كافة المجموعات والخدمات والطلاب في ملف JSON مدمج محلياً للاحتفاظ به على جهازك الشخصي.
            </p>
          </div>
          <button
            onClick={handleExportAndDownload}
            disabled={isExporting || isUploadingCloud || isRestoring}
            style={{
              background: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <DownloadCloud size={18} />
            {isExporting ? 'جاري الإنشاء...' : 'تنزيل نسخة احتياطية الان'}
          </button>
        </div>

        {/* Option 2: Upload to Supabase */}
        <div style={{ background: '#1E293B', borderRadius: '14px', padding: '24px', border: '1px solid #475569', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px', color: '#10B981' }}>
                <Cloud size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>رفع سحابي على Supabase</h3>
                <span style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 600 }}>تخزين مباشر في السحابة</span>
              </div>
            </div>
            <p style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              حفظ نسخة احتياطية شاملة مؤرخة داخل Supabase Storage، ويمكنك حذفها في أي وقت إذا كانت غير كاملة.
            </p>
          </div>
          <button
            onClick={handleExportToSupabase}
            disabled={isExporting || isUploadingCloud || isRestoring}
            style={{
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isUploadingCloud ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <UploadCloud size={18} />
            {isUploadingCloud ? 'جاري الرفع...' : 'رفع نسخة سحابية إلى Supabase'}
          </button>
        </div>

        {/* Option 3: Local File Restore */}
        <div style={{ background: '#1E293B', borderRadius: '14px', padding: '24px', border: '1px solid #475569', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '10px', borderRadius: '10px', color: '#EF4444' }}>
                <RotateCcw size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>استرجاع بيانات (Restore)</h3>
                <span style={{ fontSize: '12px', color: '#CBD5E1', fontWeight: 600 }}>استعادة البيانات من ملف محلي</span>
              </div>
            </div>
            <p style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
              اختيار ملف نسخة احتياطية من جهازك لإعادة بناء البيانات في Firebase عند حدوث أي طارئ.
            </p>
          </div>
          <label
            style={{
              background: '#DC2626',
              color: '#FFFFFF',
              borderRadius: '10px',
              padding: '12px 18px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isRestoring ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              textAlign: 'center'
            }}
          >
            <FileJson size={18} />
            {isRestoring ? 'جاري الاسترجاع...' : 'اختر ملف محلي للاسترجاع'}
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelectForRestore}
              disabled={isRestoring || isExporting || isUploadingCloud}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Supabase Storage Backups Management Section */}
      <div style={{ background: '#1E293B', borderRadius: '16px', padding: '24px', border: '1px solid #475569' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cloud size={20} color="#10B981" /> إدارة وحذف النسخ الاحتياطية في Supabase Storage
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#CBD5E1' }}>
              جدول بكافة النسخ المرفوعة على السحابة، يتيح لك حذف أي نسخة غير مكتملة أو استرجاعها مباشرة.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchCloudBackups}
              disabled={loadingCloudBackups}
              style={{
                background: '#334155',
                color: '#FFFFFF',
                border: '1px solid #475569',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: loadingCloudBackups ? 'wait' : 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={loadingCloudBackups ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
        </div>

        {loadingCloudBackups ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#CBD5E1' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block' }} color="#3B82F6" />
            جاري جلب قائمة النسخ السحابية...
          </div>
        ) : supabaseBackups.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 20px',
              background: '#0F172A',
              borderRadius: '12px',
              border: '1px dashed #475569',
              color: '#CBD5E1',
              fontSize: '14px'
            }}
          >
            لا توجد أي نسخ احتياطية محفوظة حالياً في Supabase Storage.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #475569', color: '#CBD5E1', fontSize: '13px', textAlign: 'right' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>اسم الملف في السحابة</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>تاريخ الرفع</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>الحجم</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>التحكم (حذف / استرجاع)</th>
                </tr>
              </thead>
              <tbody>
                {supabaseBackups.map((file) => (
                  <tr
                    key={file.name}
                    style={{
                      borderBottom: '1px solid #334155',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                        <FileJson size={18} color="#10B981" />
                        <span style={{ direction: 'ltr', textAlign: 'left' }}>{file.name}</span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>
                      {new Date(file.created_at).toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td style={{ padding: '14px 16px', color: '#CBD5E1', fontSize: '13px', fontWeight: 600 }}>
                      {formatFileSize(file.size)}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleRestoreFromCloud(file)}
                          disabled={isRestoring || deletingFileName === file.name}
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            color: '#60A5FA',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RotateCcw size={14} /> استرجاع
                        </button>

                        <button
                          onClick={() => handleDeleteCloudBackup(file)}
                          disabled={deletingFileName === file.name}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#FCA5A5',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: deletingFileName === file.name ? 'wait' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Trash2 size={14} />
                          {deletingFileName === file.name ? 'جاري الحذف...' : 'حذف من Supabase'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Restore Security Modal */}
      <AnimatePresence>
        {showRestoreModal && pendingRestorePayload && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: '#1E293B',
                border: '1px solid #EF4444',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '500px',
                width: '100%',
                color: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '14px' }}>
                <AlertTriangle size={26} />
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>تأكيد أمان استرجاع البيانات</h2>
              </div>

              <p style={{ color: '#E2E8F0', fontSize: '14px', lineHeight: '1.6', marginBottom: '14px' }}>
                أنت على وشك استرجاع نسخة احتياطية أنشئت بتاريخ: <br />
                <strong style={{ color: '#60A5FA' }}>{new Date(pendingRestorePayload.metadata.exportedAt).toLocaleString('ar-EG')}</strong> <br />
                وتحتوي على <strong style={{ color: '#34D399' }}>{pendingRestorePayload.metadata.totalDocuments}</strong> مستند وسجل.
              </p>

              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', color: '#FCA5A5' }}>
                ⚠️ سيقوم النظام باستعادة المجموعات والبيانات وضمان دمجها بالمعرفات الأصلية. لتأكيد البدء، يرجى كتابة كلمة <strong>RESTORE</strong> أدناه:
              </div>

              <input
                type="text"
                placeholder="اكتب RESTORE لتأكيد الاسترجاع"
                value={confirmInputText}
                onChange={(e) => setConfirmInputText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0F172A',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  marginBottom: '18px',
                  textAlign: 'center',
                  fontWeight: 700,
                  letterSpacing: '1px'
                }}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRestoreModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#CBD5E1',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  إلغاء
                </button>
                <button
                  onClick={executeRestore}
                  disabled={confirmInputText.trim().toUpperCase() !== 'RESTORE'}
                  style={{
                    background: confirmInputText.trim().toUpperCase() === 'RESTORE' ? '#EF4444' : 'rgba(239, 68, 68, 0.4)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    cursor: confirmInputText.trim().toUpperCase() === 'RESTORE' ? 'pointer' : 'not-allowed',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                >
                  تأكيد وبدء الاسترجاع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBackupTab;
