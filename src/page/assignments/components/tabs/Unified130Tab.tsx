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
  handleRevoke130FolderFromStudents?: (folderPath: string) => void;
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
  handleRevoke130FolderFromStudents,
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
                <h3 className="track-section-title">ملفات خدمة الـ 130 جنيه (ملف موحد للكل)</h3>
                <div className="track-breadcrumbs">
                  <button
                    type="button"
                    className={`breadcrumb-item ${!currentPath ? 'active' : ''}`}
                    onClick={() => setUnified130CurrentPath('')}
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
                          onClick={() => setUnified130CurrentPath(full)}
                        >
                          {part}
                        </button>
                      </React.Fragment>
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
                  className="track-action-btn btn-upload"
                  onClick={() => document.getElementById('upload-input-130')?.click()}
                  disabled={isUploading130}
                >
                  {isUploading130 ? (
                    <>
                      <Loader2 className="spinning-loader-small" size={16} />
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      <span>رفع ملف</span>
                    </>
                  )}
                </button>
                <div className="create-folder-combo">
                  <input
                    type="text"
                    value={newUnified130FolderName}
                    onChange={(e) => setNewUnified130FolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateUnified130Folder();
                    }}
                    placeholder="اسم مجلد جديد..."
                    className="create-folder-input"
                  />
                  <button
                    type="button"
                    className="create-folder-btn"
                    onClick={handleCreateUnified130Folder}
                    title="إنشاء المجلد"
                  >
                    <Folder size={15} />
                    <span>إنشاء مجلد</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="track-action-btn btn-send"
                  disabled={isDistributing130 || (selected130FileIds.size === 0 && visibleFiles.length === 0)}
                  onClick={handle130Distribute}
                >
                  {isDistributing130 ? (
                    <>
                      <Loader2 className="spinning-loader-small" size={16} />
                      <span>جاري التوزيع...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>إرسال لمشتركي الـ 130</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="track-action-btn btn-delete"
                  disabled={isDeleting130 || selected130FileIds.size === 0}
                  onClick={handle130Delete}
                >
                  {isDeleting130 ? (
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
                <button
                  type="button"
                  className="track-action-btn btn-recall"
                  onClick={() => handleOpenRecallModal('unified130')}
                  title="سحب الملفات الموحدة التي تم إرسالها للطلاب"
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
                    لا توجد عناصر داخل هذا المجلد بعد. الملفات المرفوعة هنا ستُرسل لجميع مشتركي خدمة الـ 130 جنيه.
                  </div>
                ) : (() => {
                  const all130SelectableFiles = [
                    ...visibleFiles,
                    ...unified130Files.filter((f: any) => {
                      const fp = String(f.folderPath || '');
                      return visibleFolders.some(
                        (folder) => fp === folder.path || fp.startsWith(`${folder.path}/`)
                      );
                    }),
                  ];
                  const all130SelectableIds = Array.from(
                    new Set(all130SelectableFiles.map((f: any) => f.id))
                  );
                  const isAll130Checked =
                    all130SelectableIds.length > 0 &&
                    all130SelectableIds.every((id) => selected130FileIds.has(id));

                  return (
                    <table className="files-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>
                            <label className="checkbox-label" title="تحديد / إلغاء تحديد الكل">
                              <input
                                type="checkbox"
                                checked={isAll130Checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelected130FileIds((prev) => {
                                      const s = new Set(prev);
                                      all130SelectableIds.forEach((id) => s.add(id));
                                      return s;
                                    });
                                  } else {
                                    setSelected130FileIds((prev) => {
                                      const s = new Set(prev);
                                      all130SelectableIds.forEach((id) => s.delete(id));
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {handleRevoke130FolderFromStudents && (
                                <button
                                  type="button"
                                  className="icon-button revoke"
                                  disabled={!!folderDeleteLoading || isDeleting130}
                                  onClick={() => handleRevoke130FolderFromStudents(folder.path)}
                                  title="سحب محتويات هذا المجلد من الطلاب (مع إبقائه في الداش بورد)"
                                >
                                  <RotateCcw size={16} />
                                </button>
                              )}
                              <button
                                className="icon-button delete"
                                disabled={!!folderDeleteLoading || isDeleting130}
                                onClick={() => handleDeleteUnified130Folder(folder.path)}
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
                );
              })()}
              </div>
            </div>
                </>
              );
            })()}
          </div>
  );
};
