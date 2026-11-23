import React, { useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useStudent } from '../context';
import LoginPage from '../page/LoginPage';
import RegisterPage from '../page/RegisterPage';
import DashboardPage from '../page/DashboardPage';
import ServiceDetailsPage from '../page/ServiceDetailsPage';
import ProfilePage from '../page/ProfilePage';
import StudentAssignmentsPage from '../page/StudentAssignmentsPage';
import ApprovedRequestsPage from '../page/ApprovedRequestsPage';
import NewsPage from '../page/NewsPage';
import LoadingDots from '../components/common/LoadingDots';

const lazyWithRetry = (componentImport: () => Promise<any>) =>
  React.lazy(async () => {
    const pageHasBeenForceRefreshed = sessionStorage.getItem('chunk_force_refresh') === 'true';
    try {
      const component = await componentImport();
      sessionStorage.setItem('chunk_force_refresh', 'false');
      return component;
    } catch (error: any) {
      if (!pageHasBeenForceRefreshed) {
        sessionStorage.setItem('chunk_force_refresh', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

export const AdminDashboardPage = lazyWithRetry(() => import('../page/AdminDashboardPage'));
export const AssignmentsManagementPage = lazyWithRetry(() => import('../page/AssignmentsManagementPage'));
export const AllUsersPage = lazyWithRetry(() => import('../page/AllUsersPage'));
export const TelemetryDashboardPage = lazyWithRetry(
  () => import('../modules/telemetry/presentation/pages/TelemetryDashboardPage')
);

export const LoginWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, isTelemetryAdmin } = useStudent();

  useEffect(() => {
    if (!isLoggedIn) return;
    if (isTelemetryAdmin) {
      navigate('/telemetry', { replace: true });
    } else if (isAdmin) {
      navigate('/admin', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoggedIn, isAdmin, isTelemetryAdmin, navigate]);

  return (
    <LoginPage
      onLoginSuccess={() => navigate('/dashboard', { replace: true })}
      onGoToRegister={() => navigate('/register')}
      onAdminLogin={() => navigate('/admin', { replace: true })}
      onTelemetryLogin={() => navigate('/telemetry', { replace: true })}
    />
  );
};

export const RegisterWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn } = useStudent();
  useEffect(() => {
    if (isLoggedIn) navigate('/dashboard', { replace: true });
  }, [isLoggedIn, navigate]);
  return (
    <RegisterPage
      onRegistrationSuccess={() => navigate('/dashboard')}
      onGoToLogin={() => navigate('/login')}
    />
  );
};

export const DashboardWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useStudent();
  return (
    <DashboardPage
      onServiceClick={(id) => navigate(`/service/${id}`)}
      onProfileClick={() => navigate('/profile')}
      onAssignmentsClick={() => navigate('/my-assignments')}
      onRequestsClick={() => navigate('/my-requests')}
      onNewsClick={() => navigate('/news')}
      onLogout={async () => {
        try { await logout(); } catch (_) {}
        navigate('/login', { replace: true });
      }}
      onAdminClick={() => navigate('/admin')}
    />
  );
};

export const ServiceDetailsWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  if (!id) return <Navigate to="/dashboard" replace />;
  return (
    <ServiceDetailsPage
      serviceId={id}
      onBack={() => navigate('/dashboard')}
      onSubmitSuccess={() => navigate('/dashboard', { replace: true })}
    />
  );
};

export const StudentAssignmentsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <StudentAssignmentsPage onBack={() => navigate('/dashboard')} />;
};

export const ApprovedRequestsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <ApprovedRequestsPage onBack={() => navigate('/dashboard')} />;
};

export const ProfileWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <ProfilePage onBack={() => navigate('/dashboard')} />;
};

export const AllUsersWrapper: React.FC = () => {
  const navigate = useNavigate();
  return (
    <React.Suspense fallback={<LoadingDots fullScreen text="جارٍ التحميل..." />}>
      <AllUsersPage onBack={() => navigate('/dashboard')} />
    </React.Suspense>
  );
};

export const NewsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return <NewsPage onBack={() => navigate('/dashboard')} />;
};

export const AdminDashboardWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useStudent();
  return (
    <React.Suspense fallback={<LoadingDots fullScreen text="جارٍ تحميل لوحة الإدارة..." />}>
      <AdminDashboardPage
        onLogout={async () => {
          try {
            await logout();
            await new Promise((r) => setTimeout(r, 100));
          } catch (_) {}
          navigate('/login', { replace: true });
        }}
        onBack={() => navigate('/dashboard')}
        onAssignmentsClick={() => navigate('/admin/assignments')}
      />
    </React.Suspense>
  );
};

export const AssignmentsWrapper: React.FC = () => {
  const navigate = useNavigate();
  return (
    <React.Suspense fallback={<LoadingDots fullScreen text="جارٍ التحميل..." />}>
      <AssignmentsManagementPage onBack={() => navigate('/admin')} />
    </React.Suspense>
  );
};

export const TelemetryDashboardWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useStudent();
  return (
    <React.Suspense fallback={<LoadingDots fullScreen text="جارٍ تحميل مركز المراقبة..." />}>
      <TelemetryDashboardPage
        onLogout={async () => {
          try { await logout(); } catch (_) {}
          navigate('/login', { replace: true });
        }}
      />
    </React.Suspense>
  );
};
