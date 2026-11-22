import { useState, useEffect } from 'react';
import type { ServiceRequest } from '../types';
import {
  subscribeToServiceRequests,
  addServiceRequest as addServiceRequestToFirebase,
  type AdminRole
} from '../services/firebaseService';

export const useServiceRequestsManager = (
  studentId: string | undefined,
  adminRole: AdminRole
) => {
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);

  useEffect(() => {
    if (!studentId || adminRole !== 'student') {
      setServiceRequests([]);
      return;
    }

    const unsubscribe = subscribeToServiceRequests(studentId, (requests) => {
      setServiceRequests(requests);
    });

    return () => unsubscribe();
  }, [studentId, adminRole]);

  const addServiceRequest = async (request: ServiceRequest) => {
    try {
      await addServiceRequestToFirebase(request);
    } catch (error) {
      console.error('Error adding service request:', error);
      throw error;
    }
  };

  const updateServiceRequest = (id: string, updatedData: Partial<ServiceRequest>) => {
    setServiceRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, ...updatedData } : req))
    );
  };

  const getServiceRequest = (id: string) => {
    return serviceRequests.find((req) => req.id === id);
  };

  return {
    serviceRequests,
    setServiceRequests,
    addServiceRequest,
    updateServiceRequest,
    getServiceRequest
  };
};
