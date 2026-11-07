import React, { useState } from 'react';
import LoadingDots from '../components/common/LoadingDots';
import CustomToast from '../components/CustomToast';
import AdminSidebarNav from '../components/admin/AdminSidebarNav';
import AdminDashboardHeader from '../components/admin/AdminDashboardHeader';
import AdminDashboardContent from '../components/admin/AdminDashboardContent';
import AdminDashboardModals from '../components/admin/AdminDashboardModals';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import '../styles/SpreadsheetGrid.css';
import '../styles/AdminDashboardPage.css';
import '../styles/AdminExpandableRows.css';
import '../styles/AdminNewsEditor.css';

interface AdminDashboardPageProps {
  onLogout: () => void;
  onBack?: () => void;
  onAssignmentsClick?: () => void;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onLogout,
  onBack,
  onAssignmentsClick
}) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dashboard = useAdminDashboard({ onBack });

  if (dashboard.isLoading) {
    return (
      <div className="admin-dashboard-page">
        <LoadingDots fullScreen text="جارٍ تحميل لوحة الإدارة..." />
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      {dashboard.toastState && (
        <CustomToast
          message={dashboard.toastState.message}
          type={dashboard.toastState.type}
          onClose={() => dashboard.setToastState(null)}
          autoClose={true}
          duration={dashboard.toastState.duration}
        />
      )}

      <div className="admin-shell">
        <AdminSidebarNav
          activeTab={dashboard.activeTab}
          onSelectTab={dashboard.setActiveTab}
          showAssignments={!!onAssignmentsClick}
          onAssignmentsClick={onAssignmentsClick}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
        />

        <div className="admin-main-wrapper">
          <AdminDashboardHeader
            serverHealth={dashboard.serverHealth}
            checkServerHealth={dashboard.checkServerHealth}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onBack={onBack}
            onLogout={onLogout}
          />

          <AdminDashboardContent
            dashboard={dashboard}
            onBackToRequests={() => dashboard.setActiveTab('requests')}
          />

          <AdminDashboardModals dashboard={dashboard} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
