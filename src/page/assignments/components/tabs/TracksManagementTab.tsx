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
                  return (
                    <>
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="back-to-tracks-button"
                        onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: '' }))}
                        disabled={!currentPath}
                      >
                        الجذر
                      </button>
                      {getPathParts(currentPath).map((part, idx, arr) => {
                        const full = arr.slice(0, idx + 1).join('/');
                        return (
                          <button
                            key={full}
                            type="button"
                            className="back-to-tracks-button"
                            onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: full }))}
                          >
                            {part}
                          </button>
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
                    <input
                      type="text"
                      value={newTrackFolderName}
                      onChange={(e) => setNewTrackFolderName(e.target.value)}
                      placeholder="اسم مجلد جديد"
                      style={{ minWidth: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      className="add-costs-button"
                      onClick={() => handleCreateTrackFolder(openedTrack)}
                    >
                      <Folder size={16} />
                      إنشاء مجلد
                    </button>

                    <button
                      type="button"
                      className="send-button"
                      disabled={isDistributingAssignments || (selectedFileIds[openedTrack]?.size === 0 && visibleFiles.length === 0)}
                      onClick={() => setShowTierModal(true)}
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
                        isDeletingAssignments[openedTrack] ||
                        !selectedFileIds[openedTrack] ||
                        selectedFileIds[openedTrack].size === 0
                      }
                      onClick={() => handleDeleteSelected(openedTrack)}
                    >
                      {isDeletingAssignments[openedTrack] ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span className="uploading-text">جاري المسح...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          مسح المحدد
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="revoke-button"
                      onClick={() => handleOpenRecallModal(openedTrack)}
                      title="سحب الملفات التي تم إرسالها للطلاب في هذا المسار"
                    >
                      <RotateCcw size={16} />
                      سحب الملفات
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
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={
                                    visibleFiles.length > 0 &&
                                    visibleFiles.every((f: any) => selectedFileIds[openedTrack]?.has(f.id))
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const allIds = new Set(selectedFileIds[openedTrack] || []);
                                      visibleFiles.forEach((f: any) => allIds.add(f.id));
                                      setSelectedFileIds(prev => ({ ...prev, [openedTrack]: allIds }));
                                    } else {
                                      const allIds = new Set(selectedFileIds[openedTrack] || []);
                                      visibleFiles.forEach((f: any) => allIds.delete(f.id));
                                      setSelectedFileIds(prev => ({ ...prev, [openedTrack]: allIds }));
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
                            const filesInFolder = (trackFiles[openedTrack] || []).filter((f: any) => {
                              const fp = String(f.folderPath || '');
                              return fp === folder.path || fp.startsWith(`${folder.path}/`);
                            });
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
                                <button
                                  className="icon-button delete"
                                  disabled={!!folderDeleteLoading || isDeletingAssignments[openedTrack]}
                                  onClick={() => handleDeleteTrackFolder(openedTrack, folder.path)}
                                  title="حذف المجلد"
                                >
                                  {deletingThis ? (
                                    <Loader2 size={16} className="spinning-loader-small" />
                                  ) : (
                                    <X size={16} />
                                  )}
                                </button>
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
