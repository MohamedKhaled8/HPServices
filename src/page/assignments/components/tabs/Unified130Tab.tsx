import React from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
} from '../../../../services/firebaseService';
import { getPathParts } from '../../utils/folderUtils';
import { DeleteConfirmModalState } from '../../types/assignments.types';
import {
  Folder,
  Upload,
  Send,
  RotateCcw,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';

interface Unified130TabProps {
  unified130Files: any[];
  unified130CurrentPath: string;
  setUnified130CurrentPath: React.Dispatch<React.SetStateAction<string>>;
  newUnified130FolderName: string;
  setNewUnified130FolderName: React.Dispatch<React.SetStateAction<string>>;
  isUploading130: boolean;
  isDistributing130: boolean;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isDeleting130: boolean;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  getVisibleUnified130Files: () => any[];
  getVisibleUnified130Folders: () => AssignmentFolderMeta[];
  handle130Delete: () => void;
  handle130Distribute: () => Promise<void>;
  handle130FileUpload: (file: File) => Promise<void>;
  handleCreateUnified130Folder: () => Promise<void>;
  handleDeleteUnified130Folder: (folderPath: string) => Promise<void>;
  handleOpenRecallModal: (track: TrackKey | 'unified130') => Promise<void>;
}

export const Unified130Tab: React.FC<Unified130TabProps> = ({
  unified130Files,
  unified130CurrentPath,
  setUnified130CurrentPath,
  newUnified130FolderName,
  setNewUnified130FolderName,
  isUploading130,
  isDistributing130,
  selected130FileIds,
  setSelected130FileIds,
  isDeleting130,
  setDeleteConfirmModal,
  folderDeleteLoading,
  getVisibleUnified130Files,
  getVisibleUnified130Folders,
  handle130Delete,
  handle130Distribute,
  handle130FileUpload,
  handleCreateUnified130Folder,
  handleDeleteUnified130Folder,
  handleOpenRecallModal,
}) => {
  return (
          <div className="track-files-panel">
            {(() => {
              const visibleFiles = getVisibleUnified130Files();
              const visibleFolders = getVisibleUnified130Folders();
              const currentPath = unified130CurrentPath || '';
              return (
                <>
            <div className="track-files-header">
              <div className="track-header-main">
                <h3>ملفات خدمة الـ 130 جنيه (ملف موحد للكل)</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="back-to-tracks-button"
                    onClick={() => setUnified130CurrentPath('')}
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
                        onClick={() => setUnified130CurrentPath(full)}
                      >
                        {part}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="track-files-actions">
                <input
                  type="file"
                  id="upload-input-130"
                  style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp,.gif"
                  disabled={isUploading130}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handle130FileUpload(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  className="add-costs-button"
                  onClick={() => document.getElementById('upload-input-130')?.click()}
                  disabled={isUploading130}
                >
                  {isUploading130 ? (
                    <><Loader2 className="spinning-loader-small" size={16} /> جاري الرفع...</>
                  ) : (
                    <><Upload size={16} /> رفع ملف</>
                  )}
                </button>
                <input
                  type="text"
                  value={newUnified130FolderName}
                  onChange={(e) => setNewUnified130FolderName(e.target.value)}
                  placeholder="اسم مجلد جديد"
                  style={{ minWidth: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <button
                  type="button"
                  className="add-costs-button"
                  onClick={handleCreateUnified130Folder}
                >
                  <Folder size={16} />
                  إنشاء مجلد
                </button>
                <button
                  type="button"
                  className="send-button"
                  disabled={isDistributing130 || (selected130FileIds.size === 0 && visibleFiles.length === 0)}
                  onClick={handle130Distribute}
                >
                  {isDistributing130 ? (
                    <><Loader2 className="spinning-loader-small" size={16} /> جاري التوزيع...</>
                  ) : (
                    <><Send size={16} /> إرسال لمشتركي الـ 130</>
                  )}
                </button>
                <button
                  type="button"
                  className="delete-button"
                  disabled={isDeleting130 || selected130FileIds.size === 0}
                  onClick={handle130Delete}
                >
                  {isDeleting130 ? (
                    <><Loader2 className="spinning-loader-small" size={16} /> جاري المسح...</>
                  ) : (
                    <><Trash2 size={16} /> مسح المحدد</>
                  )}
                </button>
                <button
                  type="button"
                  className="revoke-button"
                  onClick={() => handleOpenRecallModal('unified130')}
                  title="سحب الملفات الموحدة التي تم إرسالها للطلاب"
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
                    لا توجد عناصر داخل هذا المجلد بعد. الملفات المرفوعة هنا ستُرسل لجميع مشتركي خدمة الـ 130 جنيه.
                  </div>
                ) : (
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={visibleFiles.length > 0 && visibleFiles.every((f: any) => selected130FileIds.has(f.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelected130FileIds(prev => {
                                    const s = new Set(prev);
                                    visibleFiles.forEach((f: any) => s.add(f.id));
                                    return s;
                                  });
                                } else {
                                  setSelected130FileIds(prev => {
                                    const s = new Set(prev);
                                    visibleFiles.forEach((f: any) => s.delete(f.id));
                                    return s;
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
                        const filesInFolder = unified130Files.filter((f: any) => {
                          const fp = String(f.folderPath || '');
                          return fp === folder.path || fp.startsWith(`${folder.path}/`);
                        });
                        const isFolderChecked = filesInFolder.length > 0 && filesInFolder.every((f: any) => selected130FileIds.has(f.id));

                        const deletingThis =
                          !!folderDeleteLoading &&
                          folderDeleteLoading.scope === 'unified130' &&
                          folderDeleteLoading.folderPath === folder.path;
                        return (
                        <tr key={`folder-130-${folder.id}`}>
                          <td>
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={isFolderChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelected130FileIds(prev => {
                                      const s = new Set(prev);
                                      filesInFolder.forEach((f: any) => s.add(f.id));
                                      return s;
                                    });
                                  } else {
                                    setSelected130FileIds(prev => {
                                      const s = new Set(prev);
                                      filesInFolder.forEach((f: any) => s.delete(f.id));
                                      return s;
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
                              disabled={!!folderDeleteLoading || isDeleting130}
                              onClick={() => setUnified130CurrentPath(folder.path)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
                            >
                              📁 {folder.name}
                            </button>
                          </td>
                          <td>
                            <button
                              className="icon-button delete"
                              disabled={!!folderDeleteLoading || isDeleting130}
                              onClick={() => handleDeleteUnified130Folder(folder.path)}
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
                        const isSelected = selected130FileIds.has(file.id);
                        return (
                          <tr key={file.id} className={isSelected ? 'selected-row' : ''}>
                            <td>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelected130FileIds(prev => {
                                      const s = new Set(prev);
                                      if (s.has(file.id)) s.delete(file.id);
                                      else s.add(file.id);
                                      return s;
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
                                <a href={file.url} target="_blank" rel="noreferrer" className="file-link-simple">{file.name}</a>
                              </div>
                            </td>
                            <td>
                              <button
                                className="icon-button delete"
                                onClick={() => {
                                  setDeleteConfirmModal({ open: true, fileIds: [file.id], source: 'unified130' });
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
                </>
              );
            })()}
          </div>
  );
};
