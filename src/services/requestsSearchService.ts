import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ServiceRequest } from '../types';
import { setDbFetchers } from '../utils/requestsSearchCore';

const defaultFetchBatch = async (serviceId: string, maxLimit: number): Promise<ServiceRequest[]> => {
  const collName = `serviceRequests_${serviceId}`;
  const q = query(collection(db, collName), orderBy('createdAt', 'desc'), limit(maxLimit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      serviceId,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
    } as ServiceRequest;
  });
};

const defaultGetDoc = async (serviceId: string, docId: string): Promise<ServiceRequest | null> => {
  const collName = `serviceRequests_${serviceId}`;
  const d = await getDoc(doc(db, collName, docId));
  if (!d.exists()) return null;
  const data = d.data();
  return {
    ...data,
    id: d.id,
    serviceId,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  } as ServiceRequest;
};

// Wire production Firestore fetchers by default
setDbFetchers(defaultFetchBatch, defaultGetDoc);

export * from '../utils/requestsSearchCore';
