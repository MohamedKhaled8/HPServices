import React from 'react';
import { useStudent } from '../context';
import { ServiceRequest } from '../types';
import { SERVICES } from '../constants/services';
import { CheckCircle, ArrowLeft, Package, Clock, Calendar } from 'lucide-react';
import '../styles/DashboardPage.css';

import { subscribeToDigitalTransformationCodes, subscribeToElectronicPaymentCodes } from '../services/firebaseService';

interface ApprovedRequestsPageProps {
    onBack: () => void;
}

const ApprovedRequestsPage: React.FC<ApprovedRequestsPageProps> = ({ onBack }) => {
    const { student, serviceRequests } = useStudent();
    const approvedRequests = serviceRequests.filter((r: ServiceRequest) => r.status === 'completed');
    const [dtCodes, setDtCodes] = React.useState<any[]>([]);
    const [epCodes, setEpCodes] = React.useState<any[]>([]);

    React.useEffect(() => {
        const unsubDt = subscribeToDigitalTransformationCodes((codes) => setDtCodes(codes));
        const unsubEp = subscribeToElectronicPaymentCodes((codes) => setEpCodes(codes));
        return () => { unsubDt(); unsubEp(); };
    }, []);

    // Calculate total spent
    const totalSpent = approvedRequests.reduce((sum, req) => {
        const rawPrice = req.data?.totalPrice || req.data?.price || req.data?.amount || 0;
        const amount = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
        return sum + amount;
    }, 0);

    return (
        <div className="dashboard-page" style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '50px' }}>
            <div className="page-header-simple" style={{
                background: 'white',
                padding: '20px 30px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '30px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{
                        background: '#ECFDF5',
                        padding: '10px',
                        borderRadius: '10px',
                        color: '#10B981'
                    }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px', color: '#1E293B' }}>الطلبات الموافق عليها والتقارير المالية</h1>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748B' }}>سجل بالخدمات المكتملة وإجمالي المدفوعات</p>
                    </div>
                </div>

                <button
                    onClick={onBack}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#64748B'
                    }}
                >
                    <ArrowLeft size={16} />
                    رجوع
                </button>
            </div>

            <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
                {approvedRequests.length > 0 && (
                    <div className="financial-summary-card" style={{
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        borderRadius: '16px',
                        padding: '24px',
                        color: 'white',
                        marginBottom: '30px',
                        boxShadow: '0 10px 20px rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '15px'
                    }}>
                        <div style={{ fontSize: '14px', opacity: 0.9 }}>إجمالي المبالغ المدفوعة عن الخدمات المكتملة</div>
                        <div style={{ fontSize: '32px', fontWeight: '800' }}>{totalSpent.toLocaleString()} ج.م</div>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '5px' }}>
                            <div style={{ fontSize: '13px', padding: '6px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px' }}>
                                عدد الخدمات: {approvedRequests.length}
                            </div>
                        </div>
                    </div>
                )}

                {approvedRequests.length === 0 ? (
                    <div className="no-items-message" style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        background: 'white',
                        borderRadius: '16px',
                        border: '2px dashed #E2E8F0'
                    }}>
                        <div style={{
                            background: '#F1F5F9',
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            color: '#94A3B8'
                        }}>
                            <Package size={30} />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#1E293B' }}>لا توجد طلبات مكتملة</h3>
                        <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
                            لم تقم بطلب أي خدمات أو لم تتم الموافقة على طلباتك بعد. يمكنك متابعة حالة طلباتك من لوحة التحكم.
                        </p>
                    </div>
                ) : (
                    <div className="approved-requests-grid" style={{ display: 'grid', gap: '15px' }}>
                        {approvedRequests.map((req) => {
                            const rawPrice = req.data?.totalPrice || req.data?.price || req.data?.amount || 0;
                            const amount = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

                            return (
                                <div key={req.id} className="approved-request-card" style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: '20px',
                                    border: '1px solid #E2E8F0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'transform 0.2s',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            width: '45px',
                                            height: '45px',
                                            borderRadius: '10px',
                                            background: '#F0FDF4',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#16A34A'
                                        }}>
                                            <CheckCircle size={22} />
                                        </div>
                                        <div>
                                            <h3 style={{ margin: '0 0 5px 0', fontSize: '16px', color: '#1E293B' }}>
                                                {SERVICES.find((s) => s.id === req.serviceId)?.nameAr || `خدمة رقم ${req.serviceId}`}
                                            </h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '15px', fontSize: '12px', color: '#64748B' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={12} />
                                                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString('ar-EG') : '-'}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} />
                                                    {req.createdAt ? new Date(req.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10B981', fontWeight: 'bold' }}>
                                                    {amount.toLocaleString()} ج.م
                                                </span>
                                                {(() => {
                                                    const dtCode = dtCodes.find(c => c.requestId === req.id && (c.fawryCode || c.serialNumber)) || dtCodes.find(c => c.requestId === req.id);
                                                    const epCode = epCodes.find(c => c.requestId === req.id && c.orderNumber) || epCodes.find(c => c.requestId === req.id);

                                                    return (
                                                        <>
                                                            {dtCode && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', padding: '4px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                                    كود فوري: {dtCode.fawryCode || dtCode.serialNumber || 'لا يوجد'}
                                                                </span>
                                                            )}
                                                            {epCode && (
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                                    رقم الطلب: {epCode.orderNumber || 'لا يوجد'}
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                                        <span style={{
                                            background: '#DCFCE7',
                                            color: '#166534',
                                            padding: '6px 14px',
                                            borderRadius: '20px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            <CheckCircle size={10} />
                                            تمت الموافقة
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApprovedRequestsPage;
