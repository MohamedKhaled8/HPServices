import { useState } from 'react';

export const useAssignmentsNotifications = () => {
  const [assignmentsMessage, setAssignmentsMessage] = useState<string | null>(null);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');

  // Helper function to show snackbar
  const showSnackbarNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setShowSnackbar(true);

    setTimeout(() => {
      setShowSnackbar(false);
    }, 3000);
  };

  return {
    assignmentsMessage,
    setAssignmentsMessage,
    showSnackbar,
    snackbarMessage,
    snackbarType,
    showSnackbarNotification,
  };
};

