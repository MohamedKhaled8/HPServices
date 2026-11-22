import {
  setDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { getRequestsStatsDocRef } from './requestsStatsService';
import { logger } from '../utils/logger';

/**
 * Atomically increments counters when a new request is submitted.
 */
export const atomicIncrementNewRequest = async (
  serviceId: string,
  status: string = 'pending'
): Promise<void> => {
  try {
    const isPending = status === 'pending' || status === 'submitted' || status === 'in_review';
    const payload: Record<string, any> = {
      total: increment(1),
      [`byService.${serviceId}.total`]: increment(1),
      updatedAt: serverTimestamp()
    };
    if (isPending) {
      payload[`byService.${serviceId}.pending`] = increment(1);
    }
    await setDoc(getRequestsStatsDocRef(), payload, { merge: true });
  } catch (error) {
    logger.warn('atomicIncrementNewRequest notice:', error);
  }
};

/**
 * Atomically updates counters when a request status changes.
 */
export const atomicUpdateStatusCount = async (
  serviceId: string,
  oldStatus?: string,
  newStatus?: string
): Promise<void> => {
  if (!oldStatus || !newStatus || oldStatus === newStatus) return;
  try {
    const wasPending = oldStatus === 'pending' || oldStatus === 'submitted' || oldStatus === 'in_review';
    const isNowPending = newStatus === 'pending' || newStatus === 'submitted' || newStatus === 'in_review';

    if (wasPending === isNowPending) return;

    const payload: Record<string, any> = {
      updatedAt: serverTimestamp()
    };

    if (wasPending && !isNowPending) {
      payload[`byService.${serviceId}.pending`] = increment(-1);
    } else if (!wasPending && isNowPending) {
      payload[`byService.${serviceId}.pending`] = increment(1);
    }

    await setDoc(getRequestsStatsDocRef(), payload, { merge: true });
  } catch (error) {
    logger.warn('atomicUpdateStatusCount notice:', error);
  }
};

/**
 * Atomically decrements counters when a request is deleted.
 */
export const atomicDecrementRequest = async (
  serviceId: string,
  status: string = 'pending'
): Promise<void> => {
  try {
    const isPending = status === 'pending' || status === 'submitted' || status === 'in_review';
    const payload: Record<string, any> = {
      total: increment(-1),
      [`byService.${serviceId}.total`]: increment(-1),
      updatedAt: serverTimestamp()
    };
    if (isPending) {
      payload[`byService.${serviceId}.pending`] = increment(-1);
    }
    await setDoc(getRequestsStatsDocRef(), payload, { merge: true });
  } catch (error) {
    logger.warn('atomicDecrementRequest notice:', error);
  }
};
