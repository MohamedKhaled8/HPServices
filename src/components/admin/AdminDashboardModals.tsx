import React from 'react';
import type { AdminDashboardContextType } from '../../hooks/useAdminDashboard';
import EditStudentModal from './modals/EditStudentModal';
import ViewingStudentRequestsModal from './modals/ViewingStudentRequestsModal';
import AdminAlertModal from './modals/AdminAlertModal';
import { translateKey } from './requests/requestsHelpersCore';

interface AdminDashboardModalsProps {
  dashboard: AdminDashboardContextType;
}

export const AdminDashboardModals: React.FC<AdminDashboardModalsProps> = ({ dashboard }) => {
  const { users, alertConfig, setAlertConfig, getStatusBadge } = dashboard;

  return (
    <>
      <EditStudentModal
        isOpen={users.isEditingStudent}
        studentData={users.editedStudentData}
        onClose={() => users.setIsEditingStudent(false)}
        onSave={users.handleSaveStudent}
        onChangeStudentData={users.setEditedStudentData}
        isSaving={users.isSaving === 'student'}
      />

      <ViewingStudentRequestsModal
        student={users.viewingStudentRequests}
        onClose={() => users.setViewingStudentRequests(null)}
        studentRequests={
          users.viewingStudentRequests
            ? users.getStudentRequests(users.viewingStudentRequests.id || '')
            : []
        }
        getServiceName={users.getServiceName}
        getStatusBadge={getStatusBadge}
        translateKey={translateKey}
      />

      <AdminAlertModal
        config={alertConfig}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
};

export default AdminDashboardModals;

