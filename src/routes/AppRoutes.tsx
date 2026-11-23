import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ResetPasswordPage from '../page/ResetPasswordPage';
import AboutPage from '../page/AboutPage';
import ContactPage from '../page/ContactPage';
import PrivacyPage from '../page/PrivacyPage';
import {
  LoginWrapper,
  RegisterWrapper,
  DashboardWrapper,
  ServiceDetailsWrapper,
  StudentAssignmentsWrapper,
  ApprovedRequestsWrapper,
  ProfileWrapper,
  AllUsersWrapper,
  NewsWrapper,
  AdminDashboardWrapper,
  AssignmentsWrapper,
  TelemetryDashboardWrapper,
} from './RoutePages';
import {
  ProtectedRoute,
  AdminRoute,
  TelemetryRoute,
} from './RouteGuards';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginWrapper />} />
      <Route path="/telemetry-login" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/admin-login" element={<Navigate to="/login" replace />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* User Protected Routes */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-assignments"
        element={
          <ProtectedRoute>
            <StudentAssignmentsWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-requests"
        element={
          <ProtectedRoute>
            <ApprovedRequestsWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/service/:id"
        element={
          <ProtectedRoute>
            <ServiceDetailsWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfileWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/all-users"
        element={
          <ProtectedRoute>
            <AllUsersWrapper />
          </ProtectedRoute>
        }
      />
      <Route
        path="/news"
        element={
          <ProtectedRoute>
            <NewsWrapper />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardWrapper />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/assignments"
        element={
          <AdminRoute>
            <AssignmentsWrapper />
          </AdminRoute>
        }
      />

      {/* Isolated Super-Admin Telemetry Route */}
      <Route
        path="/telemetry"
        element={
          <TelemetryRoute>
            <TelemetryDashboardWrapper />
          </TelemetryRoute>
        }
      />

      {/* Catch All */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
