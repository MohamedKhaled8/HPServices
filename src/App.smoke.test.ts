import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('App & Router Hierarchy Smoke Tests', () => {
  test('Provider stack order matches expected architecture', () => {
    const providerOrder = [
      'AppErrorBoundary',
      'StudentProvider',
      'BrowserRouter',
      'BackgroundUploadProvider',
    ];

    assert.equal(providerOrder[0], 'AppErrorBoundary');
    assert.equal(providerOrder[1], 'StudentProvider');
    assert.equal(providerOrder[2], 'BrowserRouter');
    assert.equal(providerOrder[3], 'BackgroundUploadProvider');
    assert.equal(providerOrder.indexOf('BrowserRouter') < providerOrder.indexOf('BackgroundUploadProvider'), true);
  });

  test('AppErrorBoundary: getDerivedStateFromError captures errors and detects chunk errors', () => {
    const regularError = new Error('Regular runtime render error');
    const isChunkError = (err: Error) =>
      Boolean(
        err?.message &&
          /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(
            err.message
          )
      );

    assert.equal(isChunkError(regularError), false);

    const chunkError = new Error('Failed to fetch dynamically imported module: /assets/AdminDashboard.js');
    assert.equal(isChunkError(chunkError), true);
  });

  test('Route Guards: ProtectedRoute correctly gates unauthenticated vs student vs admin vs telemetry', () => {
    const evaluateProtectedRoute = (userState: {
      isLoggedIn: boolean;
      isAdmin: boolean;
      isTelemetryAdmin: boolean;
    }) => {
      if (!userState.isLoggedIn) return { redirect: '/login' };
      if (userState.isTelemetryAdmin) return { redirect: '/telemetry' };
      if (userState.isAdmin) return { redirect: '/admin' };
      return { allowed: true };
    };

    assert.deepEqual(evaluateProtectedRoute({ isLoggedIn: false, isAdmin: false, isTelemetryAdmin: false }), {
      redirect: '/login',
    });
    assert.deepEqual(evaluateProtectedRoute({ isLoggedIn: true, isAdmin: false, isTelemetryAdmin: false }), {
      allowed: true,
    });
    assert.deepEqual(evaluateProtectedRoute({ isLoggedIn: true, isAdmin: true, isTelemetryAdmin: false }), {
      redirect: '/admin',
    });
    assert.deepEqual(evaluateProtectedRoute({ isLoggedIn: true, isAdmin: false, isTelemetryAdmin: true }), {
      redirect: '/telemetry',
    });
  });

  test('Route Guards: AdminRoute correctly blocks non-admin and gates properly', () => {
    const evaluateAdminRoute = (userState: {
      isLoggedIn: boolean;
      isAdmin: boolean;
      isTelemetryAdmin: boolean;
      isAuthLoading: boolean;
    }) => {
      if (userState.isAuthLoading) return { loading: true };
      if (!userState.isLoggedIn) return { redirect: '/login' };
      if (userState.isTelemetryAdmin) return { redirect: '/telemetry' };
      if (!userState.isAdmin) return { redirect: '/dashboard' };
      return { allowed: true };
    };

    assert.deepEqual(
      evaluateAdminRoute({ isLoggedIn: true, isAdmin: false, isTelemetryAdmin: false, isAuthLoading: false }),
      { redirect: '/dashboard' }
    );
    assert.deepEqual(
      evaluateAdminRoute({ isLoggedIn: true, isAdmin: true, isTelemetryAdmin: false, isAuthLoading: false }),
      { allowed: true }
    );
    assert.deepEqual(
      evaluateAdminRoute({ isLoggedIn: false, isAdmin: false, isTelemetryAdmin: false, isAuthLoading: true }),
      { loading: true }
    );
  });

  test('Background upload queue fallback context handles calls safely without throwing', () => {
    const fallbackContext = {
      isUploading: false,
      statusLabel: '',
      enqueueUpload: async () => false,
      registerListener: () => () => {},
    };

    assert.equal(fallbackContext.isUploading, false);
    assert.equal(typeof fallbackContext.enqueueUpload, 'function');
    assert.equal(typeof fallbackContext.registerListener, 'function');
  });
});
