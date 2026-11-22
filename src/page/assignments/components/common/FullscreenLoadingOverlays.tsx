import React from 'react';
import { TrackKey } from '../../../../services/firebaseService';
import { getPathLastName } from '../../utils/folderUtils';
import { UploadSnackbar } from '../../../../components/common/UploadSnackbar';

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
  folderDeleteLoading,
}) => {
  const isVisible = !!folderDeleteLoading || isRemovingFromUsers;
  let label = '';

  if (folderDeleteLoading) {
    const folderName = getPathLastName(folderDeleteLoading.folderPath) || folderDeleteLoading.folderPath;
    label = `جاري حذف المجلد ${folderName}...`;
  } else if (isRemovingFromUsers) {
    label = 'جاري حذف الملفات من حسابات الطلاب...';
  }

  return (
    <UploadSnackbar
      isVisible={isVisible}
      label={label}
      variant="Drive"
      showTimer={true}
    />
  );
};
