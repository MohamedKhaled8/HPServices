import React from 'react';

interface PaperPlaneAnimationProps {
  showPaperPlane: boolean;
}

export const PaperPlaneAnimation: React.FC<PaperPlaneAnimationProps> = ({
  showPaperPlane,
}) => {
  if (!showPaperPlane) return null;

  return (
        <div className="paper-plane-container">
          <div className="paper-plane">✈️</div>
        </div>
  );
};
