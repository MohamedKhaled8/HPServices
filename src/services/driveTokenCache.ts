export interface CachedTokenData {
  token: string;
  expiresAt: number;
}

let inMemoryToken: CachedTokenData | null = null;
let pendingRefreshPromise: Promise<string> | null = null;

const EXPIRY_BUFFER_MS = 60 * 1000; // 60 seconds safety margin

export const getCachedTokenData = (): CachedTokenData | null => inMemoryToken;

export const setCachedTokenData = (token: string, expiresInSeconds: number): void => {
  const safeSeconds = expiresInSeconds > 60 ? expiresInSeconds : 3600;
  inMemoryToken = {
    token,
    expiresAt: Date.now() + safeSeconds * 1000,
  };
};

export const invalidateDriveToken = (): void => {
  inMemoryToken = null;
};

export const isTokenValid = (cached: CachedTokenData | null): boolean => {
  if (!cached || !cached.token) return false;
  return Date.now() < cached.expiresAt - EXPIRY_BUFFER_MS;
};

export const getOrFetchDriveToken = async (
  fetchFn: () => Promise<{ accessToken: string; expiresIn?: number }>
): Promise<string> => {
  if (isTokenValid(inMemoryToken)) {
    return inMemoryToken!.token;
  }

  if (pendingRefreshPromise) {
    return pendingRefreshPromise;
  }

  pendingRefreshPromise = (async () => {
    try {
      const data = await fetchFn();
      setCachedTokenData(data.accessToken, data.expiresIn || 3600);
      return data.accessToken;
    } finally {
      pendingRefreshPromise = null;
    }
  })();

  return pendingRefreshPromise;
};
