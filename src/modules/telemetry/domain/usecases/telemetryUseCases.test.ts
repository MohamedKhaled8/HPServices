import assert from 'node:assert/strict';
import test from 'node:test';
import { AggregateTimeSeriesUseCase } from './AggregateTimeSeriesUseCase.ts';
import { RankServiceLeaderboardsUseCase } from './RankServiceLeaderboardsUseCase.ts';
import { ManageSessionUseCase } from './ManageSessionUseCase.ts';
import type { ServiceLeaderboardItem } from '../entities/ServiceMetric.ts';
import type { TelemetrySession } from '../entities/TelemetrySession.ts';

test('AggregateTimeSeriesUseCase formats buckets cleanly across granularities', () => {
  assert.equal(AggregateTimeSeriesUseCase.getBucketLabel('2026-11-11 21:30:45', 'second'), '21:30:45');
  assert.equal(AggregateTimeSeriesUseCase.getBucketLabel('2026-11-11 21:30', 'minute'), '21:30');
  assert.equal(AggregateTimeSeriesUseCase.getBucketLabel('2026-11-11 21:00', 'hour'), '11-11 21h');
  assert.equal(AggregateTimeSeriesUseCase.getBucketLabel('2026-11-11', 'day'), '11-11');
  assert.equal(AggregateTimeSeriesUseCase.getBucketLabel('2026-11', 'month'), '2026-11');
  assert.equal(AggregateTimeSeriesUseCase.getBucketLabel('2026', 'year'), '2026');
});

test('RankServiceLeaderboardsUseCase ranks top-selling, traffic, and tokens deterministically', () => {
  const sample: ServiceLeaderboardItem[] = [
    {
      serviceId: '1',
      serviceName: 'سجل بياناتك',
      salesCount: 2,
      revenue: 100,
      trafficCount: 50,
      tokenUnits: 0,
      latencySum: 200,
      latencyCount: 2,
      errors: 0
    },
    {
      serviceId: '4',
      serviceName: 'استخراج شهادة التخرج',
      salesCount: 10,
      revenue: 2500,
      trafficCount: 30,
      tokenUnits: 450,
      latencySum: 600,
      latencyCount: 3,
      errors: 0
    }
  ];

  const selling = RankServiceLeaderboardsUseCase.rankTopSelling(sample);
  assert.equal(selling[0].serviceId, '4');
  assert.equal(selling[0].sharePercent, 100);

  const traffic = RankServiceLeaderboardsUseCase.rankHighestTraffic(sample);
  assert.equal(traffic[0].serviceId, '1');

  const tokens = RankServiceLeaderboardsUseCase.rankTokenConsumption(sample);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].serviceId, '4');
});

test('ManageSessionUseCase computes remaining lease and validates session ID', () => {
  const now = 1_700_000_000_000;
  const session: TelemetrySession = {
    sessionId: 'sess_1',
    uid: 'u1',
    email: 'test@hp-portal.sec',
    role: 'primary_admin',
    status: 'active',
    createdAtMs: now - 10_000,
    createdAtIso: new Date(now - 10_000).toISOString(),
    lastSeenAtMs: now,
    lastSeenAtIso: new Date(now).toISOString(),
    expiresAtMs: now + 90_000,
    keepAliveCount: 0,
    device: {
      deviceName: 'Windows PC',
      os: 'Windows 10/11',
      browser: 'Chrome 130',
      deviceType: 'Desktop',
      userAgent: 'UA'
    },
    geo: {
      ip: '1.2.3.4',
      country: 'Egypt',
      region: 'Cairo',
      city: 'Cairo',
      latitude: null,
      longitude: null,
      timezone: 'Africa/Cairo'
    },
    metadata: {}
  };

  assert.equal(ManageSessionUseCase.computeRemainingLeaseSeconds(session, now), 90);
  assert.equal(
    ManageSessionUseCase.computeRemainingLeaseSeconds({ ...session, status: 'revoked' }, now),
    0
  );
});

test('expired or missing telemetry session triggers silent re-registration and prevents auto-logout', () => {
  // Scenario 1: Expired heartbeat response (e.g. laptop slept or closed for >30m)
  const expiredHeartbeat = { shouldLogout: false, status: 'expired' };
  assert.equal(
    ManageSessionUseCase.shouldTriggerLogout(expiredHeartbeat),
    false,
    'Expired session must NEVER trigger auto-logout'
  );
  assert.equal(
    ManageSessionUseCase.shouldReRegister(expiredHeartbeat),
    true,
    'Expired session must automatically signal re-registration'
  );

  // Scenario 2: Server signals re-registration required
  const needsReRegHeartbeat = { shouldLogout: false, status: 'active', needsReRegistration: true };
  assert.equal(
    ManageSessionUseCase.shouldTriggerLogout(needsReRegHeartbeat),
    false,
    'Re-registration request must not trigger logout'
  );
  assert.equal(
    ManageSessionUseCase.shouldReRegister(needsReRegHeartbeat),
    true,
    'Session with needsReRegistration must trigger fresh registration'
  );

  // Scenario 3: Explicit remote security revocation by telemetry admin
  const revokedHeartbeat = { shouldLogout: true, status: 'revoked' };
  assert.equal(
    ManageSessionUseCase.shouldTriggerLogout(revokedHeartbeat),
    true,
    'Only explicitly revoked session triggers forced logout'
  );
  assert.equal(
    ManageSessionUseCase.shouldReRegister(revokedHeartbeat),
    false,
    'Revoked session must not re-register'
  );
});

