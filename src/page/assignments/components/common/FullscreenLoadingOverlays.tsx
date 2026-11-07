import React from 'react';
import { Loader2 } from 'lucide-react';
import { TrackKey } from '../../../../services/firebaseService';
import { getPathLastName } from '../../utils/folderUtils';

export interface FullscreenLoadingOverlaysProps {
  isRevokingAll: boolean;
  isRemovingFromUsers: boolean;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
}

export const FullscreenLoadingOverlays: React.FC<FullscreenLoadingOverlaysProps> = ({
  isRevokingAll,
  isRemovingFromUsers,
  folderDeleteLoading
}) => {
  return (
    <>
      {/* شاشة تحميل أثناء السحب الشامل */}
      {isRevokingAll && (
        <div className="removing-users-overlay">
          <div className="removing-users-content">
            <Loader2 size={40} className="spinning-loader-large" color="#e11d48" />
            <p>جاري سحب كافة الملفات من حسابات الطلاب في المسار...</p>
            <span>يتم التحديث بكفاءة دون إجهاد قاعدة البيانات، يرجى الانتظار</span>
          </div>
        </div>
      )}

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
