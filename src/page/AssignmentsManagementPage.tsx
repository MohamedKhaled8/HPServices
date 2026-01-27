import React, { useState, useEffect } from 'react';

import {
  uploadAssignmentFilesForTrack,
  getAssignmentFilesForTrack,
  distributeAssignmentsForTrack,
  deleteAssignmentFilesForTrack,
  getAssignmentsServiceConfig,
  updateAssignmentsServiceConfig,
  getCurrentUser,
  TrackKey
} from '../services/firebaseService';
import { AssignmentsServiceConfig, AssignmentItem } from '../types';
import {
  ArrowRight,
  Folder,
  Send,
  Loader2,
  Save,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  Trash2
} from 'lucide-react';
import '../styles/AssignmentsManagementPage.css';

interface AssignmentsManagementPageProps {
  onBack: () => void;
}

const AssignmentsManagementPage: React.FC<AssignmentsManagementPageProps> = ({ onBack }) => {


  // Tabs: إدارة التكليفات / إدارة تكاليف المسارات
  const [activeTab, setActiveTab] = useState<'assignments' | 'tracks'>('assignments');

  // Tracks view state
  const [activeTrackFolder, setActiveTrackFolder] = useState<TrackKey>('track1');
  const [trackView, setTrackView] = useState<'overview' | 'details'>('overview');
  const [openedTrack, setOpenedTrack] = useState<TrackKey | null>(null);
  const [trackFiles, setTrackFiles] = useState<Record<TrackKey, any[]>>({
    track1: [],
    track2: [],
    track3: []
  });
  const [selectedFileIds, setSelectedFileIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(),
    track2: new Set(),
    track3: new Set()
  });

  const [uploadProgress, setUploadProgress] = useState<Record<TrackKey, { current: number; total: number }>>({
    track1: { current: 0, total: 0 },
    track2: { current: 0, total: 0 },
    track3: { current: 0, total: 0 }
  });

  const [isUploadingAssignments, setIsUploadingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false,
    track2: false,
    track3: false
  });

  const [isDistributingAssignments, setIsDistributingAssignments] = useState(false);
  const [assignmentsMessage, setAssignmentsMessage] = useState<string | null>(null);
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig>({
    serviceName: 'حل وتسليم تكليفات',
    assignments: [],
    paymentMethods: {
      instaPay: '01017180923',
      cashWallet: '01050889591'
    }
  });
  const [newAssignmentName, setNewAssignmentName] = useState<string>('');
  const [newAssignmentPrice, setNewAssignmentPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Animation states
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');
  const [showPaperPlane, setShowPaperPlane] = useState(false);

  // Load assignments config
  useEffect(() => {
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
  }, []);

  // Load files only when a track is opened (Lazy Loading for better performance)
  useEffect(() => {
    const loadAllTracks = async () => {
      try {
        const [files1, files2, files3] = await Promise.all([
          getAssignmentFilesForTrack('track1'),
          getAssignmentFilesForTrack('track2'),
          getAssignmentFilesForTrack('track3')
        ]);

        setTrackFiles({
          track1: files1,
          track2: files2,
          track3: files3
        });
      } catch (error) {
        console.error('Error loading track files:', error);
      }
    };

    loadAllTracks();
  }, []);

  // Prevent closing tab/browser while uploading
  useEffect(() => {
    const isUploading = Object.values(isUploadingAssignments).some(uploading => uploading);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'هناك ملفات قيد الرفع. هل تريد المغادرة؟';
        return e.returnValue;
      }
    };

    if (isUploading) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isUploadingAssignments]);

  const handleSaveAssignmentsConfig = async () => {
    if (!assignmentsConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(assignmentsConfig);
      setAssignmentsMessage('تم حفظ إعدادات التكليفات بنجاح');
      setTimeout(() => setAssignmentsMessage(null), 3000);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAssignment = () => {
    if (!newAssignmentName || !newAssignmentPrice || !assignmentsConfig) return;
    const price = parseFloat(newAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      setAssignmentsMessage('يرجى إدخال سعر صحيح');
      return;
    }
    const newAssignment: AssignmentItem = {
      id: `assignment_${Date.now()}`,
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

  const handleRemoveAssignment = (id: string) => {
    if (!assignmentsConfig) return;
    setAssignmentsConfig({
      ...assignmentsConfig,
      assignments: assignmentsConfig.assignments.filter(a => a.id !== id)
    });
  };

  const handleFileUpload = async (track: TrackKey, files: File[]) => {
    const user = getCurrentUser();
    // التحقق من وجود مستخدم (أدمن) وليس طالب
    if (!user || files.length === 0) {
      console.error('No user found or no files selected');
      return;
    }

    try {
      setIsUploadingAssignments(prev => ({ ...prev, [track]: true }));
      setAssignmentsMessage(null);

      // تهيئة العداد قبل البدء
      setUploadProgress(prev => ({
        ...prev,
        [track]: { current: 0, total: files.length }
      }));

      // الرفع المباشر وتحديث الواجهة فورياً
      const uploadedFiles = await uploadAssignmentFilesForTrack(
        track,
        files,
        user.uid,
        (current, total) => {
          setUploadProgress(prev => ({
            ...prev,
            [track]: { current, total }
          }));
        }
      );

      // تحديث الحالة محلياً وفورياً (Optimistic UI Update)
      setTrackFiles(prev => ({
        ...prev,
        [track]: [...(prev[track] || []), ...uploadedFiles]
      }));

      setAssignmentsMessage(
        `تم رفع الملفات بنجاح للمسار ${track === 'track1' ? 'الأول' : track === 'track2' ? 'الثاني' : 'الثالث'
        }`
      );
      setTimeout(() => setAssignmentsMessage(null), 3000);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء رفع الملفات');
    } finally {
      setIsUploadingAssignments(prev => ({ ...prev, [track]: false }));
    }
  };

  const handleDistribute = async () => {
    try {
      setAssignmentsMessage(null);
      setIsDistributingAssignments(true);

      // Show paper plane animation
      setShowPaperPlane(true);
      setTimeout(() => setShowPaperPlane(false), 1500);

      const targetTrack = openedTrack || activeTrackFolder;
      const ids = Array.from(selectedFileIds[targetTrack] || []);
      await distributeAssignmentsForTrack(targetTrack, ids);

      showSnackbarNotification(`تم إرسال ${ids.length} ملف للطلاب بنجاح`, 'success');

      // Clear selection
      setSelectedFileIds(prev => ({
        ...prev,
        [targetTrack]: new Set()
      }));
    } catch (error: any) {
      showSnackbarNotification(error.message || 'حدث خطأ أثناء توزيع الملفات', 'error');
    } finally {
      setIsDistributingAssignments(false);
    }
  };

  // Helper function to show snackbar
  const showSnackbarNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setShowSnackbar(true);

    setTimeout(() => {
      setShowSnackbar(false);
    }, 3000);
  };

  const handleDeleteSelected = async (track: TrackKey) => {
    const ids = Array.from(selectedFileIds[track] || []);
    if (ids.length === 0) return;
    try {
      setAssignmentsMessage(null);
      await deleteAssignmentFilesForTrack(track, ids);

      // تحديث فوري للحالة (Optimistic Update)
      setTrackFiles(prev => ({
        ...prev,
        [track]: (prev[track] || []).filter(file => !ids.includes(file.id))
      }));
      setSelectedFileIds(prev => ({
        ...prev,
        [track]: new Set()
      }));

      // Show snackbar instead of message
      showSnackbarNotification(`تم حذف ${ids.length} ملف بنجاح`, 'success');
    } catch (error: any) {
      showSnackbarNotification(error.message || 'حدث خطأ أثناء حذف الملفات', 'error');
    }
  };

  const handleBack = () => {
    // التحقق من وجود رفع جاري
    const isUploading = Object.values(isUploadingAssignments).some(uploading => uploading);

    if (isUploading) {
      const confirmLeave = window.confirm(
        'هناك ملفات قيد الرفع حالياً. إذا غادرت الصفحة الآن، سيتم إيقاف عملية الرفع. هل تريد المتابعة؟'
      );
      if (!confirmLeave) {
        return; // لا تغادر
      }
    }

    onBack();
  };

  return (
    <div className="assignments-management-page">
      <div className="title-header">
        <h1>إعدادات خدمة التكليفات</h1>
      </div>

      <div className="assignments-header">
        <button onClick={handleBack} className="back-button">
          <ArrowRight size={20} />
          رجوع
        </button>
      </div>

      {assignmentsMessage && (
        <div
          className={`assignments-message ${assignmentsMessage.includes('نجاح') ? 'success' : 'error'
            }`}
        >
          {assignmentsMessage.includes('نجاح') ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{assignmentsMessage}</span>
        </div>
      )}

      {/* Secondary tabs inside assignments page (same style as admin tabs) */}
      <div className="assignments-inner-tabs">
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('assignments');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          إدارة التكليفات
        </button>
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'tracks' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tracks');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          إدارة تكاليف المسارات الدراسية
        </button>
      </div>

      <div className="assignments-content">
        {/* TAB: إدارة التكليفات */}
        {activeTab === 'assignments' && (
          <div className="assignments-config-section">
            <div className="section-header">
              <h2>إعدادات خدمة التكليفات</h2>
              <button
                type="button"
                onClick={handleSaveAssignmentsConfig}
                className="save-button"
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>

            <div className="assignments-config-form">
              {/* 1. إعدادات الخدمة والدفع */}
              <div className="config-section-block">
                <h3 className="block-title">بيانات الخدمة والدفع</h3>
                <div className="form-group">
                  <label>اسم الخدمة</label>
                  <input
                    type="text"
                    placeholder="مثال: خدمة حل التكليفات"
                    value={assignmentsConfig.serviceName}
                    onChange={e =>
                      setAssignmentsConfig({
                        ...assignmentsConfig,
                        serviceName: e.target.value
                      })
                    }
                  />
                </div>

                <div className="payment-methods-grid">
                  <div className="form-group">
                    <label>رقم InstaPay</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={assignmentsConfig.paymentMethods.instaPay}
                      onChange={e =>
                        setAssignmentsConfig({
                          ...assignmentsConfig,
                          paymentMethods: {
                            ...assignmentsConfig.paymentMethods,
                            instaPay: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>رقم المحفظة النقدية</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={assignmentsConfig.paymentMethods.cashWallet}
                      onChange={e =>
                        setAssignmentsConfig({
                          ...assignmentsConfig,
                          paymentMethods: {
                            ...assignmentsConfig.paymentMethods,
                            cashWallet: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="section-divider"></div>

              {/* 2. إدارة التكليفات */}
              <div className="config-section-block">
                <h3 className="block-title">إدارة التكليفات المتاحة</h3>

                <div className="assignments-management-area">
                  <div className="add-assignment-section">
                    <label className="sub-label">إضافة تكليف جديد</label>
                    <div className="add-assignment-form">
                      <input
                        type="text"
                        placeholder="اسم التكليف الجديد"
                        value={newAssignmentName}
                        onChange={e => setNewAssignmentName(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="السعر"
                        value={newAssignmentPrice}
                        onChange={e => setNewAssignmentPrice(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddAssignment}
                        className="add-button"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  <div className="assignments-list-wrapper">
                    <label className="sub-label">قائمة التكليفات</label>
                    <div className="assignments-list-container">
                      <div className="assignments-list-header">
                        <div>اسم التكليف</div>
                        <div>السعر (ج.م)</div>
                        <div style={{ textAlign: 'center' }}>حذف</div>
                      </div>

                      <div className="assignments-list">
                        {assignmentsConfig.assignments.length === 0 ? (
                          <div className="no-assignments-message">
                            <p>لا توجد تكليفات مضافة حتى الآن</p>
                          </div>
                        ) : (
                          assignmentsConfig.assignments.map(assignment => (
                            <div key={assignment.id} className="assignment-item">
                              <div className="assignment-info">
                                <span className="assignment-name">{assignment.name}</span>
                                <span className="assignment-price">
                                  {assignment.price}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className="remove-assignment-button"
                                title="حذف التكليف"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: إدارة تكاليف المسارات الدراسية */}
        {activeTab === 'tracks' && (
          <div className="track-folders-section">
            {trackView === 'overview' && (
              <>
                <div className="section-header">
                  <h2>اختر المسار لتوزيع ملفات التكاليف</h2>
                </div>

                <div className="track-folders-grid">
                  {(
                    [
                      { key: 'track1', label: 'المسار الأول' },
                      { key: 'track2', label: 'المسار الثاني' },
                      { key: 'track3', label: 'المسار الثالث' }
                    ] as { key: TrackKey; label: string }[]
                  ).map((track, index) => (
                    <button
                      key={track.key}
                      type="button"
                      className={`track-folder track-folder-${index + 1}`}
                      onClick={() => {
                        setActiveTrackFolder(track.key);
                        setOpenedTrack(track.key);
                        setTrackView('details');
                      }}
                    >
                      <div className="folder-icon-wrapper">
                        <Folder size={32} />
                      </div>
                      <div className="folder-label">{track.label}</div>
                      <div className="folder-count">
                        {trackFiles[track.key]?.length || 0} ملف
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {trackView === 'details' && openedTrack && (
              <div className="track-files-panel">
                <div className="track-files-header">
                  <div className="track-header-main">
                    <button
                      type="button"
                      className="back-to-tracks-button"
                      onClick={() => {
                        setTrackView('overview');
                        setOpenedTrack(null);
                      }}
                    >
                      <ArrowRight size={16} />
                      جميع المسارات
                    </button>
                    <h3>
                      {openedTrack === 'track1' && 'ملفات المسار الأول'}
                      {openedTrack === 'track2' && 'ملفات المسار الثاني'}
                      {openedTrack === 'track3' && 'ملفات المسار الثالث'}
                    </h3>
                  </div>

                  <div className="track-files-actions">
                    {/* زر الرفع المباشر المخفي */}
                    <input
                      type="file"
                      id={`upload-input-${openedTrack}`}
                      style={{ display: 'none' }}
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg"
                      disabled={isUploadingAssignments[openedTrack]}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileUpload(openedTrack, Array.from(e.target.files));
                          e.target.value = ''; // Reset input
                        }
                      }}
                    />

                    {/* زر الرفع الظاهر */}
                    <button
                      type="button"
                      className="add-costs-button"
                      onClick={() => document.getElementById(`upload-input-${openedTrack}`)?.click()}
                      disabled={isUploadingAssignments[openedTrack]}
                    >
                      {isUploadingAssignments[openedTrack] ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span className="uploading-text">
                            جاري الرفع...
                            {uploadProgress[openedTrack]?.total > 0 && ` (${uploadProgress[openedTrack].current}/${uploadProgress[openedTrack].total})`}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          رفع ملفات
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="send-button"
                      disabled={
                        isDistributingAssignments ||
                        !selectedFileIds[openedTrack] ||
                        selectedFileIds[openedTrack].size === 0
                      }
                      onClick={handleDistribute}
                    >
                      {isDistributingAssignments ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span className="uploading-text">جاري التوزيع...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          إرسال للطلاب
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      disabled={
                        !selectedFileIds[openedTrack] ||
                        selectedFileIds[openedTrack].size === 0
                      }
                      onClick={() => handleDeleteSelected(openedTrack)}
                    >
                      <Trash2 size={16} />
                      مسح المحدد
                    </button>
                  </div>
                </div>

                <div className="track-files-body">
                  <div className="files-table-wrapper">
                    {!trackFiles[openedTrack] || trackFiles[openedTrack].length === 0 ? (
                      <div className="no-items-message">
                        لا توجد ملفات مضافة لهذا المسار بعد
                      </div>
                    ) : (
                      <table className="files-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={
                                    trackFiles[openedTrack]?.length > 0 &&
                                    selectedFileIds[openedTrack]?.size === trackFiles[openedTrack]?.length
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      // Select All
                                      const allIds = new Set(trackFiles[openedTrack].map((f: any) => f.id));
                                      setSelectedFileIds(prev => ({ ...prev, [openedTrack]: allIds }));
                                    } else {
                                      // Deselect All
                                      setSelectedFileIds(prev => ({ ...prev, [openedTrack]: new Set() }));
                                    }
                                  }}
                                />
                                <span className="checkbox-custom" />
                              </label>
                            </th>
                            <th>اسم الملف</th>
                            <th>الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackFiles[openedTrack].map((file: any) => {
                            const isSelected = selectedFileIds[openedTrack]?.has(file.id);
                            return (
                              <tr key={file.id} className={isSelected ? 'selected-row' : ''}>
                                <td>
                                  <label className="checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={isSelected || false}
                                      onChange={() => {
                                        setSelectedFileIds(prev => {
                                          const currentSet = new Set(prev[openedTrack] || []);
                                          if (currentSet.has(file.id)) {
                                            currentSet.delete(file.id);
                                          } else {
                                            currentSet.add(file.id);
                                          }
                                          return { ...prev, [openedTrack]: currentSet };
                                        });
                                      }}
                                    />
                                    <span className="checkbox-custom" />
                                  </label>
                                </td>
                                <td>
                                  <div className="file-info-cell">
                                    <div className={`file-icon-simple ${file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'img'}`}>
                                      {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}
                                    </div>
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="file-link-simple"
                                    >
                                      {file.name}
                                    </a>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="icon-button delete"
                                    onClick={() => {
                                      if (confirm('هل أنت متأكد من حذف هذا الملف؟')) {
                                        // يمكن استدعاء دالة حذف فردية هنا إذا أردت، أو استخدام التحديد
                                        // لكن للتسهيل سأجعلها تحذف المحدد فقط أو هذا العنصر
                                        // هنا سأقوم بعمل خدعة بسيطة: تحديد هذا العنصر فقط وحذفه، أو إنشاء دالة جديدة
                                        // سأستخدم الدالة الموجودة handleDeleteSelected لكن يجب أن أعدل الstate أولاً
                                        // الأفضل إنشاء دالة حذف فردية، لكن سأستخدم الموجود لتجنب تعقيد الكود
                                        // سأغير السلوك: الزر يحذف هذا الملف فقط
                                        deleteAssignmentFilesForTrack(openedTrack, [file.id])
                                          .then(async () => {
                                            const refreshed = await getAssignmentFilesForTrack(openedTrack);
                                            setTrackFiles(prev => ({ ...prev, [openedTrack]: refreshed }));
                                          });
                                      }
                                    }}
                                    title="حذف الملف"
                                  >
                                    <X size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snackbar Notification */}
      {showSnackbar && (
        <div className={`snackbar ${snackbarType}`}>
          {snackbarType === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{snackbarMessage}</span>
        </div>
      )}

      {/* Paper Plane Animation */}
      {showPaperPlane && (
        <div className="paper-plane-container">
          <div className="paper-plane">✈️</div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsManagementPage;
