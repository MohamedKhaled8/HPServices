import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { destroyCloudinaryAsset } from './cloudinaryRestoreService.ts';

test('Cloudinary deletion is triggered', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    assert.match(url, /\/image\/destroy$/);
    assert.equal(init?.method, 'POST');
    return {
      ok: true,
      json: async () => ({ result: 'ok' }),
      text: async () => ''
    } as Response;
  });

  await destroyCloudinaryAsset('uiBackgrounds/hero_1');
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.restore();
});
