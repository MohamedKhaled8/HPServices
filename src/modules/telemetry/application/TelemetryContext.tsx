import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode
} from 'react';
import type { TelemetryQueryFilter } from '../domain/entities/AuditLogEntry';
import { ManageSessionUseCase } from '../domain/usecases/ManageSessionUseCase';
import { auth } from '../../../config/firebase';
import {
  HttpSessionRepository,
  HttpTelemetryQueryRepository
} from '../infrastructure/repositories/HttpTelemetryRepositories';
import { SupabaseBackupAnalyticsSeeder } from '../infrastructure/seeders/SupabaseBackupAnalyticsSeeder';
import {
  broadcastSessionRevocation,
  getCurrentTrackedSessionId
} from './useAdminSessionGuard';
import {
  initialTelemetryState,
  telemetryReducer,
  type TelemetryDashboardState
} from './telemetryReducer';

export interface TelemetryContextValue {
  readonly state: TelemetryDashboardState;
  readonly updateFilter: (partial: Partial<TelemetryQueryFilter>) => void;
  readonly refreshNow: () => Promise<void>;
  readonly keepSessionAlive: (targetSessionId: string) => Promise<void>;
  readonly revokeSession: (targetSessionId: string, revokeAllTokens: boolean) => Promise<void>;
  readonly seedFromSupabaseBackup: () => Promise<void>;
  readonly setAutoRefreshInterval: (intervalMs: number) => void;
  readonly clearMessages: () => void;
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined);

export const TelemetryProvider: React.FC<{
  children: ReactNode;
  onSelfRevoked?: () => Promise<void> | void;
}> = ({ children, onSelfRevoked }) => {
  const [state, dispatch] = useReducer(telemetryReducer, initialTelemetryState);

  const sessionRepo = useMemo(() => new HttpSessionRepository(), []);
  const queryRepo = useMemo(() => new HttpTelemetryQueryRepository(), []);
  const sessionUseCase = useMemo(() => new ManageSessionUseCase(sessionRepo), [sessionRepo]);

  const fetchSnapshot = useCallback(
    async (isManual: boolean) => {
      dispatch({ type: 'FETCH_START', isManual });
      try {
        const snapshot = await queryRepo.fetchSnapshot(state.filter);
        dispatch({ type: 'FETCH_SUCCESS', payload: snapshot, timestampMs: Date.now() });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'فشل تحميل بيانات المراقبة';
        dispatch({ type: 'FETCH_ERROR', message });
      }
    },
    [queryRepo, state.filter]
  );

  useEffect(() => {
    void fetchSnapshot(false);
  }, [fetchSnapshot]);

  useEffect(() => {
    if (state.autoRefreshIntervalMs <= 0) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchSnapshot(true);
    }, state.autoRefreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [state.autoRefreshIntervalMs, fetchSnapshot]);

  const updateFilter = useCallback((partial: Partial<TelemetryQueryFilter>) => {
    dispatch({ type: 'SET_FILTER', payload: partial });
  }, []);

  const refreshNow = useCallback(async () => {
    await fetchSnapshot(true);
  }, [fetchSnapshot]);

  const keepSessionAlive = useCallback(
    async (targetSessionId: string) => {
      dispatch({ type: 'SESSION_ACTION_START', sessionId: targetSessionId });
      try {
        const updated = await sessionUseCase.keepAlive(targetSessionId);
        dispatch({
          type: 'SESSION_ACTION_SUCCESS',
          session: updated,
          notice: `تم تمديد صلاحية الجلسة (${updated.device.deviceName}) لمدة 30 دقيقة إضافية.`
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'تعذر تمديد الجلسة';
        dispatch({ type: 'SESSION_ACTION_ERROR', message });
      }
    },
    [sessionUseCase]
  );

  const revokeSession = useCallback(
    async (targetSessionId: string, revokeAllTokens: boolean) => {
      dispatch({ type: 'SESSION_ACTION_START', sessionId: targetSessionId });
      try {
        const updated = await sessionUseCase.forceRevoke(targetSessionId, revokeAllTokens);
        broadcastSessionRevocation({
          targetSessionId,
          targetUid: updated.uid,
          revokeAllTokens
        });

        const currentSid = getCurrentTrackedSessionId();
        const currentUid = auth.currentUser?.uid;
        if (
          onSelfRevoked &&
          (targetSessionId === currentSid || (revokeAllTokens && updated.uid === currentUid))
        ) {
          await onSelfRevoked();
          return;
        }

        dispatch({
          type: 'SESSION_ACTION_SUCCESS',
          session: updated,
          notice: `تم إخراج الجهاز (${updated.device.deviceName}) وإلغاء وصوله فوراً.`
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'تعذر إنهاء الجلسة';
        dispatch({ type: 'SESSION_ACTION_ERROR', message });
      }
    },
    [sessionUseCase, onSelfRevoked]
  );

  const seedFromSupabaseBackup = useCallback(async () => {
    dispatch({ type: 'SEED_START' });
    try {
      const res = await SupabaseBackupAnalyticsSeeder.importLatestBackup(queryRepo);
      dispatch({
        type: 'SEED_DONE',
        notice: `تم استيراد ${res.importedCount} سجل إحصائي تاريخي من النسخة (${res.backupName}) بصفر قراءات من Firestore.`
      });
      await fetchSnapshot(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر استيراد بيانات الباك أب من Supabase';
      dispatch({ type: 'SEED_ERROR', message });
    }
  }, [queryRepo, fetchSnapshot]);

  const setAutoRefreshInterval = useCallback((intervalMs: number) => {
    dispatch({ type: 'SET_AUTO_REFRESH', intervalMs });
  }, []);

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const value = useMemo<TelemetryContextValue>(
    () => ({
      state,
      updateFilter,
      refreshNow,
      keepSessionAlive,
      revokeSession,
      seedFromSupabaseBackup,
      setAutoRefreshInterval,
      clearMessages
    }),
    [
      state,
      updateFilter,
      refreshNow,
      keepSessionAlive,
      revokeSession,
      seedFromSupabaseBackup,
      setAutoRefreshInterval,
      clearMessages
    ]
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export function useTelemetryContext(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetryContext must be used inside TelemetryProvider');
  }
  return ctx;
}

