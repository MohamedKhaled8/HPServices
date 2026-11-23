import { logger } from '../utils/logger.ts';
import { getOrFetchDriveToken, invalidateDriveToken } from './driveTokenCache.ts';

const DRIVE_TIMEOUT_MS = 8000;

export { invalidateDriveToken };

export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = DRIVE_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

export const extractDriveFileId = (fileIdOrUrl: string): string | null => {
  if (!fileIdOrUrl || typeof fileIdOrUrl !== 'string') return null;
  const trimmed = fileIdOrUrl.trim();
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  const pathMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];
  if (!trimmed.includes('/') && !trimmed.includes('?') && /^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

export const getGoogleDriveAccessToken = async (timeoutMs = DRIVE_TIMEOUT_MS): Promise<string> => {
  return getOrFetchDriveToken(async () => {
    // 1. Try secure backend token dispenser (/api/getDriveToken)
    try {
      const apiResponse = await fetchWithTimeout(
        '/api/getDriveToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
        timeoutMs
      );
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        if (data.accessToken) {
          return { accessToken: data.accessToken, expiresIn: data.expiresIn };
        }
      }
    } catch (_) {
      // Backend endpoint not reachable (e.g. standalone Vite dev server)
    }

    // 2. Direct client-side refresh fallback
    const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = import.meta.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google Drive credentials not configured');
    }

    const tokenResponse = await fetchWithTimeout(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      },
      timeoutMs
    );

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}));
      const errMessage = errData.error_description || errData.error || tokenResponse.statusText;
      throw new Error(`Failed to get Google Drive access token: ${errMessage}`);
    }

    const tokenData = await tokenResponse.json();
    return { accessToken: tokenData.access_token, expiresIn: tokenData.expires_in };
  });
};

export const deleteFromGoogleDrive = async (
  fileIdOrUrl: string,
  timeoutMs = DRIVE_TIMEOUT_MS
): Promise<boolean> => {
  try {
    const fileId = extractDriveFileId(fileIdOrUrl);
    if (!fileId) {
      logger.warn('Google Drive delete: unable to extract file ID from', fileIdOrUrl);
      return false;
    }

    let accessToken: string;
    try {
      accessToken = await getGoogleDriveAccessToken(timeoutMs);
    } catch (authError) {
      logger.warn('Google Drive delete: failed to obtain token', authError);
      return false;
    }

    const res = await fetchWithTimeout(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      timeoutMs
    );

    // 204 = deleted, 404 = already deleted/gone
    if (res.ok || res.status === 404) {
      return true;
    }

    logger.warn(`Google Drive delete returned status ${res.status} for fileId ${fileId}`);
    return false;
  } catch (error: any) {
    logger.warn('Google Drive delete caught error (ignoring to avoid blocking UI):', error?.message || error);
    return false;
  }
};
