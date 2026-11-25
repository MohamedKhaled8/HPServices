import React from 'react';
import type { AdminDashboardContextType } from '../../hooks/useAdminDashboard';
import AssignmentsManagementPage from '../../page/AssignmentsManagementPage';
import AdminAssistantTab from './AdminAssistantTab';
import AdminBotTrainingTab from './AdminBotTrainingTab';
import AdminBackupTab from './AdminBackupTab';
import AdminNewsTab from './AdminNewsTab';
import AdminBackgroundImagesTab from './AdminBackgroundImagesTab';
import AdminRequestsTab from './requests/AdminRequestsTab';
import BooksConfigTab from './configs/BooksConfigTab';
import FeesConfigTab from './configs/FeesConfigTab';
import CertificatesConfigTab from './configs/CertificatesConfigTab';
import FinalReviewConfigTab from './configs/FinalReviewConfigTab';
import GraduationProjectConfigTab from './configs/GraduationProjectConfigTab';
import AdminUsersTab from './AdminUsersTab';
import StatementEnrollmentConfigTab from './configs/StatementEnrollmentConfigTab';
import ServicesManagementTab from './configs/ServicesManagementTab';
import DigitalTransformationConfigTab from './configs/DigitalTransformationConfigTab';
import ElectronicPaymentCodesTab from './codes/ElectronicPaymentCodesTab';
import AdminStatisticsTab from './AdminStatisticsTab';
import { resolveHeroBackgroundImages } from '../../utils/backgroundImages';

interface AdminDashboardContentProps {
  dashboard: AdminDashboardContextType;
  onBackToRequests: () => void;
}

export const AdminDashboardContent: React.FC<AdminDashboardContentProps> = ({
  dashboard,
  onBackToRequests
}) => {
  const {
    activeTab,
    serviceRequests,
    setServiceRequests,
    dataReady,
    students,
    setStudents,
    studentsRef,
    dtCodes,
    epCodes,
    setEpCodes,
    selectedServiceId,
    setSelectedServiceId,
    serviceTotalCounts,
    setServiceTotalCounts,
    restoreToolsUnlocked,
    setRestoreToolsUnlocked,
    isMobile,
    setToastState,
    showAlert,
    showConfirm,
    stats,
    rowFlags,
    configs,
    users,
    runAutoFixPlaceholderOrders,
    isAutoFixingOrders,
    handleDeleteEPCode,
    copyEPColumn
  } = dashboard;

  return (
    <div className="admin-main" data-lenis-prevent>
      {activeTab === 'assignments' && (
        <AssignmentsManagementPage onBack={onBackToRequests} />
      )}

      {activeTab === 'adminAssistant' && (
        <AdminAssistantTab
          serviceRequests={serviceRequests}
          students={students}
          showAlert={showAlert}
          dtCodes={dtCodes}
          epCodes={epCodes}
        />
      )}

      {activeTab === 'botTraining' && (
        <AdminBotTrainingTab showAlert={showAlert} showConfirm={showConfirm} />
      )}

      {activeTab === 'backup' && (
        <AdminBackupTab showAlert={showAlert} showConfirm={showConfirm} />
      )}

      {activeTab === 'news' && (
        <AdminNewsTab showAlert={showAlert} showConfirm={showConfirm} />
      )}

      {activeTab === 'backgrounds' && (
        <AdminBackgroundImagesTab
          images={resolveHeroBackgroundImages(configs.adminPrefs?.heroBackgroundImages)}
          isAdmin={true}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      )}

      {activeTab === 'requests' && (
        <AdminRequestsTab
          serviceRequests={serviceRequests}
          setServiceRequests={setServiceRequests}
          dataReady={dataReady}
          students={students}
          studentsRef={studentsRef}
          dtCodes={dtCodes}
          epCodes={epCodes}
          selectedServiceId={selectedServiceId}
          setSelectedServiceId={setSelectedServiceId}
          serviceTotalCounts={serviceTotalCounts}
          setServiceTotalCounts={setServiceTotalCounts}
          bookConfig={configs.bookConfig}
          assignmentsConfig={configs.assignmentsConfig}
          finalReviewConfig={configs.finalReviewConfig}
          statementEnrollmentConfig={configs.statementEnrollmentConfig}
          statsUnlocked={stats.statsUnlocked}
          statsPasswordOpen={stats.statsPasswordOpen}
          setStatsPasswordOpen={stats.setStatsPasswordOpen}
          statsPasswordInput={stats.statsPasswordInput}
          setStatsPasswordInput={stats.setStatsPasswordInput}
          tryUnlockStats={stats.tryUnlockStats}
          handleStatsLockIndicatorClick={stats.handleStatsLockIndicatorClick}
          handleStatsLockIndicatorKeyDown={stats.handleStatsLockIndicatorKeyDown}
          adminPrefs={configs.adminPrefs}
          showAlert={showAlert}
          showConfirm={showConfirm}
          setToastState={setToastState as any}
          isLoadingMoreServiceRequests={dashboard.isLoadingMoreServiceRequests}
          hasMoreServiceRequests={dashboard.hasMoreServiceRequests}
          isLoadingRequests={dashboard.isLoadingRequests}
          filteredTotalMatchingCount={dashboard.filteredTotalMatchingCount}
          activeServiceStatusCounts={dashboard.activeServiceStatusCounts}
          requestStatusFilter={dashboard.requestStatusFilter}
          setRequestStatusFilter={dashboard.setRequestStatusFilter}
          requestDateFrom={dashboard.requestDateFrom}
          setRequestDateFrom={dashboard.setRequestDateFrom}
          requestDateTo={dashboard.requestDateTo}
          setRequestDateTo={dashboard.setRequestDateTo}
          resetRequestFilters={dashboard.resetRequestFilters}
          handleLoadMoreServiceRequests={dashboard.handleLoadMoreServiceRequests}
          updateLocalRequest={dashboard.updateLocalRequest}
          deleteLocalRequest={dashboard.deleteLocalRequest}
          requestsStatsMap={dashboard.requestsStats?.serviceStatsMap}
          totalRequestsCount={dashboard.totalRequestsCount}
          syncCounters={dashboard.requestsStats?.syncCounters}
          isSyncingCounters={dashboard.requestsStats?.isSyncing}
        />
      )}

      {activeTab === 'books' && <BooksConfigTab showAlert={showAlert} />}

      {activeTab === 'fees' && <FeesConfigTab showAlert={showAlert} />}

      {activeTab === 'certificates' && <CertificatesConfigTab showAlert={showAlert} />}

      {activeTab === 'finalReview' && <FinalReviewConfigTab showAlert={showAlert} />}

      {activeTab === 'graduationProject' && (
        <GraduationProjectConfigTab showAlert={showAlert} />
      )}

      {activeTab === 'users' && (
        <AdminUsersTab
          searchTerm={users.searchTerm}
          setSearchTerm={users.setSearchTerm}
          filteredAdminStudents={users.filteredAdminStudents}
          usersDirectoryLoading={users.usersDirectoryLoading}
          studentsTotalCount={users.studentsTotalCount}
          studentsRestLoading={users.studentsRestLoading}
          usersListPage={users.usersListPage}
          setUsersListPage={users.setUsersListPage}
          adminUsersTotalPages={users.adminUsersTotalPages}
          displayedAdminStudents={users.displayedAdminStudents}
          requestCountByStudentId={users.requestCountByStudentId}
          toggledFlags={rowFlags.toggledFlags}
          toggleFlag={rowFlags.toggleFlag}
          showPasswords={users.showPasswords}
          setShowPasswords={users.setShowPasswords}
          setViewingStudentRequests={users.setViewingStudentRequests}
          handleEditStudent={users.handleEditStudent}
          deleteStudentData={users.handleDeleteStudent}
          showAlert={showAlert}
          setToastState={setToastState as any}
          ADMIN_USERS_PAGE_SIZE={users.ADMIN_USERS_PAGE_SIZE}
          usersHasMore={users.usersHasMore}
          isLoadingMoreUsers={users.isLoadingMoreUsers}
          handleLoadMoreUsers={users.handleLoadMoreUsers}
        />
      )}

      {activeTab === 'statementEnrollment' && (
        <StatementEnrollmentConfigTab showAlert={showAlert} />
      )}

      {activeTab === 'services' && (
        <ServicesManagementTab
          adminPrefs={configs.adminPrefs}
          setAdminPrefs={configs.setAdminPrefs}
          updateAdminPreferences={configs.updateAdminPreferences}
          showAlert={showAlert}
          setToastState={setToastState as any}
          isMobile={isMobile}
          restoreToolsUnlocked={restoreToolsUnlocked}
          setRestoreToolsUnlocked={setRestoreToolsUnlocked}
          runAutoFixPlaceholderOrders={runAutoFixPlaceholderOrders}
          isAutoFixingOrders={isAutoFixingOrders}
          setSelectedServiceId={setSelectedServiceId}
          setServiceTotalCounts={setServiceTotalCounts}
          setServiceRequests={setServiceRequests}
          studentsRef={studentsRef}
          allStudents={users.allStudents}
          setStudents={setStudents}
        />
      )}

      {activeTab === 'digitalTransformation' && (
        <DigitalTransformationConfigTab showAlert={showAlert} />
      )}

      {activeTab === 'electronicPaymentCodes' && (
        <ElectronicPaymentCodesTab
          epCodes={epCodes}
          setEpCodes={setEpCodes}
          toggledFlags={rowFlags.toggledFlags}
          toggleFlag={rowFlags.toggleFlag}
          showAlert={showAlert}
          setToastState={setToastState as any}
          handleDeleteEPCode={handleDeleteEPCode}
          copyEPColumn={copyEPColumn}
        />
      )}

      {activeTab === 'statistics' && (
        <AdminStatisticsTab
          serviceRequests={serviceRequests}
          serviceTotalCounts={dashboard.requestsStats?.serviceStatsMap}
          adminPrefs={configs.adminPrefs}
          setAdminPrefs={configs.setAdminPrefs}
          updateAdminPreferences={configs.updateAdminPreferences}
          statsDateRange={stats.statsDateRange}
          setStatsDateRange={stats.setStatsDateRange}
          isMobile={isMobile}
          statsUnlocked={stats.statsUnlocked}
          lockStats={stats.lockStats}
          setStatsPasswordOpen={stats.setStatsPasswordOpen}
          statsPasswordOpen={stats.statsPasswordOpen}
          statsPasswordInput={stats.statsPasswordInput}
          setStatsPasswordInput={stats.setStatsPasswordInput}
          tryUnlockStats={stats.tryUnlockStats}
          setToastState={setToastState as any}
        />
      )}
    </div>
  );
};

export default AdminDashboardContent;

