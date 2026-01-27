import React from 'react';
import { useStudent } from '../context';
import { ServiceRequest } from '../types';
import { SERVICES } from '../constants/services';
import { CheckCircle, ArrowLeft, Package, Clock, Calendar } from 'lucide-react';
import '../styles/DashboardPage.css';

interface ApprovedRequestsPageProps {
    onBack: () => void;
}

const ApprovedRequestsPage: React.FC<ApprovedRequestsPageProps> = ({ onBack }) => {
    const { serviceRequests } = useStudent();
    const approvedRequests = serviceRequests.filter((r: ServiceRequest) => r.status === 'completed');

    return (
        <div className="dashboard-page" style={{ minHeight: '100vh', background: '#f8fafc' }}>
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
                        <h1 style={{ margin: 0, fontSize: '20px', color: '#1E293B' }}>الطلبات الموافق عليها</h1>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748B' }}>سجل بجميع الخدمات التي تم الانتهاء منها</p>
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
                        {approvedRequests.map((req) => (
                            <div key={req.id} className="approved-request-card" style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid #E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'transform 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '12px', color: '#64748B' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Calendar size={12} />
                                                {req.createdAt ? new Date(req.createdAt).toLocaleDateString('ar-EG') : '-'}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Clock size={12} />
                                                {req.createdAt ? new Date(req.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <span style={{
                                    background: '#DCFCE7',
                                    color: '#166534',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    تمت الموافقة
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApprovedRequestsPage;
