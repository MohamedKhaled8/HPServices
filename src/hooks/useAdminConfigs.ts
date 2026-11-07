import { useState, useEffect } from 'react';
import {
  BookServiceConfig,
  AssignmentsServiceConfig,
  FinalReviewConfig,
  StatementEnrollmentConfig
} from '../types';
import {
  subscribeToBookServiceConfig,
  subscribeToAssignmentsServiceConfig,
  subscribeToStatementEnrollmentConfig,
  subscribeToAdminPreferences,
  updateAdminPreferences as fbUpdateAdminPreferences
} from '../services/firebaseService';
import { logger } from '../utils/logger';

interface UseAdminConfigsProps {
  dataReady: boolean;
  isLoading: boolean;
}

export function useAdminConfigs({ dataReady, isLoading }: UseAdminConfigsProps) {
  const [bookConfig, setBookConfig] = useState<BookServiceConfig | null>(null);
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig | null>(null);
  const [finalReviewConfig, setFinalReviewConfig] = useState<FinalReviewConfig | null>(null);
  const [statementEnrollmentConfig, setStatementEnrollmentConfig] = useState<StatementEnrollmentConfig | null>(null);
  const [adminPrefs, setAdminPrefs] = useState<any>({ serviceOrder: [], profitCosts: {} });

  // Lazy subscription to service configs once requests table is ready
  useEffect(() => {
    if (!dataReady || isLoading) return;

    const unsubscribeBook = subscribeToBookServiceConfig((config) => {
      if (config) {
        setBookConfig(config);
      } else {
        setBookConfig({
          serviceName: 'شحن الكتب الدراسية',
          prices: {
            '1': 1750,
            '2': 3440,
            '3': 5160,
            '4': 6820,
            '5': 8450,
            '6': 10200,
            '7': 11885,
            '8': 13580,
            '9': 15210,
            '10': 16900,
            '11': 18500
          },
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        });
      }
    });

    const unsubscribeAssignments = subscribeToAssignmentsServiceConfig((config) => {
      if (config) {
        setAssignmentsConfig(config);
      } else {
        setAssignmentsConfig({
          serviceName: 'حل وتسليم تكاليف الترم الاول',
          assignments: [],
          paymentMethods: { instaPay: '', cashWallet: '01050889591' }
        });
      }
    });

    const unsubscribeStatement = subscribeToStatementEnrollmentConfig((config) => {
      if (config) {
        setStatementEnrollmentConfig(config);
      } else {
        const defaultConfig: StatementEnrollmentConfig = {
          serviceName: 'التقديم علي افادة و اثبات قيد',
          paymentAmount: 400,
          paymentMethods: { instaPay: 'raoufpk97@instapay', cashWallet: '01050889591' }
        };
        setStatementEnrollmentConfig(defaultConfig);
      }
    });

    return () => {
      unsubscribeBook();
      unsubscribeAssignments();
      unsubscribeStatement();
    };
  }, [dataReady, isLoading]);

  // Subscribe to admin preferences
  useEffect(() => {
    const unsubscribe = subscribeToAdminPreferences((prefs) => {
      if (prefs) {
        setAdminPrefs(prefs);
      }
    });
    return () => unsubscribe();
  }, []);

  const updateAdminPreferences = async (newPrefs: any) => {
    try {
      const merged = {
        ...adminPrefs,
        ...newPrefs
      };
      await fbUpdateAdminPreferences(merged);
      setAdminPrefs(merged);
    } catch (error) {
      logger.error('Error saving admin preferences:', error);
      throw error;
    }
  };

  return {
    bookConfig,
    setBookConfig,
    assignmentsConfig,
    setAssignmentsConfig,
    finalReviewConfig,
    setFinalReviewConfig,
    statementEnrollmentConfig,
    setStatementEnrollmentConfig,
    adminPrefs,
    setAdminPrefs,
    updateAdminPreferences
  };
}
