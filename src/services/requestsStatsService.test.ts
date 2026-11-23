import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTotalFromServices,
  resolveDisplayTotalCount,
  executeStatsSyncWithFallback,
  isQuotaError,
  isQuotaExhausted,
  setQuotaExhaustedCooldown,
  resetQuotaExhausted
} from '../utils/requestsStatsCore.ts';
import type { ServiceStatsCount, RequestsStatsDoc } from '../utils/requestsStatsCore.ts';

test('calculateTotalFromServices: sums all 12 services and optional legacy collection', () => {
  const byService: Record<string, ServiceStatsCount> = {
    '1': { total: 100, pending: 10 },
    '2': { total: 150, pending: 20 },
    '3': { total: 50, pending: 5 },
    '4': { total: 40, pending: 4 },
    '5': { total: 80, pending: 15 },
    '6': { total: 20, pending: 2 },
    '7': { total: 30, pending: 3 },
    '8': { total: 25, pending: 1 },
    '9': { total: 15, pending: 0 },
    '10': { total: 10, pending: 1 },
    '11': { total: 10, pending: 2 },
    '12': { total: 10, pending: 2 }
  };

  const total = calculateTotalFromServices(byService, 0);
  assert.equal(total, 540, 'Should sum to exactly 540 across all services');

  const withLegacy = calculateTotalFromServices(byService, 10);
  assert.equal(withLegacy, 550, 'Should include legacy requests if present');
});

test('resolveDisplayTotalCount: never returns 0 when requests or stats exist', () => {
  // Case A: valid total count from stats document
  assert.equal(resolveDisplayTotalCount(540, undefined, 25), 540);

  // Case B: totalCount is 0 or null, but statsMap has per-service totals
  const statsMap = {
    '1': { total: 120 },
    '2': { total: 80 }
  };
  assert.equal(resolveDisplayTotalCount(0, statsMap, 25), 200);
  assert.equal(resolveDisplayTotalCount(null, statsMap, 25), 200);

  // Case C: totalCount is 0 and statsMap is 0/empty, but local requests are loaded (25 items)
  assert.equal(resolveDisplayTotalCount(0, {}, 25), 25);
  assert.equal(resolveDisplayTotalCount(null, undefined, 50), 50);

  // Case D: truly empty database (all zeros)
  assert.equal(resolveDisplayTotalCount(0, {}, 0), 0);
});

test('fallback on permission-denied / 0 doc: returns real total (540+) and never blocked by write error', async () => {
  const simulatedCounts: RequestsStatsDoc = {
    total: 540,
    byService: {
      '1': { total: 200, pending: 10 },
      '2': { total: 340, pending: 20 }
    },
    updatedAt: Date.now()
  };

  // Scenario 1: fetch succeeds, but persisting to metadata/requests_stats throws permission-denied
  const res = await executeStatsSyncWithFallback(
    async () => simulatedCounts,
    async () => {
      const err = new Error('Missing or insufficient permissions.');
      (err as any).code = 'permission-denied';
      throw err;
    }
  );

  assert.equal(res.persisted, false, 'Persisted should be false on permission-denied');
  assert.equal(res.stats.total, 540, 'Total MUST still return 540 even when writing doc throws permission-denied');
  assert.equal(res.stats.byService['1'].total, 200);
  assert.equal(res.stats.byService['2'].total, 340);
});

test('manual sync ("مزامنة العدادات"): forces fresh recount and updates real counts', async () => {
  let recountExecuted = false;
  const mockRecount = async () => {
    recountExecuted = true;
    return {
      total: 540,
      byService: { '1': { total: 540, pending: 30 } },
      updatedAt: Date.now()
    };
  };

  const res = await executeStatsSyncWithFallback(mockRecount);
  assert.equal(recountExecuted, true);
  assert.equal(res.stats.total, 540);
});

test('quota circuit-breaker: detects resource-exhausted error, activates cooldown, and resets cleanly', () => {
  resetQuotaExhausted();
  assert.equal(isQuotaExhausted(), false);

  const quotaError = new Error('429 Quota exceeded: resource-exhausted');
  (quotaError as any).code = 'resource-exhausted';

  assert.equal(isQuotaError(quotaError), true);
  assert.equal(isQuotaError(new Error('Normal network glitch')), false);

  setQuotaExhaustedCooldown(60_000);
  assert.equal(isQuotaExhausted(), true, 'Circuit breaker should be active during cooldown window');

  resetQuotaExhausted();
  assert.equal(isQuotaExhausted(), false, 'Resetting circuit breaker clears cooldown immediately');
});
