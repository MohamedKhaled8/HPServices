export type AdminAccountRole = 'primary_admin' | 'telemetry_admin';
export type SessionStatus = 'active' | 'revoked' | 'expired';
export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';

export interface DeviceMetadata {
  readonly deviceName: string;
  readonly os: string;
  readonly browser: string;
  readonly deviceType: DeviceType;
  readonly userAgent: string;
  readonly screenResolution?: string;
}

export interface GeoLocationInfo {
  readonly ip: string;
  readonly country: string;
  readonly region: string;
  readonly city: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly timezone: string;
}

export interface TelemetrySession {
  readonly sessionId: string;
  readonly uid: string;
  readonly email: string;
  readonly role: AdminAccountRole;
  readonly status: SessionStatus;
  readonly createdAtMs: number;
  readonly createdAtIso: string;
  readonly lastSeenAtMs: number;
  readonly lastSeenAtIso: string;
  readonly expiresAtMs: number;
  readonly keepAliveCount: number;
  readonly revokedAtMs?: number;
  readonly revokedBy?: string;
  readonly device: DeviceMetadata;
  readonly geo: GeoLocationInfo;
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

export interface SessionHeartbeatResult {
  readonly status: SessionStatus;
  readonly shouldLogout: boolean;
  readonly expiresAtMs?: number;
  readonly revokedAtMs?: number;
}

