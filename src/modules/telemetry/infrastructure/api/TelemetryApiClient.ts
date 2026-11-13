import { auth } from '../../../../config/firebase';

export class TelemetryApiClient {
  private static getEndpoints(path: string): string[] {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const envUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const candidates = [cleanPath];
    const isLocalClient =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isEnvLocal = /localhost|127\.0\.0\.1/i.test(envUrl);

    if (
      envUrl &&
      typeof window !== 'undefined' &&
      !envUrl.startsWith(window.location.origin) &&
      (!isEnvLocal || isLocalClient)
    ) {
      candidates.push(`${envUrl}${cleanPath}`);
    }
    return candidates;
  }

  private static async getBearerToken(forceRefresh = false): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      return await user.getIdToken(forceRefresh);
    } catch {
      return null;
    }
  }

  static async request<TResponse>(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      requireAuth?: boolean;
      keepalive?: boolean;
      telemetryToken?: string | null;
    } = {}
  ): Promise<TResponse> {
    const method = options.method || 'GET';
    const requireAuth = options.requireAuth !== false;
    const token = await this.getBearerToken();

    if (requireAuth && !token) {
      throw new Error('غير مصرح: يجب تسجيل الدخول أولاً');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Telemetry-Client': 'hp-telemetry-v1'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.telemetryToken) headers['X-Telemetry-Token'] = options.telemetryToken;

    const endpoints = this.getEndpoints(path);
    let lastError: Error = new Error('تعذر الاتصال بخادم المراقبة');

    for (const url of endpoints) {
      let receivedJsonApiError = false;
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: method === 'POST' ? JSON.stringify(options.body || {}) : undefined,
          keepalive: options.keepalive,
          signal: options.keepalive ? undefined : AbortSignal.timeout(10000)
        });

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          lastError = new Error(`استجابة غير صالحة من الخادم (${res.status})`);
          continue;
        }

        const data = (await res.json()) as TResponse & { error?: string };
        if (!res.ok) {
          receivedJsonApiError = true;
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        return data;
      } catch (err: unknown) {
        const parsedErr = err instanceof Error ? err : new Error(String(err));
        if (receivedJsonApiError) {
          throw parsedErr;
        }
        lastError = parsedErr;
      }
    }

    throw lastError;
  }
}
