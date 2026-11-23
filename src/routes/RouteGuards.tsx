import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStudent } from '../context';
import LoadingDots from '../components/common/LoadingDots';
import StudentSupportAssistant from '../components/SupportAssistant/StudentSupportAssistant';
import StudentPhonePromptModal from '../components/StudentPhonePromptModal';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isAdmin, isTelemetryAdmin } = useStudent();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (isTelemetryAdmin) return <Navigate to="/telemetry" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isAdmin, isTelemetryAdmin, isAuthLoading } = useStudent();
  if (isAuthLoading) return <LoadingDots fullScreen text="جارٍ التحقق من الصلاحيات..." />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (isTelemetryAdmin) return <Navigate to="/telemetry" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const TelemetryRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isAdmin, isTelemetryAdmin, isAuthLoading } = useStudent();
  if (isAuthLoading) return <LoadingDots fullScreen text="جارٍ التحقق من الصلاحيات..." />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (!isTelemetryAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const StudentChromeGuard: React.FC = () => {
  const { isTelemetryAdmin } = useStudent();
  if (isTelemetryAdmin) return null;
  return (
    <>
      <StudentSupportAssistant />
      <StudentPhonePromptModal />
    </>
  );
};

export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__lenis) {
      (window as any).__lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
};
