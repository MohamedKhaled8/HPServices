import React from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
} from '../../../../services/firebaseService';
import { getPathParts } from '../../utils/folderUtils';
import {
  Folder,
  Upload,
  Send,
  RotateCcw,
  Trash2,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';

interface TracksManagementTabProps {
  trackView: 'overview' | 'details';
  setTrackView: React.Dispatch<React.SetStateAction<'overview' | 'details'>>;
  openedTrack: TrackKey | null;
  setOpenedTrack: React.Dispatch<React.SetStateAction<TrackKey | null>>;
  setActiveTrackFolder: React.Dispatch<React.SetStateAction<TrackKey>>;
  trackFiles: Record<TrackKey, any[]>;
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  uploadProgress: Record<TrackKey, { current: number; total: number }>;
  isUploadingAssignments: Record<TrackKey, boolean>;
  isDeletingAssignments: Record<TrackKey, boolean>;
  animatingDeleteIds: Record<TrackKey, Set<string>>;
  isDistributingAssignments: boolean;
  trackCurrentPath: Record<TrackKey, string>;
  setTrackCurrentPath: React.Dispatch<React.SetStateAction<Record<TrackKey, string>>>;
  newTrackFolderName: string;
  setNewTrackFolderName: React.Dispatch<React.SetStateAction<string>>;
  setShowTierModal: React.Dispatch<React.SetStateAction<boolean>>;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  getVisibleTrackFiles: (track: TrackKey) => any[];
  getVisibleTrackFolders: (track: TrackKey) => AssignmentFolderMeta[];
  handleCreateTrackFolder: (track: TrackKey) => Promise<void>;
  handleDeleteSelected: (track: TrackKey) => void;
  handleDeleteSingleTrackFile: (track: TrackKey, fileId: string) => void;
  handleDeleteTrackFolder: (track: TrackKey, folderPath: string) => Promise<void>;
  handleRevokeFolderFromStudents?: (track: TrackKey, folderPath: string) => void;
  handleFileUpload: (track: TrackKey, files: File[]) => Promise<void>;
  handleOpenRecallModal: (track: TrackKey | 'unified130') => Promise<void>;
}

export const TracksManagementTab: React.FC<TracksManagementTabProps> = ({
  trackView,
  setTrackView,
  openedTrack,
  setOpenedTrack,
  setActiveTrackFolder,
  trackFiles,
  selectedFileIds,
  setSelectedFileIds,
  uploadProgress,
  isUploadingAssignments,
  isDeletingAssignments,
  animatingDeleteIds,
  isDistributingAssignments,
  trackCurrentPath,
  setTrackCurrentPath,
  newTrackFolderName,
  setNewTrackFolderName,
  setShowTierModal,
  folderDeleteLoading,
  getVisibleTrackFiles,
  getVisibleTrackFolders,
  handleCreateTrackFolder,
  handleDeleteSelected,
  handleDeleteSingleTrackFile,
  handleDeleteTrackFolder,
  handleRevokeFolderFromStudents,
  handleFileUpload,
  handleOpenRecallModal,
}) => {
  return (
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
                {(() => {
                  const visibleFiles = getVisibleTrackFiles(openedTrack);
                  const visibleFolders = getVisibleTrackFolders(openedTrack);
                  const currentPath = trackCurrentPath[openedTrack] || '';

                  // خريطة سريعة لملفات كل مجلد لتفادي التكرار الحسابي O(Folders * Files)
                  const folderFilesMap = new Map<string, any[]>();
                  const currentTrackFiles = trackFiles[openedTrack] || [];
                  for (const folder of visibleFolders) {
                    const fPath = folder.path;
                    const fPathPrefix = `${fPath}/`;
                    const matching = currentTrackFiles.filter((f: any) => {
                      const fp = String(f.folderPath || '');
                      return fp === fPath || fp.startsWith(fPathPrefix);
                    });
                    folderFilesMap.set(folder.path, matching);
                  }

                  const allFilesInVisibleFolders: any[] = [];
                  folderFilesMap.forEach((files) => {
                    for (const f of files) {
                      allFilesInVisibleFolders.push(f);
                    }
                  });

                  // جميع الملفات المتاحة للاختيار (الملفات الظاهرة مباشرة + ملفات المجلدات الظاهرة)
                  const allSelectableFiles = [
                    ...visibleFiles,
                    ...allFilesInVisibleFolders,
                  ];
                  const allSelectableFileIds = Array.from(
                    new Set(allSelectableFiles.map((f: any) => f.id))
                  );
                  const isAllChecked =
                    allSelectableFileIds.length > 0 &&
                    allSelectableFileIds.every((id) => selectedFileIds[openedTrack]?.has(id));

                  return (
                    <>
                <div className="track-files-header">
                  <div className="track-header-main">
                    <div className="track-title-row">
                      <button
                        type="button"
                        className="back-to-tracks-button"
                        onClick={() => {
                          setTrackView('overview');
                          setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: '' }));
                          setOpenedTrack(null);
                        }}
                      >
                        <ArrowRight size={15} />
                        <span>جميع المسارات</span>
                      </button>
                      <h3 className="track-section-title">
                        {openedTrack === 'track1' && 'ملفات المسار الأول'}
                        {openedTrack === 'track2' && 'ملفات المسار الثاني'}
                        {openedTrack === 'track3' && 'ملفات المسار الثالث'}
                      </h3>
                    </div>
                    <div className="track-breadcrumbs">
                      <button
                        type="button"
                        className={`breadcrumb-item ${!currentPath ? 'active' : ''}`}
                        onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: '' }))}
                        disabled={!currentPath}
                      >
                        الجذر
                      </button>
                      {getPathParts(currentPath).map((part, idx, arr) => {
                        const full = arr.slice(0, idx + 1).join('/');
                        const isLast = idx === arr.length - 1;
                        return (
                          <React.Fragment key={full}>
                            <span className="breadcrumb-separator">/</span>
                            <button
                              type="button"
                              className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                              onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: full }))}
                            >
                              {part}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="track-files-actions">
                    {/* زر الرفع المباشر المخفي */}
                    <input
                      type="file"
                      id={`upload-input-${openedTrack}`}
                      style={{ display: 'none' }}
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp,.gif"
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
                      className="track-action-btn btn-upload"
                      onClick={() => document.getElementById(`upload-input-${openedTrack}`)?.click()}
                      disabled={isUploadingAssignments[openedTrack]}
                    >
                      {isUploadingAssignments[openedTrack] ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span>
                            جاري الرفع...
                            {uploadProgress[openedTrack]?.total > 0 && ` (${uploadProgress[openedTrack].current}/${uploadProgress[openedTrack].total})`}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          <span>رفع ملفات</span>
                        </>
                      )}
                    </button>

                    {/* وحدة إنشاء مجلد مدمجة (Input + Button متناسقين) */}
                    <div className="create-folder-combo">
                      <input
                        type="text"
                        value={newTrackFolderName}
                        onChange={(e) => setNewTrackFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateTrackFolder(openedTrack);
                        }}
                        placeholder="اسم مجلد جديد..."
                        className="create-folder-input"
                      />
                      <button
                        type="button"
                        className="create-folder-btn"
                        onClick={() => handleCreateTrackFolder(openedTrack)}
                        title="إنشاء المجلد"
                      >
                        <Folder size={15} />
                        <span>إنشاء مجلد</span>
                      </button>
                    </div>

                    {/* زر الإرسال للطلاب */}
                    <button
                      type="button"
                      className="track-action-btn btn-send"
                      disabled={isDistributingAssignments || (selectedFileIds[openedTrack]?.size === 0 && visibleFiles.length === 0)}
                      onClick={() => setShowTierModal(true)}
                    >
                      {isDistributingAssignments ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span>جاري التوزيع...</span>
                        </>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>إرسال للطلاب</span>
                        </>
                      )}
                    </button>

                    {/* زر مسح المحدد */}
                    <button
                      type="button"
                      className="track-action-btn btn-delete"
                      disabled={
                        isDeletingAssignments[openedTrack] ||
                        !selectedFileIds[openedTrack] ||
                        selectedFileIds[openedTrack].size === 0
                      }
                      onClick={() => handleDeleteSelected(openedTrack)}
                    >
                      {isDeletingAssignments[openedTrack] ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span>جاري المسح...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={15} />
                          <span>مسح المحدد</span>
                        </>
                      )}
                    </button>

                    {/* زر سحب الملفات */}
                    <button
                      type="button"
                      className="track-action-btn btn-recall"
                      onClick={() => handleOpenRecallModal(openedTrack)}
                      title="سحب الملفات والمجلدات التي تم إرسالها للطلاب في هذا المسار"
                    >
                      <RotateCcw size={15} />
                      <span>سحب الملفات</span>
                    </button>
                  </div>
                </div>

                <div className="track-files-body">
                  <div className="files-table-wrapper">
                    {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
                      <div className="no-items-message">
                        لا توجد عناصر داخل هذا المجلد بعد
                      </div>
                    ) : (
                      <table className="files-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>
                              <label className="checkbox-label" title="تحديد / إلغاء تحديد الكل">
                                <input
                                  type="checkbox"
                                  checked={isAllChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFileIds((prev) => {
                                        const allIds = new Set(prev[openedTrack] || []);
                                        allSelectableFileIds.forEach((id) => allIds.add(id));
                                        return { ...prev, [openedTrack]: allIds };
                                      });
                                    } else {
                                      setSelectedFileIds((prev) => {
                                        const allIds = new Set(prev[openedTrack] || []);
                                        allSelectableFileIds.forEach((id) => allIds.delete(id));
                                        return { ...prev, [openedTrack]: allIds };
                                      });
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
                          {visibleFolders.map((folder) => {
                            const filesInFolder = folderFilesMap.get(folder.path) || [];
                            const isFolderChecked = filesInFolder.length > 0 && filesInFolder.every((f: any) => selectedFileIds[openedTrack]?.has(f.id));

                            const deletingThis =
                              !!folderDeleteLoading &&
                              folderDeleteLoading.scope === 'track' &&
                              folderDeleteLoading.track === openedTrack &&
                              folderDeleteLoading.folderPath === folder.path;
                            return (
                            <tr key={`folder-${folder.id}`}>
                              <td>
                                <label className="checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={isFolderChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedFileIds(prev => {
                                          const allIds = new Set(prev[openedTrack] || []);
                                          filesInFolder.forEach((f: any) => allIds.add(f.id));
                                          return { ...prev, [openedTrack]: allIds };
                                        });
                                      } else {
                                        setSelectedFileIds(prev => {
                                          const allIds = new Set(prev[openedTrack] || []);
                                          filesInFolder.forEach((f: any) => allIds.delete(f.id));
                                          return { ...prev, [openedTrack]: allIds };
                                        });
                                      }
                                    }}
                                  />
                                  <span className="checkbox-custom" />
                                </label>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  disabled={!!folderDeleteLoading || isDeletingAssignments[openedTrack]}
                                  onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: folder.path }))}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
                                >
                                  📁 {folder.name}
                                </button>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {handleRevokeFolderFromStudents && (
                                    <button
                                      type="button"
                                      className="icon-button revoke"
                                      disabled={!!folderDeleteLoading || isDeletingAssignments[openedTrack]}
                                      onClick={() => handleRevokeFolderFromStudents(openedTrack, folder.path)}
                                      title="سحب محتويات هذا المجلد من الطلاب (مع إبقائه في الداش بورد)"
                                    >
                                      <RotateCcw size={16} />
                                    </button>
                                  )}
                                  <button
                                    className="icon-button delete"
                                    disabled={!!folderDeleteLoading || isDeletingAssignments[openedTrack]}
                                    onClick={() => handleDeleteTrackFolder(openedTrack, folder.path)}
                                    title="حذف المجلد نهائياً"
                                  >
                                    {deletingThis ? (
                                      <Loader2 size={16} className="spinning-loader-small" />
                                    ) : (
                                      <X size={16} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                          {visibleFiles.map((file: any) => {
                            const isSelected = selectedFileIds[openedTrack]?.has(file.id);
                            const isAnimatingDelete = animatingDeleteIds[openedTrack]?.has(file.id);
                            return (
                              <tr key={file.id} className={`${isSelected ? 'selected-row' : ''} ${isAnimatingDelete ? 'deleting-row' : ''}`}>
                                <td>
                                  <label className="checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={isSelected || false}
                                      disabled={isDeletingAssignments[openedTrack]}
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
                                    disabled={isDeletingAssignments[openedTrack]}
                                    onClick={() => handleDeleteSingleTrackFile(openedTrack, file.id)}
                                    title="حذف الملف"
                                  >
                                    {animatingDeleteIds[openedTrack]?.has(file.id) ? (
                                      <Loader2 size={16} className="spinning-loader-small" />
                                    ) : (
                                      <X size={16} />
                                    )}
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
                    </>
                  );
                })()}
              </div>
            )}
          </div>
  );
};
