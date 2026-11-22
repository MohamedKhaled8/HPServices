import { useEffect, useRef } from 'react';
import { auth } from '../../../config/firebase';
import { DeviceTelemetryParser } from '../infrastructure/parsers/DeviceTelemetryParser';
import { HttpSessionRepository } from '../infrastructure/repositories/HttpTelemetryRepositories';
import { ManageSessionUseCase } from '../domain/usecases/ManageSessionUseCase';

const SESSION_STORAGE_KEY = 'hp_admin_telemetry_session_id';
const REGISTERED_FLAG_KEY = 'hp_admin_telemetry_session_registered';
const CONTROL_CHANNEL_NAME = 'hp_telemetry_control';
const HEARTBEAT_INTERVAL_MS = 20_000;
const inFlightRegistrations = new Set<string>();

export function getCurrentTrackedSessionId(): string | null {
  try {
    return (
      localStorage.getItem(SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(SESSION_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function broadcastSessionRevocation(payload: {
  targetSessionId: string;
  targetUid: string;
  revokeAllTokens: boolean;
}): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CONTROL_CHANNEL_NAME);
    ch.postMessage({ type: 'REVOKE_SESSION', ...payload });
    ch.close();
  } catch {
    // Ignore unsupported BroadcastChannel
  }
}

function getOrCreateSessionId(uid: string): string {
  try {
    const existing =
      localStorage.getItem(SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && existing.startsWith(`sess_${uid.slice(0, 6)}_`)) {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, existing);
        sessionStorage.setItem(SESSION_STORAGE_KEY, existing);
      } catch {}
      return existing;
    }
    const created = `sess_${uid.slice(0, 6)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, created);
      sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    } catch {}
    return created;
  } catch {
    return `sess_${uid.slice(0, 6)}_${Date.now()}`;
  }
}

export function clearTrackedSessionId(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(REGISTERED_FLAG_KEY);
  } catch {
    // Ignore storage restriction
  }
}

/**
 * Registers the active Admin device session in the isolated telemetry store
 * and enforces immediate remote revocation across tabs and devices.
 */
export function useAdminSessionGuard(
  enabled: boolean,
  onForceLogout: () => Promise<void> | void
): string | null {
  const sessionIdRef = useRef<string | null>(getCurrentTrackedSessionId());
  const logoutCbRef = useRef(onForceLogout);
  logoutCbRef.current = onForceLogout;

  useEffect(() => {
    if (!enabled) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const repo = new HttpSessionRepository();
    const sessionId = getOrCreateSessionId(currentUser.uid);
    sessionIdRef.current = sessionId;
    let isCancelled = false;

    const triggerForcedExit = async () => {
      if (isCancelled) return;
      isCancelled = true;
      clearTrackedSessionId();
      await logoutCbRef.current();
    };

    const register = async () => {
      try {
        if (
          inFlightRegistrations.has(sessionId) ||
          sessionStorage.getItem(REGISTERED_FLAG_KEY) === sessionId
        ) {
          return;
        }
        inFlightRegistrations.add(sessionId);
        const device = DeviceTelemetryParser.capture();
        const timezone = DeviceTelemetryParser.getTimezone();
        await repo.registerSession(sessionId, device, timezone);
        sessionStorage.setItem(REGISTERED_FLAG_KEY, sessionId);
      } catch {
        // Non-blocking registration if telemetry endpoint is temporarily unreachable
      } finally {
        inFlightRegistrations.delete(sessionId);
      }
    };

    void register();

    const checkHeartbeat = async () => {
      if (isCancelled) return;
      try {
        const res = await repo.heartbeat(sessionId);
        if (ManageSessionUseCase.shouldTriggerLogout(res)) {
          await triggerForcedExit();
          return;
        }

        if (ManageSessionUseCase.shouldReRegister(res)) {
          sessionStorage.removeItem(REGISTERED_FLAG_KEY);
          void register();
        }
      } catch {
        // Network drops, offline sleep, or 5xx: keep session alive locally
      }
    };

    const timer = window.setInterval(() => {
      void checkHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    let lastVisibilityCheck = 0;
    const onVisibilityChange = () => {
      const now = Date.now();
      if (
        typeof document !== 'undefined' &&
        !document.hidden &&
        now - lastVisibilityCheck > 10_000
      ) {
        lastVisibilityCheck = now;
        void checkHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CONTROL_CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<unknown>) => {
          const msg = event.data as {
            type?: string;
            targetSessionId?: string;
            targetUid?: string;
            revokeAllTokens?: boolean;
          } | null;
          if (!msg || msg.type !== 'REVOKE_SESSION') return;
          if (
            msg.targetSessionId === sessionId ||
            (msg.revokeAllTokens && msg.targetUid === currentUser.uid)
          ) {
            void triggerForcedExit();
          }
        };
      }
    } catch {
      channel = null;
    }

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      if (channel) channel.close();
    };
  }, [enabled]);

  return sessionIdRef.current || getCurrentTrackedSessionId();
}
