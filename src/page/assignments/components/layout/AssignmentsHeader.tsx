import React from 'react';
import { ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

interface AssignmentsHeaderProps {
  handleBack: () => void;
  assignmentsMessage: string | null;
}

export const AssignmentsHeader: React.FC<AssignmentsHeaderProps> = ({
  handleBack,
  assignmentsMessage,
}) => {
  return (
    <>
      <div className="title-header">
        <h1>إعدادات خدمة التكليفات</h1>
      </div>

      <div className="assignments-header">
        <button onClick={handleBack} className="back-button">
          <ArrowRight size={20} />
          رجوع
        </button>
      </div>

      {assignmentsMessage && (
        <div
          className={`assignments-message ${assignmentsMessage.includes('نجاح') ? 'success' : 'error'
            }`}
        >
          {assignmentsMessage.includes('نجاح') ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{assignmentsMessage}</span>
        </div>
      )}
    </>
  );
};
