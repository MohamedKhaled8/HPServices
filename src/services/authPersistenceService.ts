import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onIdTokenChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase.ts';
import type { StudentData } from '../types/index.ts';
import type { AdminRole } from './firebaseService.ts';
import { logger } from '../utils/logger.ts';

const PERSISTED_SESSION_KEY = 'hp_auth_session_v2';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days active lease
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiration

export interface PersistedAuthSession {
  uid: string;
  email: string;
  role: AdminRole;
  student: StudentData | null;
  savedAt: number;
}

export const configureAuthPersistence = async (remember = true): Promise<void> => {
  try {
    const mode = remember ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, mode);
  } catch (error) {
    logger.warn('Failed to configure auth persistence, using default:', error);
  }
};

export const savePersistedSession = (
  user: { uid?: string; email?: string | null },
  role: AdminRole,
  student: StudentData | null
): void => {
  try {
    const uid = user.uid || student?.id || '';
    if (!uid) return;
    const session: PersistedAuthSession = {
      uid,
      email: user.email || student?.email || '',
      role,
      student,
      savedAt: Date.now()
    };
    localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    logger.warn('Could not save persisted session to localStorage:', error);
  }
};

export const getPersistedSession = (): PersistedAuthSession | null => {
  try {
    const raw = localStorage.getItem(PERSISTED_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PersistedAuthSession;
    if (!session || !session.uid || typeof session.uid !== 'string') return null;

    const isAdmin = session.role === 'primary_admin' || session.role === 'telemetry_admin';
    // Admins NEVER auto-logout on client time lease
    if (!isAdmin && Date.now() - session.savedAt > SESSION_MAX_AGE_MS) {
      clearPersistedSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

export const touchPersistedSession = (): void => {
  try {
    const session = getPersistedSession();
    if (session) {
      session.savedAt = Date.now();
      localStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors on touch
  }
};

export const clearPersistedSession = (): void => {
  try {
    localStorage.removeItem(PERSISTED_SESSION_KEY);
    localStorage.removeItem('hp_admin_telemetry_session_id');
    sessionStorage.removeItem('hp_admin_telemetry_session_id');
    sessionStorage.removeItem('hp_admin_telemetry_session_registered');
    sessionStorage.removeItem('hp_telemetry_hmac_token');
  } catch {
    // Ignore storage errors on cleanup
  }
};

export const setupSilentTokenRefresh = (
  onTokenRefreshed?: (token: string) => void
): (() => void) => {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let isCancelled = false;

  const scheduleRefresh = async (user: FirebaseUser) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (isCancelled) return;

    try {
      touchPersistedSession();
      const tokenResult = await user.getIdTokenResult();
      const expTime = new Date(tokenResult.expirationTime).getTime();
      const now = Date.now();
      const delay = Math.max(10_000, expTime - now - REFRESH_MARGIN_MS);

      refreshTimer = setTimeout(async () => {
        if (isCancelled) return;
        try {
          const freshToken = await user.getIdToken(true);
          onTokenRefreshed?.(freshToken);
          void scheduleRefresh(user);
        } catch (err) {
          logger.warn('Silent token renewal retry scheduled:', err);
          refreshTimer = setTimeout(() => void scheduleRefresh(user), 30_000);
        }
      }, delay);
    } catch (err) {
      logger.warn('Failed calculating token expiration:', err);
    }
  };

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && !document.hidden && auth.currentUser) {
      void auth.currentUser.getIdTokenResult().then((res) => {
        const expTime = new Date(res.expirationTime).getTime();
        if (expTime - Date.now() < REFRESH_MARGIN_MS) {
          void auth.currentUser?.getIdToken(true).then((t) => onTokenRefreshed?.(t));
        }
      }).catch(() => {});
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  const unsubscribe = onIdTokenChanged(auth, (user) => {
    if (user) {
      void scheduleRefresh(user);
    } else if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  });

  return () => {
    isCancelled = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    unsubscribe();
  };
};
