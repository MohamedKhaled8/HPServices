import React from 'react';
import { Loader2 } from 'lucide-react';
import { TrackKey } from '../../../../services/firebaseService';
import { getPathLastName } from '../../utils/folderUtils';

export interface FullscreenLoadingOverlaysProps {
  isRemovingFromUsers: boolean;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
}

export const FullscreenLoadingOverlays: React.FC<FullscreenLoadingOverlaysProps> = ({
  isRemovingFromUsers,
  folderDeleteLoading
}) => {
  return (
    <>
      {/* Removing from users loading overlay */}
      {isRemovingFromUsers && (
        <div className="removing-users-overlay">
          <div className="removing-users-content">
            <Loader2 size={40} className="spinning-loader-large" />
            <p>جاري حذف الملفات من حسابات الطلاب...</p>
            <span>يرجى الانتظار وعدم إغلاق الصفحة</span>
          </div>
        </div>
      )}

      {folderDeleteLoading && (
        <div className="removing-users-overlay">
          <div className="removing-users-content">
            <Loader2 size={40} className="spinning-loader-large" />
            <p>
              جاري حذف المجلد{' '}
              <strong dir="ltr">{getPathLastName(folderDeleteLoading.folderPath) || folderDeleteLoading.folderPath}</strong>
              {folderDeleteLoading.scope === 'track' ? ' وكل محتوياته من المسار...' : ' وكل محتوياته من الـ 130...'}
            </p>
            <span>يرجى الانتظار — قد يستغرق ذلك بضع ثوانٍ</span>
          </div>
        </div>
      )}
    </>
  );
};
