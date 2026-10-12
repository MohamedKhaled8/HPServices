import React from 'react';

interface LoadingDotsProps {
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  text,
  className = '',
  fullScreen = false
}) => {
  const content = (
    <div className={`modern-loader ${className}`}>
      <div className="dots-loader" role="status" aria-label="جاري التحميل">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
      {text && <p>{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-container" style={{ position: 'fixed', zIndex: 9999 }}>
        {content}
      </div>
    );
  }

  return content;
};

export default LoadingDots;
