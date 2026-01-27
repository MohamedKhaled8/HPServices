import React from 'react';
import { useStudent } from '../context';
import { BookOpen, AlertCircle, Download, FileText, ArrowLeft, Eye } from 'lucide-react';
import '../styles/DashboardPage.css'; // Reuse existing styles or create new one

interface StudentAssignmentsPageProps {
    onBack: () => void;
}

const StudentAssignmentsPage: React.FC<StudentAssignmentsPageProps> = ({ onBack }) => {
    const { student } = useStudent();

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
                        color: '#4F46E5'
                    }}>
                        <BookOpen size={24} />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '20px', color: '#1E293B' }}>التكليفات الدراسية</h1>
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
                {student?.assignedFile ? (
                    <div className="assignment-card" style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '30px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                        border: '1px solid #E2E8F0'
                    }}>
                        <div className="assignment-info-main" style={{ marginBottom: '25px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '10px'
                            }}>
                                <FileText size={24} color="#4F46E5" />
                                <h2 className="assignment-title" style={{ margin: 0, fontSize: '22px' }}>
                                    {student.assignedFile.name}
                                </h2>
                            </div>
                            <div className="assignment-meta" style={{
                                background: '#F1F5F9',
                                display: 'inline-block',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '14px',
                                color: '#475569',
                                marginTop: '10px'
                            }}>
                                المسار: <strong>{student.assignedFile.track}</strong>
                            </div>
                        </div>

                        <div className="assignment-description" style={{
                            background: '#FFFBEB',
                            border: '1px solid #FEF3C7',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '25px',
                            color: '#92400E',
                            fontSize: '14px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start'
                        }}>
                            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <p style={{ margin: 0 }}>
                                هذا هو ملف التكليفات المخصص لك بناءً على مسارك الدراسي. يرجى تحميله والبدء في تنفيذه وتسليمه قبل الموعد المحدد.
                            </p>
                        </div>

                        <div className="assignment-actions" style={{ display: 'flex', gap: '15px' }}>
                            <a
                                href={student.assignedFile.url}
                                target="_blank"
                                rel="noreferrer"
                                className="assignment-button primary"
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: '#4F46E5',
                                    color: 'white',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    transition: 'background 0.2s'
                                }}
                            >
                                <Eye size={18} />
                                مشاهدة الملف
                            </a>
                            <a
                                href={student.assignedFile.url}
                                target="_blank"
                                rel="noreferrer"
                                className="assignment-button ghost"
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    background: 'white',
                                    border: '2px solid #E2E8F0',
                                    color: '#1E293B',
                                    padding: '12px',
                                    borderRadius: '10px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Download size={18} />
                                تحميل PDF
                            </a>
                        </div>
                    </div>
                ) : (
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
                            <BookOpen size={30} />
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', color: '#1E293B' }}>لا يوجد تكليفات حالياً</h3>
                        <p style={{ color: '#64748B', maxWidth: '400px', margin: '0 auto' }}>
                            لم يتم تخصيص أي ملف تكاليف لك بعد. سيتم إظهار الملف هنا بمجرد توزيعه من قِبل الإدارة.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAssignmentsPage;
