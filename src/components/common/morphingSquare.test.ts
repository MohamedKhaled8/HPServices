import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLACEMENT,
  DEFAULT_SIZE,
  DEFAULT_ARIA_LABEL,
  PLACEMENT_CLASSES,
  SIZE_DIMENSIONS,
  getPlacementClass,
  getSizeClass,
  getSizeDimensions,
  getAriaLabel,
  mapLoadingDotsToProps
} from './morphingSquareCore.ts';
import type {
  MorphingSquareProps,
  LoadingDotsProps
} from './morphingSquareCore.ts';

test('MorphingSquare: defaults apply correctly', () => {
  assert.equal(DEFAULT_PLACEMENT, 'bottom');
  assert.equal(DEFAULT_SIZE, 'md');
  assert.equal(getPlacementClass(), 'hp-morph-placement-bottom flex-col');
  assert.equal(getSizeClass(), 'hp-morph-size-md');
  assert.deepEqual(getSizeDimensions(), { width: 40, height: 40, className: 'hp-morph-size-md' });
  assert.equal(getAriaLabel(), DEFAULT_ARIA_LABEL);
});

test('MorphingSquare: messagePlacement variants map to accurate flex directions', () => {
  assert.equal(getPlacementClass('bottom'), 'hp-morph-placement-bottom flex-col');
  assert.equal(getPlacementClass('top'), 'hp-morph-placement-top flex-col-reverse');
  assert.equal(getPlacementClass('right'), 'hp-morph-placement-right flex-row');
  assert.equal(getPlacementClass('left'), 'hp-morph-placement-left flex-row-reverse');

  // Verify all declared placements exist in constant table
  assert.ok(PLACEMENT_CLASSES.bottom.includes('flex-col'));
  assert.ok(PLACEMENT_CLASSES.top.includes('flex-col-reverse'));
  assert.ok(PLACEMENT_CLASSES.right.includes('flex-row'));
  assert.ok(PLACEMENT_CLASSES.left.includes('flex-row-reverse'));
});

test('MorphingSquare: sizes map to accurate dimensions', () => {
  const sm = getSizeDimensions('sm');
  assert.equal(sm.width, 20);
  assert.equal(sm.height, 20);
  assert.equal(sm.className, 'hp-morph-size-sm');
  assert.equal(getSizeClass('sm'), 'hp-morph-size-sm');

  const md = getSizeDimensions('md');
  assert.equal(md.width, 40);
  assert.equal(md.height, 40);
  assert.equal(md.className, 'hp-morph-size-md');
  assert.equal(getSizeClass('md'), 'hp-morph-size-md');

  const lg = getSizeDimensions('lg');
  assert.equal(lg.width, 48);
  assert.equal(lg.height, 48);
  assert.equal(lg.className, 'hp-morph-size-lg');
  assert.equal(getSizeClass('lg'), 'hp-morph-size-lg');
});

test('MorphingSquare: accessibility and Arabic message rendering', () => {
  const arabicText = 'جارٍ تحميل البيانات...';
  assert.equal(getAriaLabel(arabicText), arabicText);
  assert.equal(getAriaLabel('  جارٍ التحميل  '), 'جارٍ التحميل');
  assert.equal(getAriaLabel(''), DEFAULT_ARIA_LABEL);
  assert.equal(getAriaLabel(undefined), DEFAULT_ARIA_LABEL);
});

test('LoadingDots: backward compatibility mapper preserves all props seamlessly', () => {
  const dotsProps1: LoadingDotsProps = {
    text: 'جارٍ تسجيل الدخول...',
    size: 'lg',
    className: 'custom-auth-loader',
    fullScreen: true
  };

  const morphProps1 = mapLoadingDotsToProps(dotsProps1);
  assert.equal(morphProps1.message, 'جارٍ تسجيل الدخول...');
  assert.equal(morphProps1.size, 'lg');
  assert.equal(morphProps1.className, 'custom-auth-loader');

  // Default values mapping
  const dotsProps2: LoadingDotsProps = {};
  const morphProps2 = mapLoadingDotsToProps(dotsProps2);
  assert.equal(morphProps2.message, undefined);
  assert.equal(morphProps2.size, 'md');
  assert.equal(morphProps2.className, '');
});
