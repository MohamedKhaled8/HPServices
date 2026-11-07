import { useState, useEffect, useCallback } from 'react';

interface UseAdminStatsLockOptions {
  setToastState?: (toast: { message: string; type: 'success' | 'error' | 'info' | 'loading'; duration?: number } | null) => void;
}

export function useAdminStatsLock(options?: UseAdminStatsLockOptions) {
  const { setToastState } = options || {};
  const [statsUnlocked, setStatsUnlocked] = useState(false);
  const [statsPasswordOpen, setStatsPasswordOpen] = useState(false);
  const [statsPasswordInput, setStatsPasswordInput] = useState('');
  const [statsDateRange, setStatsDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('admin_stats_unlocked_v1');
      if (v === '1') setStatsUnlocked(true);
    } catch {
      // ignore
    }
  }, []);

  const lockStats = useCallback(() => {
    setStatsUnlocked(false);
    setStatsPasswordOpen(false);
    setStatsPasswordInput('');
    try {
      sessionStorage.removeItem('admin_stats_unlocked_v1');
    } catch {
      // ignore
    }
  }, []);

  const maskNumber = useCallback(
    (n: number) => (statsUnlocked ? String(n) : '*****'),
    [statsUnlocked]
  );

  const maskMoney = useCallback(
    (n: number) => (statsUnlocked ? `${Number(n || 0).toLocaleString()} ج.م` : '*****'),
    [statsUnlocked]
  );

  const tryUnlockStats = useCallback(() => {
    const expected = '0100500500@##';
    if (statsPasswordInput === expected) {
      setStatsUnlocked(true);
      setStatsPasswordOpen(false);
      setStatsPasswordInput('');
      try {
        sessionStorage.setItem('admin_stats_unlocked_v1', '1');
      } catch {
        // ignore
      }
      setToastState?.({ message: 'تم إظهار الأرقام.', type: 'success', duration: 2500 });
      return;
    }
    setToastState?.({ message: 'كلمة المرور غير صحيحة.', type: 'error', duration: 3000 });
  }, [statsPasswordInput, setToastState]);

  const handleStatsLockIndicatorClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (statsUnlocked) {
        lockStats();
        setToastState?.({ message: 'تم إخفاء الأرقام.', type: 'success', duration: 2200 });
        return;
      }
      setStatsPasswordOpen((s) => !s);
    },
    [statsUnlocked, lockStats, setToastState]
  );

  const handleStatsLockIndicatorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (statsUnlocked) {
          lockStats();
          return;
        }
        setStatsPasswordOpen((s) => !s);
      }
    },
    [statsUnlocked, lockStats]
  );

  return {
    statsUnlocked,
    setStatsUnlocked,
    statsPasswordOpen,
    setStatsPasswordOpen,
    statsPasswordInput,
    setStatsPasswordInput,
    statsDateRange,
    setStatsDateRange,
    lockStats,
    tryUnlockStats,
    maskNumber,
    maskMoney,
    handleStatsLockIndicatorClick,
    handleStatsLockIndicatorKeyDown
  };
}
