import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { StudentData, ServiceRequest } from '../types';
import {
  onAuthStateChange,
  logoutUser,
  checkAdminRole,
  subscribeToStudentData,
  ensureStudentDocExists,
  type AdminRole
} from '../services/firebaseService';
import { clearTrackedSessionId } from '../modules/telemetry/application/useAdminSessionGuard';
import {
  getPersistedSession,
  savePersistedSession,
  clearPersistedSession,
  setupSilentTokenRefresh
} from '../services/authPersistenceService';
import { useServiceRequestsManager } from './useServiceRequestsManager';
import LoadingDots from '../components/common/LoadingDots';

interface StudentContextType {
  student: StudentData | null;
  setStudent: (data: StudentData, roleOverride?: AdminRole) => void;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isTelemetryAdmin: boolean;
  adminRole: AdminRole;
  isAuthLoading: boolean;
  serviceRequests: ServiceRequest[];
  addServiceRequest: (request: ServiceRequest) => Promise<void>;
  updateServiceRequest: (id: string, request: Partial<ServiceRequest>) => void;
  getServiceRequest: (id: string) => ServiceRequest | undefined;
  logout: () => Promise<void>;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cached = getPersistedSession();
  const [student, setStudent] = useState<StudentData | null>(cached?.student || null);
  const [adminRole, setAdminRole] = useState<AdminRole>(cached?.role || 'student');
  const [isLoading, setIsLoading] = useState<boolean>(!cached);

  const isAdmin = adminRole === 'primary_admin';
  const isTelemetryAdmin = adminRole === 'telemetry_admin';

  const {
    serviceRequests,
    setServiceRequests,
    addServiceRequest,
    updateServiceRequest,
    getServiceRequest
  } = useServiceRequestsManager(student?.id, adminRole);

  useEffect(() => {
    const unsubTokenRefresh = setupSilentTokenRefresh();
    let unsubStudentDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const role = await checkAdminRole(user.uid);
          setAdminRole(role);

          if (role === 'primary_admin' || role === 'telemetry_admin') {
            if (unsubStudentDoc) {
              unsubStudentDoc();
              unsubStudentDoc = null;
            }
            const adminData: StudentData = {
              id: user.uid,
              fullNameArabic: role === 'telemetry_admin' ? 'مشرف المراقبة والأمان' : 'مدير النظام',
              vehicleNameEnglish: role === 'telemetry_admin' ? 'Telemetry Admin' : 'Admin',
              whatsappNumber: '',
              diplomaYear: '',
              diplomaType: '',
              track: '',
              nationalID: '',
              address: { governorate: '', city: '', street: '', building: '', siteNumber: '' },
              course: '',
              email: user.email || ''
            };
            setStudent(adminData);
            savePersistedSession(user, role, adminData);
            setIsLoading(false);
          } else {
            if (unsubStudentDoc) {
              unsubStudentDoc();
              unsubStudentDoc = null;
            }

            unsubStudentDoc = subscribeToStudentData(
              user.uid,
              async (studentData) => {
                if (!studentData) {
                  try {
                    const ensured = await ensureStudentDocExists(user, user.email || '');
                    setStudent(ensured);
                    savePersistedSession(user, 'student', ensured);
                  } catch (e) {
                    console.error('Error ensuring student doc:', e);
                  }
                } else {
                  setStudent(studentData);
                  savePersistedSession(user, 'student', studentData);
                }
                setIsLoading(false);
              },
              (error) => {
                console.error('Error subscribing to student data:', error);
                setIsLoading(false);
              }
            );
          }
        } catch (error) {
          console.error('Error verifying auth role:', error);
          if (cached?.student && (cached.role === 'primary_admin' || cached.role === 'telemetry_admin')) {
            setStudent(cached.student);
            setAdminRole(cached.role);
          }
          setIsLoading(false);
        }
      } else {
        if (unsubStudentDoc) {
          unsubStudentDoc();
          unsubStudentDoc = null;
        }
        clearPersistedSession();
        setAdminRole('student');
        setStudent(null);
        setServiceRequests([]);
        setIsLoading(false);
      }
    });

    return () => {
      if (unsubStudentDoc) unsubStudentDoc();
      unsubAuth();
      unsubTokenRefresh();
    };
  }, []);

  const handleSetStudent = (data: StudentData, roleOverride?: AdminRole) => {
    const nextRole = roleOverride || adminRole;
    if (roleOverride) setAdminRole(roleOverride);
    setStudent(data);
    savePersistedSession({ uid: data.id || '', email: data.email }, nextRole, data);
  };

  const handleLogout = async () => {
    try {
      clearTrackedSessionId();
      clearPersistedSession();
      setAdminRole('student');
      setStudent(null);
      setServiceRequests([]);
      await logoutUser();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const value: StudentContextType = {
    student,
    setStudent: handleSetStudent,
    isLoggedIn: student !== null,
    isAdmin,
    isTelemetryAdmin,
    adminRole,
    isAuthLoading: isLoading,
    serviceRequests,
    addServiceRequest,
    updateServiceRequest,
    getServiceRequest,
    logout: handleLogout
  };

  if (isLoading) {
    return <LoadingDots fullScreen text="جارٍ التحميل..." />;
  }

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudent must be used within StudentProvider');
  }
  return context;
};
