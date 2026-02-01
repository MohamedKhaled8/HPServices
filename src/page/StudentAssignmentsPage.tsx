import React, { useState, useEffect } from 'react';
import { getAssignmentFilesForTrack, TrackKey } from '../services/firebaseService';
import { useStudent } from '../context';
import { ArrowRight, FileText, Download, ExternalLink, Clock, AlertCircle } from 'lucide-react';
import '../styles/DashboardPage.css';
import '../styles/StudentAssignmentsPage.css';

interface StudentAssignmentsPageProps {
    onBack: () => void;
}

const StudentAssignmentsPage: React.FC<StudentAssignmentsPageProps> = ({ onBack }) => {
    const { student } = useStudent();
    const [fileMap, setFileMap] = useState<Record<string, string>>({});
    const assignedFiles = student?.assignedFiles || [];
    const hasFiles = assignedFiles.length > 0;

    useEffect(() => {
        const fetchOriginalFiles = async () => {
            if (!student?.track) return;

            let trackKey: TrackKey | null = null;
            const trackStr = String(student.track || '').toLowerCase();
            if (trackStr.includes('1') || trackStr.includes('الأول')) trackKey = 'track1';
            else if (trackStr.includes('2') || trackStr.includes('الثاني')) trackKey = 'track2';
            else if (trackStr.includes('3') || trackStr.includes('الثالث')) trackKey = 'track3';

            if (trackKey) {
                try {
                    const originalFiles = await getAssignmentFilesForTrack(trackKey);
                    const map: Record<string, string> = {};
                    originalFiles.forEach(f => {
                        map[f.id] = f.name;
                    });
                    setFileMap(map);
                } catch (error) {
                    console.error('Failed to load original file names', error);
                }
            }
        };

        fetchOriginalFiles();
    }, [student?.track]);

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
                        <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748B' }}>
                            {hasFiles ? `لديك ${assignedFiles.length} تكليف` : 'عرض وتحميل التكليفات المسندة إليك'}
                        </p>
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

            <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
                {!hasFiles ? (
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
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {assignedFiles.map((assignedFile, index) => (
                            <div key={assignedFile.id || index} className="assigned-file-card-responsive" style={{
                                background: 'white',
                                borderRadius: '16px',
                                padding: '25px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                border: '1px solid #E2E8F0',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer'
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                                }}
                            >
                                <div className="assignment-card-content">
                                    <div style={{
                                        width: '60px',
                                        height: '60px',
                                        background: '#F5F3FF',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#7C3AED',
                                        flexShrink: 0
                                    }}>
                                        <FileText size={30} />
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{
                                            fontSize: '16px',
                                            color: '#1E293B',
                                            marginBottom: '6px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            direction: 'rtl'
                                        }}
                                            title={`${student?.fullNameArabic || 'طالب'} - ${assignedFile.name}`}
                                        >
                                            {(() => {
                                                const studentName = student?.fullNameArabic || 'طالب';
                                                let storedFileName = assignedFile.name;
                                                const originalNameFromMap = fileMap[assignedFile.id];

                                                // 0. GOLDEN RULE: If we found the original name in the source map (Admin files), USE IT!
                                                if (originalNameFromMap) {
                                                    return `${studentName} - ${originalNameFromMap}`;
                                                }

                                                const cleanStudentName = studentName.replace(/\s+/g, '_');

                                                // 1. Fallback: Check if it's a NEW file (stored name is different from student name)
                                                if (!storedFileName.includes(cleanStudentName) && !storedFileName.includes(studentName)) {
                                                    return `${studentName} - ${storedFileName}`;
                                                }

                                                // 2. Fallback: It's an OLD file and we couldn't find the original name map
                                                // Just show it nicely cleaned up to avoid duplication
                                                return storedFileName.replace(/_/g, ' ');
                                            })()}
                                        </h3>
                                        <p style={{
                                            color: '#64748B',
                                            fontSize: '13px',
                                            margin: 0
                                        }}>
                                            تم الإسناد: {assignedFile.assignedAt ? new Date(assignedFile.assignedAt).toLocaleDateString('ar-EG') : 'غير محدد'}
                                        </p>
                                    </div>
                                </div>

                                <div className="assignment-card-actions" style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                                    <a
                                        href={assignedFile.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 16px',
                                            background: '#6366F1',
                                            color: 'white',
                                            borderRadius: '8px',
                                            textDecoration: 'none',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#4F46E5'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#6366F1'}
                                    >
                                        <ExternalLink size={16} />
                                        عرض
                                    </a>

                                    <a
                                        href={assignedFile.url}
                                        download={assignedFile.customName || assignedFile.name}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            padding: '10px 16px',
                                            background: '#F1F5F9',
                                            color: '#1E293B',
                                            borderRadius: '8px',
                                            textDecoration: 'none',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#E2E8F0'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#F1F5F9'}
                                    >
                                        <Download size={16} />
                                        تحميل
                                    </a>
                                </div>
                            </div>
                        ))}


                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAssignmentsPage;
