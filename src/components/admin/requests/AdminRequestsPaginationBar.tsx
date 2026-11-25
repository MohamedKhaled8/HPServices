import React from 'react';
import { shouldShowLoadMoreButton, formatPaginationBadge } from '../../../utils/requestsPaginationCore';

export interface AdminRequestsPaginationBarProps {
  isLoadingMore: boolean;
  hasMore: boolean;
  displayCount: number;
  totalCount: number | null;
  onLoadMore: () => void;
  batchSize?: number;
}

export const AdminRequestsPaginationBar: React.FC<AdminRequestsPaginationBarProps> = ({
  isLoadingMore,
  hasMore,
  displayCount,
  totalCount,
  onLoadMore,
  batchSize = 50
}) => {
  const showLoadMore = shouldShowLoadMoreButton(hasMore, displayCount, totalCount);
  const badgeText = formatPaginationBadge(displayCount, totalCount);

  if (!showLoadMore && displayCount === 0 && (totalCount == null || totalCount === 0)) {
    return null;
  }

  return (
    <div
      style={{
        textAlign: 'center',
        margin: '24px 0 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}
    >
      <div
        data-testid="requests-pagination-counter"
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#475569',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          padding: '6px 14px',
          borderRadius: '20px'
        }}
      >
        {badgeText}
      </div>

      {showLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          style={{
            padding: '12px 28px',
            backgroundColor: isLoadingMore ? '#94a3b8' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: isLoadingMore ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            transition: 'all 0.2s ease'
          }}
        >
          <span>
            {isLoadingMore ? 'جاري تحميل الدفعة التالية...' : `تحميل المزيد (+${batchSize} طلب)`}
          </span>
          <span
            style={{
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '20px'
            }}
          >
            {badgeText}
          </span>
        </button>
      )}
    </div>
  );
};

export default AdminRequestsPaginationBar;
