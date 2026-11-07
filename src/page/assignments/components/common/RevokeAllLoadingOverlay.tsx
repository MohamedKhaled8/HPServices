import React from 'react';
import { Loader2 } from 'lucide-react';

export interface RevokeAllLoadingOverlayProps {
  isRevokingAll: boolean;
}

export const RevokeAllLoadingOverlay: React.FC<RevokeAllLoadingOverlayProps> = ({
  isRevokingAll
}) => {
  if (!isRevokingAll) return null;

  return (
    <div className="removing-users-overlay">
      <div className="removing-users-content">
        <Loader2 size={40} className="spinning-loader-large" color="#e11d48" />
        <p>جاري سحب كافة الملفات من حسابات الطلاب في المسار...</p>
        <span>يتم التحديث بكفاءة دون إجهاد قاعدة البيانات، يرجى الانتظار</span>
      </div>
    </div>
  );
};
