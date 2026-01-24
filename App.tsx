import React, { useState } from 'react';
import { StudentProvider, useStudent } from './src/context';
import RegisterPage from './src/page/RegisterPage';
import LoginPage from './src/page/LoginPage';
import DashboardPage from './src/page/DashboardPage';
import ServiceDetailsPage from './src/page/ServiceDetailsPage';
import ProfilePage from './src/page/ProfilePage';
import AllUsersPage from './src/page/AllUsersPage';
import AdminDashboardPage from './src/page/AdminDashboardPage';
import './src/styles/App.css';

type Page = 'login' | 'register' | 'dashboard' | 'service' | 'profile' | 'allUsers' | 'admin';

const AppContent: React.FC = () => {
  const { isLoggedIn, logout } = useStudent();
  const [currentPage, setCurrentPage] = useState<Page>(isLoggedIn ? 'dashboard' : 'login');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  const handleLoginSuccess = () => {
    setCurrentPage('dashboard');
  };

  const handleRegistrationSuccess = () => {
    setCurrentPage('dashboard');
  };

  const handleServiceClick = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setCurrentPage('service');
  };

  const handleProfileClick = () => {
    setCurrentPage('profile');
  };

  const handleAllUsersClick = () => {
    setCurrentPage('allUsers');
  };

  const handleAdminLogin = () => {
    setCurrentPage('admin');
  };

  const handleLogout = () => {
    logout();
    setCurrentPage('login');
  };

  const handleBack = () => {
    setCurrentPage('dashboard');
  };

  const handleSubmitSuccess = () => {
    setCurrentPage('dashboard');
  };

  const goToRegister = () => {
    setCurrentPage('register');
  };

  const goToLogin = () => {
    setCurrentPage('login');
  };

  return (
    <div className="app">
      {currentPage === 'login' && !isLoggedIn && (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess} 
          onGoToRegister={goToRegister}
          onAdminLogin={handleAdminLogin}
        />
      )}

      {currentPage === 'register' && !isLoggedIn && (
        <RegisterPage onRegistrationSuccess={handleRegistrationSuccess} onGoToLogin={goToLogin} />
      )}

      {currentPage === 'dashboard' && isLoggedIn && (
        <DashboardPage
          onServiceClick={handleServiceClick}
          onProfileClick={handleProfileClick}
          onLogout={handleLogout}
          onAllUsersClick={handleAllUsersClick}
          onAdminClick={handleAdminLogin}
        />
      )}

      {currentPage === 'allUsers' && isLoggedIn && (
        <AllUsersPage onBack={handleBack} />
      )}

      {currentPage === 'service' && isLoggedIn && (
        <ServiceDetailsPage
          serviceId={selectedServiceId}
          onBack={handleBack}
          onSubmitSuccess={handleSubmitSuccess}
        />
      )}

      {currentPage === 'profile' && isLoggedIn && (
        <ProfilePage onBack={handleBack} />
      )}

      {currentPage === 'admin' && isLoggedIn && (
        <AdminDashboardPage onLogout={handleLogout} onBack={handleBack} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StudentProvider>
      <AppContent />
    </StudentProvider>
  );
};

export default App;
