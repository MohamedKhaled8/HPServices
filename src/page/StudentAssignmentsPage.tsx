import React, { useState, useEffect } from 'react';
import { getAssignmentFilesForTrack, TrackKey } from '../services/firebaseService';
import { useStudent } from '../context';
import { ArrowRight, FileText, Download, ExternalLink, Clock, AlertCircle, Folder } from 'lucide-react';
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

            <div className="student-assignments-container">
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
                    <div className="assignments-cards-list">
                        {assignedFiles.map((assignedFile, index) => (
                            <div key={assignedFile.id || index} className="assigned-file-card-responsive">
                                <div className="assignment-card-content">
                                    <div className="assignment-card-icon">
                                        <FileText size={26} />
                                    </div>

                                    <div className="assignment-card-details">
                                        <h3
                                            className="assignment-card-title"
                                            title={`${student?.fullNameArabic || 'طالب'} - ${assignedFile.name}`}
                                        >
                                            {(() => {
                                                const studentName = student?.fullNameArabic || 'طالب';

                                                // 1. New 500 Tier Files (contains our _-_ separator)
                                                if (assignedFile.customName && assignedFile.customName.includes('_-_')) {
                                                    return assignedFile.customName.replace(/_-_/g, ' - ').replace(/_/g, ' ');
                                                }

                                                const cleanStudentName = studentName.replace(/\s+/g, '_');
                                                const fileExtension = assignedFile.name?.includes('.') ? assignedFile.name.substring(assignedFile.name.lastIndexOf('.')) : '';
                                                const oldSystemCustomName = `${cleanStudentName}${fileExtension}`;

                                                // 2. New 300 and 130 Tier Files (customName exists but is NOT the old studentName-only format)
                                                if (assignedFile.customName &&
                                                    assignedFile.customName !== oldSystemCustomName &&
                                                    !assignedFile.customName.includes(cleanStudentName)) {
                                                    return assignedFile.customName;
                                                }

                                                // 3. Fallback for OLD files (where customName was just the student's name)
                                                let storedFileName = assignedFile.name;
                                                const originalNameFromMap = fileMap[assignedFile.id];

                                                if (originalNameFromMap) {
                                                    return `${studentName} - ${originalNameFromMap}`;
                                                }

                                                if (!storedFileName.includes(cleanStudentName) && !storedFileName.includes(studentName)) {
                                                    return `${studentName} - ${storedFileName}`;
                                                }

                                                return storedFileName.replace(/_/g, ' ');
                                            })()}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                            <p className="assignment-card-date" style={{ margin: 0 }}>
                                                تم الإسناد: {assignedFile.assignedAt ? new Date(assignedFile.assignedAt).toLocaleDateString('ar-EG') : 'غير محدد'}
                                            </p>
                                            {(assignedFile.folderName || assignedFile.folderPath) && (
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '11px',
                                                        color: '#4f46e5',
                                                        background: '#eef2ff',
                                                        padding: '1px 8px',
                                                        borderRadius: '6px',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    <Folder size={11} />
                                                    {assignedFile.folderName || (assignedFile.folderPath ? assignedFile.folderPath.split('/').filter(Boolean).pop() : '')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="assignment-card-actions">
                                    <a
                                        href={assignedFile.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="assignment-action-btn view"
                                    >
                                        <ExternalLink size={15} />
                                        عرض
                                    </a>

                                    <a
                                        href={assignedFile.url}
                                        download={assignedFile.customName || assignedFile.name}
                                        onClick={(e) => e.stopPropagation()}
                                        className="assignment-action-btn download"
                                    >
                                        <Download size={15} />
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
