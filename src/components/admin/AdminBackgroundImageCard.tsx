import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import type { HeroBackgroundImage } from '../../utils/backgroundImages';

interface AdminBackgroundImageCardProps {
  image: HeroBackgroundImage;
  isAdmin: boolean;
  isDeleting: boolean;
  onPreview: (url: string) => void;
  onDelete: (image: HeroBackgroundImage) => void;
}

export const AdminBackgroundImageCard: React.FC<AdminBackgroundImageCardProps> = ({
  image,
  isAdmin,
  isDeleting,
  onPreview,
  onDelete
}) => {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <button
        type="button"
        onClick={() => onPreview(image.url)}
        style={{
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          background: '#0f172a',
          aspectRatio: '16 / 10'
        }}
        title="معاينة"
      >
        <img
          src={image.url}
          alt="خلفية"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </button>
      <div style={{ padding: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          onClick={() => onPreview(image.url)}
          style={{
            flex: 1,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#f8fafc',
            cursor: 'pointer',
            padding: '8px 10px',
            fontWeight: 700,
            fontSize: 13
          }}
        >
          معاينة
        </button>
        <button
          type="button"
          disabled={isDeleting || !isAdmin}
          onClick={() => onDelete(image)}
          style={{
            border: 'none',
            borderRadius: 8,
            background: '#fef2f2',
            color: '#dc2626',
            cursor: 'pointer',
            padding: '8px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 13
          }}
        >
          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          حذف
        </button>
      </div>
    </div>
  );
};

export default AdminBackgroundImageCard;
