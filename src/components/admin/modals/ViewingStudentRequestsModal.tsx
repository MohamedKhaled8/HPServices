import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ClipboardList, FileText, Loader2 } from 'lucide-react';
import { StudentData, ServiceRequest } from '../../../types';
import { normalizeTrackName } from '../../../utils/trackUtils';
import { normalizePhone } from '../../../utils/requestsSearchCore';
import { db } from '../../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { syncStudentRequestCount } from '../../../services/studentRequestsCountService';

interface ViewingStudentRequestsModalProps {
  student: StudentData | null;
  onClose: () => void;
  studentRequests: ServiceRequest[];
  getServiceName: (serviceId: string) => string;
  getStatusBadge: (status: string | undefined) => React.ReactNode;
  translateKey: (key: string) => string;
}

const doesRequestMatchStudent = (req: ServiceRequest, student: StudentData): boolean => {
  if (!student || !req) return false;
  // 1. Direct studentId match
  if (student.id && req.studentId === student.id) return true;
  if (student.legacyId && req.studentId === student.legacyId) return true;

  // 2. Email match
  const sEmail = (student.email || '').trim().toLowerCase();
  if (sEmail) {
    if ((req.studentId || '').trim().toLowerCase() === sEmail) return true;
    if (((req as any).email || '').trim().toLowerCase() === sEmail) return true;
    if ((req.data?.email || '').trim().toLowerCase() === sEmail) return true;
    if ((req.data?.student_email || '').trim().toLowerCase() === sEmail) return true;
  }

  // 3. Phone match
  const sPhone = normalizePhone(student.whatsappNumber || (student as any).phone || '');
  if (sPhone && sPhone.length >= 8) {
    const candidatePhones = [
      req.data?.whatsapp_number,
      req.data?.whatsappNumber,
      req.data?.phone,
      req.data?.phone_whatsapp,
      req.data?.leader_whatsapp,
      (req as any).phone,
      (req as any).whatsapp,
    ];
    for (const cp of candidatePhones) {
      if (cp) {
        const normCP = normalizePhone(String(cp));
        if (normCP && (normCP === sPhone || normCP.endsWith(sPhone) || sPhone.endsWith(normCP))) {
          return true;
        }
      }
    }
  }

  // 4. National ID match if present
  const sNatId = String(student.nationalID || (student as any).national_id || '').trim();
  if (sNatId && sNatId.length >= 10) {
    const reqNatId = String(req.data?.national_id || req.data?.nationalID || req.data?.nationalId || '').trim();
    if (reqNatId && reqNatId === sNatId) return true;
  }

  return false;
};

const ViewingStudentRequestsModal: React.FC<ViewingStudentRequestsModalProps> = ({
  student,
  onClose,
  studentRequests,
  getServiceName,
  getStatusBadge,
  translateKey
}) => {
  const [fetchedRequests, setFetchedRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fetchedStudentIdRef = useRef<string | null>(null);

  const studentPrimitiveId = student?.id || student?.email || '';

  useEffect(() => {
    if (!studentPrimitiveId) {
      fetchedStudentIdRef.current = null;
      setFetchedRequests([]);
      setIsLoading(false);
      return;
    }

    if (fetchedStudentIdRef.current === studentPrimitiveId) {
      return;
    }
    fetchedStudentIdRef.current = studentPrimitiveId;

    let cancelled = false;
    setIsLoading(true);

    const loadStudentOrders = async () => {
      try {
        const colNames = [
          'serviceRequests_1',
          'serviceRequests_2',
          'serviceRequests_3',
          'serviceRequests_4',
          'serviceRequests_5',
          'serviceRequests_6',
          'serviceRequests_7',
          'serviceRequests_8',
          'serviceRequests_9',
          'serviceRequests_10',
          'serviceRequests_11',
          'serviceRequests_12',
          'serviceRequests',
        ];

        const fetchPromises: Promise<any>[] = [];
        const targetStudentId = student?.id;
        const targetEmail = (student?.email || '').trim().toLowerCase();
        const targetLegacyId = (student as any)?.legacyId;

        for (const colName of colNames) {
          const colRef = collection(db, colName);

          if (targetStudentId) {
            fetchPromises.push(getDocs(query(colRef, where('studentId', '==', targetStudentId))).catch(() => null));
          }
          if (targetEmail && targetEmail !== targetStudentId) {
            fetchPromises.push(getDocs(query(colRef, where('studentId', '==', targetEmail))).catch(() => null));
            fetchPromises.push(getDocs(query(colRef, where('email', '==', targetEmail))).catch(() => null));
            fetchPromises.push(getDocs(query(colRef, where('data.email', '==', targetEmail))).catch(() => null));
          }
          if (targetLegacyId && targetLegacyId !== targetStudentId) {
            fetchPromises.push(getDocs(query(colRef, where('studentId', '==', targetLegacyId))).catch(() => null));
          }
        }

        if (targetStudentId) {
          for (let sId = 1; sId <= 12; sId++) {
            const docRef = doc(db, `serviceRequests_${sId}`, `real_cld_${sId}_${targetStudentId}`);
            fetchPromises.push(getDoc(docRef).catch(() => null));
          }
        }

        const snapshots = await Promise.all(fetchPromises);
        if (cancelled) return;

        const collected: ServiceRequest[] = [];
        for (const snap of snapshots) {
          if (!snap) continue;
          if ('docs' in snap && Array.isArray((snap as any).docs)) {
            for (const d of (snap as any).docs) {
              if (d && typeof d.data === 'function') {
                const data = d.data();
                collected.push({
                  ...data,
                  id: d.id,
                  createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
                } as ServiceRequest);
              }
            }
          } else if ('exists' in snap && typeof (snap as any).exists === 'function' && (snap as any).exists()) {
            const data = (snap as any).data();
            collected.push({
              ...data,
              id: (snap as any).id,
              createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
            } as ServiceRequest);
          }
        }

        if (!cancelled) {
          setFetchedRequests(collected);
        }
      } catch (err) {
        console.error('Error fetching student service requests:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadStudentOrders();

    return () => {
      cancelled = true;
    };
  }, [studentPrimitiveId]);

  const displayList = useMemo(() => {
    if (!student) return [];
    const mergedMap = new Map<string, ServiceRequest>();

    // 1) Keep any existing passed studentRequests
    if (Array.isArray(studentRequests)) {
      for (const req of studentRequests) {
        if (req && doesRequestMatchStudent(req, student)) {
          const key = req.id || `req_${req.serviceId}_${req.createdAt || Math.random()}`;
          mergedMap.set(key, req);
        }
      }
    }

    // 2) Merge newly fetched orders
    for (const req of fetchedRequests) {
      if (req && doesRequestMatchStudent(req, student)) {
        const key = req.id || `req_${req.serviceId}_${req.createdAt || Math.random()}`;
        mergedMap.set(key, req);
      }
    }

    return Array.from(mergedMap.values());
  }, [student, studentRequests, fetchedRequests]);

  useEffect(() => {
    if (student?.id && !isLoading) {
      syncStudentRequestCount(student.id, displayList.length);
    }
  }, [student?.id, displayList.length, isLoading]);

  if (!student) return null;

  return (
    <div className="request-modal-overlay" onClick={onClose}>
      <div className="request-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
          <div>
            <h2 style={{ margin: 0 }}>جميع طلبات: {student.fullNameArabic}</h2>
            <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '14px' }}>
              {student.email} • {displayList.length} طلب
            </p>
          </div>
          <button onClick={onClose} className="close-button" type="button">
            <X size={24} />
          </button>
        </div>
        <div className="modal-content" style={{ padding: '20px' }}>
          {isLoading && displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <Loader2 className="animate-spin" size={36} style={{ margin: '0 auto 12px' }} />
              <p>جاري تحميل طلبات المشترك من قاعدة البيانات...</p>
            </div>
          ) : displayList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p style={{ fontSize: '16px' }}>لا توجد طلبات مسجلة لهذا المستخدم</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {displayList
                .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
                .map((req, idx) => (
                  <div key={req.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{getServiceName(req.serviceId)}</h3>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'بدون تاريخ'}
                        </span>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                        {Object.entries(req.data || {}).map(([key, value]) => {
                          const stringValue = String(value || '').trim();

                          if (key === 'selectedCertificate') {
                            return (
                              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{translateKey(key)}:</span>
                                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                                  {typeof value === 'object' && value !== null ? (value as any).name : stringValue}
                                </span>
                              </div>
                            );
                          }

                          if (key === 'student_names' || key === 'names_array') {
                            const names = typeof value === 'string' ? value.split('\n').filter(Boolean) : Array.isArray(value) ? value : [];
                            if (names.length === 0) return null;
                            return (
                              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{translateKey(key)}:</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {names.map((name: string, i: number) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: key === 'student_names' ? '#f8fafc' : '#f0fdf4', borderRadius: '6px', border: `1px solid ${key === 'student_names' ? '#e2e8f0' : '#bbf7d0'}` }}>
                                      <span style={{ fontSize: '12px', color: '#64748b' }}>#{i + 1}</span>
                                      <span style={{ fontWeight: '600', color: key === 'student_names' ? '#1e293b' : '#166534' }}>{name || 'بدون اسم'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          if (key === 'receiptUrl' || key === 'tracks_array' || key === 'selectedAssignmentsData' || key === 'selectedTransformationType' || typeof value === 'object' || !stringValue || stringValue === 'undefined' || stringValue === 'null') return null;

                          return (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{translateKey(key)}:</span>
                              <span style={{ fontSize: '14px', color: '#0f172a' }}>
                                {key === 'wantsMalazem' ? (value ? 'نعم ✅' : 'لا') : (key.includes('track') ? normalizeTrackName(stringValue) : stringValue)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {req.paymentMethod && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px' }}>
                          <strong>طريقة الدفع:</strong> {req.paymentMethod}
                        </div>
                      )}
                      {req.documents && req.documents.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>المرفقات ({req.documents.length}):</span>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {req.documents.map((doc, dIdx) => {
                              const docUrl = doc.url || '';
                              const isPdfDoc =
                                docUrl.toLowerCase().includes('.pdf') ||
                                (doc.type && doc.type.toUpperCase() === 'PDF');
                              const openUrl = isPdfDoc
                                ? `https://docs.google.com/viewer?url=${encodeURIComponent(docUrl)}&embedded=false`
                                : docUrl;
                              return (
                                <a
                                  key={dIdx}
                                  href={openUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '6px 12px',
                                    background: isPdfDoc ? '#fef2f2' : '#eff6ff',
                                    color: isPdfDoc ? '#dc2626' : '#2563eb',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    textDecoration: 'none',
                                    border: `1px solid ${isPdfDoc ? '#fecaca' : '#bfdbfe'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <FileText size={14} />
                                  {isPdfDoc ? '📄 ' : ''}{doc.name || `مرفق ${dIdx + 1}`}
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewingStudentRequestsModal;
