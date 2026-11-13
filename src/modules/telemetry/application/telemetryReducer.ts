import type { TelemetryQueryFilter } from '../domain/entities/AuditLogEntry';
import type { TelemetrySession } from '../domain/entities/TelemetrySession';
import type { TelemetryDashboardSnapshot } from '../domain/repositories/ITelemetryRepositories';

export interface TelemetryDashboardState {
  readonly filter: TelemetryQueryFilter;
  readonly snapshot: TelemetryDashboardSnapshot | null;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly isSeeding: boolean;
  readonly activeSessionActionId: string | null;
  readonly autoRefreshIntervalMs: number;
  readonly lastUpdatedAtMs: number | null;
  readonly errorMessage: string | null;
  readonly noticeMessage: string | null;
}

export type TelemetryAction =
  | { type: 'SET_FILTER'; payload: Partial<TelemetryQueryFilter> }
  | { type: 'FETCH_START'; isManual: boolean }
  | { type: 'FETCH_SUCCESS'; payload: TelemetryDashboardSnapshot; timestampMs: number }
  | { type: 'FETCH_ERROR'; message: string }
  | { type: 'SESSION_ACTION_START'; sessionId: string }
  | { type: 'SESSION_ACTION_SUCCESS'; session: TelemetrySession; notice: string }
  | { type: 'SESSION_ACTION_ERROR'; message: string }
  | { type: 'SEED_START' }
  | { type: 'SEED_DONE'; notice: string }
  | { type: 'SEED_ERROR'; message: string }
  | { type: 'SET_AUTO_REFRESH'; intervalMs: number }
  | { type: 'CLEAR_MESSAGES' };

const now = Date.now();

export const initialTelemetryState: TelemetryDashboardState = {
  filter: {
    granularity: 'hour',
    fromMs: now - 30 * 24 * 60 * 60 * 1000,
    toMs: now + 60 * 1000,
    severity: 'all',
    category: 'all',
    search: ''
  },
  snapshot: null,
  isLoading: true,
  isRefreshing: false,
  isSeeding: false,
  activeSessionActionId: null,
  autoRefreshIntervalMs: 0,
  lastUpdatedAtMs: null,
  errorMessage: null,
  noticeMessage: null
};

export function telemetryReducer(
  state: TelemetryDashboardState,
  action: TelemetryAction
): TelemetryDashboardState {
  switch (action.type) {
    case 'SET_FILTER':
      return {
        ...state,
        filter: { ...state.filter, ...action.payload }
      };
    case 'FETCH_START':
      return {
        ...state,
        isLoading: state.snapshot === null && !action.isManual,
        isRefreshing: true,
        errorMessage: null
      };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        snapshot: action.payload,
        isLoading: false,
        isRefreshing: false,
        lastUpdatedAtMs: action.timestampMs,
        errorMessage: null
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        isLoading: false,
        isRefreshing: false,
        errorMessage: action.message
      };
    case 'SESSION_ACTION_START':
      return {
        ...state,
        activeSessionActionId: action.sessionId,
        errorMessage: null,
        noticeMessage: null
      };
    case 'SESSION_ACTION_SUCCESS': {
      const nextSessions = state.snapshot
        ? state.snapshot.sessions.map((s) =>
            s.sessionId === action.session.sessionId ? action.session : s
          )
        : [];
      return {
        ...state,
        activeSessionActionId: null,
        noticeMessage: action.notice,
        snapshot: state.snapshot
          ? {
              ...state.snapshot,
              sessions: nextSessions,
              summary: {
                ...state.snapshot.summary,
                activeSessions: nextSessions.filter((s) => s.status === 'active').length
              }
            }
          : null
      };
    }
    case 'SESSION_ACTION_ERROR':
      return {
        ...state,
        activeSessionActionId: null,
        errorMessage: action.message
      };
    case 'SEED_START':
      return {
        ...state,
        isSeeding: true,
        errorMessage: null,
        noticeMessage: null
      };
    case 'SEED_DONE':
      return {
        ...state,
        isSeeding: false,
        noticeMessage: action.notice
      };
    case 'SEED_ERROR':
      return {
        ...state,
        isSeeding: false,
        errorMessage: action.message
      };
    case 'SET_AUTO_REFRESH':
      return {
        ...state,
        autoRefreshIntervalMs: action.intervalMs
      };
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        errorMessage: null,
        noticeMessage: null
      };
  }
}

