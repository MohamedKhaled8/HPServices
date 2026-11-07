import React from 'react';
import { CheckCircle, XCircle, Clock, FileCheck, FileText } from 'lucide-react';
import { normalizeWorkflowStatus } from '../../../utils/adminRequestsUtils';
export * from './requestsHelpersCore';

export const getStatusBadge = (status: string | undefined): React.ReactNode => {
  const n = normalizeWorkflowStatus(status);
  switch (n) {
    case 'completed':
      return <span className="status-badge status-completed"><CheckCircle size={14} /> مكتمل</span>;
    case 'rejected':
      return <span className="status-badge status-rejected"><XCircle size={14} /> مرفوض</span>;
    case 'submitted':
      return <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '12px', width: 'fit-content', margin: '0 auto' }}><FileCheck size={14} /> تم التقديم</span>;
    case 'receipt_sent':
      return <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #6ee7b7', borderRadius: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '12px', width: 'fit-content', margin: '0 auto' }}><FileText size={14} /> تم إرسال الإيصال</span>;
    default:
      return <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '12px', width: 'fit-content', margin: '0 auto' }}><Clock size={14} /> قيد الانتظار</span>;
  }
};
