import React, { useRef, useState } from 'react';
import { Image, Upload } from 'lucide-react';
import type { HeroBackgroundImage } from '../../utils/backgroundImages';
import { validateBackgroundImageFile } from '../../utils/backgroundImages';
import {
  deleteHeroBackgroundImage,
  uploadHeroBackgroundImages
} from '../../services/backgroundImageService';
import { logger } from '../../utils/logger';
import { LoadingState } from '../common/LoadingState';
import { AdminBackgroundImageCard } from './AdminBackgroundImageCard';

interface AdminBackgroundImagesTabProps {
  images: HeroBackgroundImage[];
  isAdmin: boolean;
  showAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AdminBackgroundImagesTab: React.FC<AdminBackgroundImagesTabProps> = ({
  images,
  isAdmin,
  showAlert,
  showConfirm
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleUpload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const invalid = files
      .map((file) => ({ file, error: validateBackgroundImageFile(file) }))
      .filter((item) => item.error);

    if (invalid.length > 0) {
      showAlert('ملف غير صالح', invalid.map((item) => `${item.file.name}: ${item.error}`).join('\n'), 'warning');
      return;
    }

    setUploading(true);
    setUploadingCount(files.length);
    try {
      await uploadHeroBackgroundImages(isAdmin, files, images);
      showAlert('نجاح', files.length === 1 ? 'تم رفع الصورة وأصبحت متاحة في واجهة المستخدم' : `تم رفع ${files.length} صور وأصبحت متاحة في واجهة المستخدم`, 'success');
    } catch (error: any) {
      logger.error('Error uploading background image:', error);
      showAlert('خطأ', error?.message || 'حدث خطأ أثناء رفع الصور', 'error');
    } finally {
      setUploading(false);
      setUploadingCount(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = (image: HeroBackgroundImage) => {
    showConfirm('حذف الصورة', 'سيتم حذف الصورة ولن تظهر في واجهة المستخدم. هل أنت متأكد؟', async () => {
      setDeletingId(image.id);
      try {
        await deleteHeroBackgroundImage(isAdmin, image.id, images);
        showAlert('تم الحذف', 'تم حذف الصورة ولن تظهر في واجهة المستخدم', 'success');
      } catch (error: any) {
        logger.error('Error deleting background image:', error);
        showAlert('خطأ', error?.message || 'حدث خطأ أثناء حذف الصورة', 'error');
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="admin-content">
      <div className="config-section">
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image size={22} />
            صور خلفية الواجهة
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>
          الصور المعروضة في شاشة المستخدم الرئيسية. يمكنك رفع صورة واحدة أو عدة صور بأي صيغة صور. بعد الحذف تختفي من الواجهة.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void handleUpload(e.target.files);
              }
            }}
          />
          <button
            type="button"
            className="save-button"
            disabled={uploading || !isAdmin}
            onClick={() => inputRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Upload size={16} />
            <span>رفع صور</span>
          </button>
          {uploading && (
            <div className="track-upload-status-badge">
              <LoadingState
                variant="Drive"
                label={uploadingCount > 1 ? `جاري رفع ${uploadingCount} صور...` : 'جاري رفع الصور...'}
              />
            </div>
          )}
        </div>

        {images.length === 0 ? (
          <div
            style={{
              padding: 28,
              textAlign: 'center',
              color: '#64748b',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 12
            }}
          >
            لا توجد صور خلفية حالياً. ارفع صورة لتظهر في واجهة المستخدم.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 16 }}>
            {images.map((image) => (
              <AdminBackgroundImageCard
                key={image.id}
                image={image}
                isAdmin={isAdmin}
                isDeleting={deletingId === image.id}
                onPreview={(url) => setPreviewUrl(url)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <img
            src={previewUrl}
            alt="معاينة الخلفية"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(960px, 100%)',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 20px 40px rgba(0,0,0,0.35)'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AdminBackgroundImagesTab;
