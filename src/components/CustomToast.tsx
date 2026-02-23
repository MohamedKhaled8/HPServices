import React, { useEffect } from 'react';
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
    duration = 3000
}) => {
    useEffect(() => {
        if (autoClose) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [autoClose, duration, onClose, type]);

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
