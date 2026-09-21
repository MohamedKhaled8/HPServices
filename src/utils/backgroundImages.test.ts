import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendHeroBackgroundImage,
  assertCanManageBackgroundImages,
  removeHeroBackgroundImage,
  resolveHeroBackgroundUrls,
  validateBackgroundImageFile,
  defaultHeroBackgroundImages
} from './backgroundImages.ts';

test('valid image upload works', () => {
  assert.equal(validateBackgroundImageFile({ type: 'image/jpeg', size: 120_000, name: 'hero.jpg' }), null);
  assert.equal(validateBackgroundImageFile({ type: 'image/gif', size: 80_000, name: 'anim.gif' }), null);
  assert.equal(validateBackgroundImageFile({ type: 'image/heic', size: 200_000, name: 'photo.heic' }), null);
});

test('invalid image is rejected', () => {
  assert.ok(validateBackgroundImageFile({ type: 'application/pdf', size: 1000, name: 'file.pdf' }));
  assert.ok(validateBackgroundImageFile({ type: 'image/jpeg', size: 9 * 1024 * 1024, name: 'huge.jpg' }));
  assert.ok(validateBackgroundImageFile({ type: 'image/jpeg', size: 0, name: 'empty.jpg' }));
});

test('uploaded image becomes available', () => {
  const current = defaultHeroBackgroundImages().slice(0, 1);
  const next = appendHeroBackgroundImage(current, {
    id: 'cld-1',
    url: 'https://res.cloudinary.com/demo/image/upload/c_limit,w_1920,q_auto:good,f_auto/uiBackgrounds/new',
    publicId: 'uiBackgrounds/new'
  });
  assert.equal(next.length, current.length + 1);
  assert.ok(next.some((image) => image.publicId === 'uiBackgrounds/new'));
  assert.ok(resolveHeroBackgroundUrls(next).includes(next[next.length - 1].url));
});

test('deleted image is removed', () => {
  const current = [
    { id: 'a', url: '/a.jpg' },
    { id: 'b', url: '/b.jpg', publicId: 'uiBackgrounds/b' }
  ];
  const { next, removed } = removeHeroBackgroundImage(current, 'b');
  assert.equal(removed?.id, 'b');
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'a');
  assert.ok(!resolveHeroBackgroundUrls(next).includes('/b.jpg'));
});

test('unauthorized upload/delete is rejected', () => {
  assert.throws(() => assertCanManageBackgroundImages(false), /غير مصرح/);
  assert.doesNotThrow(() => assertCanManageBackgroundImages(true));
});
