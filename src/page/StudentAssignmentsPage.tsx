import React from 'react';
import { useStudent } from '../context';
import { ArrowRight, FileText, Download, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import '../styles/DashboardPage.css';

interface StudentAssignmentsPageProps {
    onBack: () => void;
}

const StudentAssignmentsPage: React.FC<StudentAssignmentsPageProps> = ({ onBack }) => {
    const { student } = useStudent();
    const assignedFile = student?.assignedFile;

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
                        background: '#EEF2FF',
                        padding: '10px',
                        borderRadius: '10px',
                        color: '#6366F1'
                    }}>
                        <FileText size={24} />
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '20px', color: '#1E293B' }}>التكليفات الخاصة بي</h1>
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748B' }}>عرض وتحميل التكليفات المسندة إليك</p>
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
                    <ArrowRight size={16} />
                    رجوع
                </button>
            </div>

            <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
                {!assignedFile ? (
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
                            <Clock size={30} />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#1E293B' }}>لا يوجد تكليف مسند حالياً</h3>
                        <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
                            سيقوم المسؤول بإسناد تكليف لك قريباً. يرجى المراجعة لاحقاً.
                        </p>
                    </div>
                ) : (
                    <div className="assigned-file-card" style={{
                        background: 'white',
                        borderRadius: '20px',
                        padding: '30px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                        border: '1px solid #E2E8F0',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: '#F5F3FF',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#7C3AED',
                            margin: '0 auto 20px'
                        }}>
                            <FileText size={40} />
                        </div>

                        <h2 style={{ fontSize: '22px', color: '#1E293B', marginBottom: '10px' }}>
                            {assignedFile.name}
                        </h2>

                        <p style={{ color: '#64748B', marginBottom: '30px', fontSize: '15px' }}>
                            تم إسناد هذا التكليف لك بناءً على مسارك الدراسي. يمكنك تحميله أو عرضه عبر الرابط أدناه.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <a
                                href={assignedFile.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    padding: '14px',
                                    background: '#6366F1',
                                    color: 'white',
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    transition: 'background 0.2s'
                                }}
                            >
                                <ExternalLink size={18} />
                                عرض الملف
                            </a>

                            <a
                                href={assignedFile.url}
                                download={assignedFile.name}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    padding: '14px',
                                    background: '#F1F5F9',
                                    color: '#1E293B',
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    transition: 'background 0.2s'
                                }}
                            >
                                <Download size={18} />
                                تحميل
                            </a>
                        </div>

                        <div style={{
                            marginTop: '30px',
                            padding: '15px',
                            background: '#FFFBEB',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: '#92400E',
                            fontSize: '13px',
                            textAlign: 'right'
                        }}>
                            <AlertCircle size={20} style={{ flexShrink: 0 }} />
                            <span>يرجى العمل على هذا التكليف وتسليمه في الموعد المحدد من خلال قسم "تسليم التكاليف".</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAssignmentsPage;
