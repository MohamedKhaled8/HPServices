import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StudentData, ServiceRequest } from '../types';
import {
  onAuthStateChange,
  logoutUser,
  subscribeToServiceRequests,
  addServiceRequest as addServiceRequestToFirebase,
  checkAdminRole,
  subscribeToStudentData,
  ensureStudentDocExists,
  type AdminRole
} from '../services/firebaseService';
import { clearTrackedSessionId } from '../modules/telemetry/application/useAdminSessionGuard';
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
  const [student, setStudent] = useState<StudentData | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole>('student');
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = adminRole === 'primary_admin';
  const isTelemetryAdmin = adminRole === 'telemetry_admin';

  // Listen to auth state changes
  useEffect(() => {
    let unsubscribeStudentDoc: (() => void) | null = null;
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const role = await checkAdminRole(user.uid);
          setAdminRole(role);
          if (role === 'primary_admin' || role === 'telemetry_admin') {
            if (unsubscribeStudentDoc) {
              unsubscribeStudentDoc();
              unsubscribeStudentDoc = null;
            }
            const adminStudentData: StudentData = {
              id: user.uid,
              fullNameArabic: role === 'telemetry_admin' ? 'مشرف المراقبة والأمان' : 'مدير النظام',
              vehicleNameEnglish: role === 'telemetry_admin' ? 'Telemetry Admin' : 'Admin',
              whatsappNumber: '',
              diplomaYear: '',
              diplomaType: '',
              track: '',
              nationalID: '',
              address: {
                governorate: '',
                city: '',
                street: '',
                building: '',
                siteNumber: ''
              },
              course: '',
              email: user.email || ''
            };
            setStudent(adminStudentData);
          } else {
            // Realtime subscribe to student document so assignedFiles updates show immediately
            if (unsubscribeStudentDoc) {
              unsubscribeStudentDoc();
              unsubscribeStudentDoc = null;
            }

            let firstSnap = true;
            unsubscribeStudentDoc = subscribeToStudentData(
              user.uid,
              async (studentData) => {
                if (!studentData) {
                  try {
                    const ensured = await ensureStudentDocExists(user, user.email || '');
                    setStudent(ensured);
                  } catch (e) {
                    console.error('Error ensuring student doc:', e);
                    setStudent(null);
                  }
                } else {
                  setStudent(studentData);
                }
                if (firstSnap) {
                  firstSnap = false;
                  setIsLoading(false);
                }
              },
              (error) => {
                console.error('Error subscribing to student data:', error);
                setStudent(null);
                setIsLoading(false);
              }
            );

            // Return early; loading will be cleared on first snapshot
            return;
          }
        } catch (error) {
          console.error('Error fetching student data:', error);
          setStudent(null);
        } 
      } else {
        if (unsubscribeStudentDoc) {
          unsubscribeStudentDoc();
          unsubscribeStudentDoc = null;
        }
        setAdminRole('student');
        setStudent(null);
        setServiceRequests([]);
      }
      setIsLoading(false);
    });

    return () => {
      if (unsubscribeStudentDoc) unsubscribeStudentDoc();
      unsubscribe();
    };
  }, []);

  // Subscribe to service requests in real-time (students only — zero Firestore reads for telemetry_admin)
  useEffect(() => {
    if (!student?.id || adminRole !== 'student') {
      setServiceRequests([]);
      return;
    }

    const unsubscribe = subscribeToServiceRequests(student.id, (requests) => {
      setServiceRequests(requests);
    });

    return () => unsubscribe();
  }, [student?.id, adminRole]);

  const handleSetStudent = (data: StudentData, roleOverride?: AdminRole) => {
    if (roleOverride) {
      setAdminRole(roleOverride);
    }
    setStudent(data);
  };

  const handleLogout = async () => {
    try {
      clearTrackedSessionId();
      try {
        sessionStorage.removeItem('hp_telemetry_hmac_token');
      } catch {
        // Ignore storage error
      }
      setAdminRole('student');
      setStudent(null);
      setServiceRequests([]);
      await logoutUser();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const addServiceRequest = async (request: ServiceRequest) => {
    try {
      await addServiceRequestToFirebase(request);
      // The real-time listener will update the state automatically
    } catch (error) {
      console.error('Error adding service request:', error);
      throw error;
    }
  };

  const updateServiceRequest = (id: string, updatedData: Partial<ServiceRequest>) => {
    // This will be handled by Firestore updates
    const updated = serviceRequests.map(req =>
      req.id === id ? { ...req, ...updatedData } : req
    );
    setServiceRequests(updated);
  };

  const getServiceRequest = (id: string) => {
    return serviceRequests.find(req => req.id === id);
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

  return (
    <StudentContext.Provider value={value}>
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (context === undefined) {
    throw new Error('useStudent must be used within StudentProvider');
  }
  return context;
};