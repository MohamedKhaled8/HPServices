import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { StudentData, ServiceRequest } from '../types';
import {
  onAuthStateChange,
  getStudentData,
  logoutUser,
  subscribeToServiceRequests,
  addServiceRequest as addServiceRequestToFirebase,
  checkIsAdmin
} from '../services/firebaseService';

interface StudentContextType {
  student: StudentData | null;
  setStudent: (data: StudentData) => void;
  isLoggedIn: boolean;
  serviceRequests: ServiceRequest[];
  addServiceRequest: (request: ServiceRequest) => Promise<void>;
  updateServiceRequest: (id: string, request: Partial<ServiceRequest>) => void;
  getServiceRequest: (id: string) => ServiceRequest | undefined;
  logout: () => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<StudentData | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        try {
          // Check if user is admin
          const isAdmin = await checkIsAdmin(user.uid);
          if (isAdmin) {
            // Create temporary admin student data
            const adminStudentData: StudentData = {
              id: user.uid,
              fullNameArabic: 'مدير النظام',
              vehicleNameEnglish: 'Admin',
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
            const studentData = await getStudentData(user.uid);
            setStudent(studentData);
          }
        } catch (error) {
          console.error('Error fetching student data:', error);
          setStudent(null);
        }
      } else {
        setStudent(null);
        setServiceRequests([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to service requests in real-time
  useEffect(() => {
    if (!student?.id) {
      setServiceRequests([]);
      return;
    }

    const unsubscribe = subscribeToServiceRequests(student.id, (requests) => {
      setServiceRequests(requests);
    });

    return () => unsubscribe();
  }, [student?.id]);

  const handleSetStudent = (data: StudentData) => {
    setStudent(data);
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setStudent(null);
      setServiceRequests([]);
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
    serviceRequests,
    addServiceRequest,
    updateServiceRequest,
    getServiceRequest,
    logout: handleLogout
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>جاري التحميل...</div>;
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
