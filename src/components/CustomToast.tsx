import React, { useEffect, useRef } from 'react';
import { CheckCircle, X, Loader2 } from 'lucide-react';
import '../styles/CustomToast.css';

interface CustomToastProps {
    message: string;
    type: 'loading' | 'success' | 'error';
    onClose: () => void;
    autoClose?: boolean;
    duration?: number;
}

const CustomToast: React.FC<CustomToastProps> = ({
    message,
    type,
    onClose,
    autoClose = true,
    duration
}) => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!autoClose) return;
        /* تحميل: لا مهلة افتراضية 3 ث — كانت تُغلق رسالة «جاري الحصول على الكود…» بسرعة.
           إما duration صريح (طويل) من الأب، أو لا إغلاق تلقائي حتى يُمرَّر success/error من الأب */
        const ms =
            duration != null && duration >= 0
                ? duration
                : type === 'loading'
                  ? null
                  : 3000;
        if (ms === null) return;
        const timer = setTimeout(() => onCloseRef.current(), ms);
        return () => clearTimeout(timer);
    }, [autoClose, duration, type]);

    return (
        <div className={`custom-toast custom-toast-${type}`}>
            <div className="custom-toast-content">
                <div className="custom-toast-icon">
                    {type === 'loading' && <Loader2 size={24} className="spinner" />}
                    {type === 'success' && <CheckCircle size={24} />}
                    {type === 'error' && <X size={24} />}
                </div>
                <div className="custom-toast-message">{message}</div>
            </div>
            {type !== 'loading' && (
                <button className="custom-toast-close" onClick={onClose}>
                    <X size={18} />
                </button>
            )}
        </div>
    );
};

export default CustomToast;
