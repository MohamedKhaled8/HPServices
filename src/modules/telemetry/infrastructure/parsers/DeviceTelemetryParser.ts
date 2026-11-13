import type { DeviceMetadata, DeviceType } from '../../domain/entities/TelemetrySession';

export class DeviceTelemetryParser {
  static capture(): DeviceMetadata {
    if (typeof navigator === 'undefined') {
      return {
        deviceName: 'Server Environment',
        os: 'Node.js',
        browser: 'SSR',
        deviceType: 'Unknown',
        userAgent: 'SSR',
        screenResolution: '0x0'
      };
    }

    const ua = navigator.userAgent || '';
    const os = this.detectOS(ua);
    const browser = this.detectBrowser(ua);
    const deviceType = this.detectDeviceType(ua);
    const deviceName = this.detectDeviceName(ua, os, deviceType);
    const screenResolution =
      typeof window !== 'undefined' && window.screen
        ? `${window.screen.width}x${window.screen.height}`
        : undefined;

    return {
      deviceName,
      os,
      browser,
      deviceType,
      userAgent: ua.slice(0, 240),
      screenResolution
    };
  }

  static getTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
    } catch {
      return 'Africa/Cairo';
    }
  }

  private static detectOS(ua: string): string {
    if (/Windows NT 10\.0|Windows NT 11\.0/i.test(ua)) return 'Windows 10/11';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Android\s+([\d.]+)/i.test(ua)) {
      const m = ua.match(/Android\s+([\d.]+)/i);
      return `Android ${m?.[1] || ''}`.trim();
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      const m = ua.match(/OS\s+([\d_]+)/i);
      return `iOS ${m?.[1]?.replace(/_/g, '.') || ''}`.trim();
    }
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/CrOS/i.test(ua)) return 'ChromeOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown OS';
  }

  private static detectBrowser(ua: string): string {
    if (/Edg\/([\d.]+)/i.test(ua)) {
      const m = ua.match(/Edg\/([\d.]+)/i);
      return `Edge ${m?.[1]?.split('.')[0] || ''}`.trim();
    }
    if (/OPR\/([\d.]+)/i.test(ua) || /Opera/i.test(ua)) return 'Opera';
    if (/SamsungBrowser\/([\d.]+)/i.test(ua)) return 'Samsung Internet';
    if (/Chrome\/([\d.]+)/i.test(ua) && !/Chromium/i.test(ua)) {
      const m = ua.match(/Chrome\/([\d.]+)/i);
      return `Chrome ${m?.[1]?.split('.')[0] || ''}`.trim();
    }
    if (/Firefox\/([\d.]+)/i.test(ua)) {
      const m = ua.match(/Firefox\/([\d.]+)/i);
      return `Firefox ${m?.[1]?.split('.')[0] || ''}`.trim();
    }
    if (/Safari\/([\d.]+)/i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
    return 'Unknown Browser';
  }

  private static detectDeviceType(ua: string): DeviceType {
    if (/iPad|Tablet|PlayBook|Silk|(android(?!.*mobile))/i.test(ua)) return 'Tablet';
    if (/Mobile|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'Mobile';
    if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return 'Desktop';
    return 'Unknown';
  }

  private static detectDeviceName(ua: string, os: string, deviceType: DeviceType): string {
    if (/iPhone/i.test(ua)) return 'Apple iPhone';
    if (/iPad/i.test(ua)) return 'Apple iPad';
    const androidModel = ua.match(/Android[^;]+;\s*([^)]+)\)/i);
    if (androidModel?.[1]) {
      const cleaned = androidModel[1].split('Build/')[0].trim();
      if (cleaned && cleaned !== 'K') return cleaned.slice(0, 48);
    }
    if (os.startsWith('macOS')) return 'Apple Mac';
    if (os.startsWith('Windows')) return 'Windows PC';
    if (deviceType === 'Mobile') return 'Android Smartphone';
    return `${os} ${deviceType}`;
  }
}

