import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface AssignmentsSnackbarProps {
  showSnackbar: boolean;
  snackbarMessage: string;
  snackbarType: 'success' | 'error';
}

export const AssignmentsSnackbar: React.FC<AssignmentsSnackbarProps> = ({
  showSnackbar,
  snackbarMessage,
  snackbarType,
}) => {
  if (!showSnackbar) return null;

  return (
        <div className={`snackbar ${snackbarType}`}>
          {snackbarType === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{snackbarMessage}</span>
        </div>
  );
};
