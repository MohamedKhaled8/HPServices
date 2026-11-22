import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePixelCell,
  formatElapsedTime,
} from './loadingStateUtils.ts';

describe('LoadingState - formatElapsedTime', () => {
  test('formats under 60 seconds with 1 decimal place', () => {
    assert.equal(formatElapsedTime(0), '0.0s');
    assert.equal(formatElapsedTime(1200), '1.2s');
    assert.equal(formatElapsedTime(45600), '45.6s');
    assert.equal(formatElapsedTime(59900), '59.9s');
  });

  test('formats 60 seconds and above into minutes and seconds', () => {
    assert.equal(formatElapsedTime(60000), '1m 0.0s');
    assert.equal(formatElapsedTime(72300), '1m 12.3s');
    assert.equal(formatElapsedTime(125400), '2m 5.4s');
    assert.equal(formatElapsedTime(3600000), '60m 0.0s');
  });
});

describe('LoadingState - computePixelCell', () => {
  test('variant Drive calculates chevron wavefront delays with 650ms cycle', () => {
    // delay = (c + Math.abs(r - 1)) * 90ms
    // i = 0: r=0, c=0 => (0 + 1) * 90 = 90ms
    const cell0 = computePixelCell('Drive', 0);
    assert.equal(cell0.cycleMs, 650);
    assert.equal(cell0.delayMs, 90);
    assert.equal(cell0.isStaticDim, false);

    // i = 3: r=1, c=0 => (0 + 0) * 90 = 0ms (wavefront origin)
    const cell3 = computePixelCell('Drive', 3);
    assert.equal(cell3.delayMs, 0);

    // i = 4: r=1, c=1 => (1 + 0) * 90 = 90ms
    const cell4 = computePixelCell('Drive', 4);
    assert.equal(cell4.delayMs, 90);

    // i = 8: r=2, c=2 => (2 + 1) * 90 = 270ms
    const cell8 = computePixelCell('Drive', 8);
    assert.equal(cell8.delayMs, 270);
  });

  test('variant Dots uses same chevron wavefront delays and 650ms cycle', () => {
    for (let i = 0; i < 9; i++) {
      const driveCell = computePixelCell('Drive', i);
      const dotsCell = computePixelCell('Dots', i);
      assert.equal(dotsCell.delayMs, driveCell.delayMs);
      assert.equal(dotsCell.cycleMs, driveCell.cycleMs);
      assert.equal(dotsCell.isStaticDim, driveCell.isStaticDim);
    }
  });

  test('variant Orbit rotates around perimeter with k * 110ms and 950ms cycle', () => {
    // Perimeter order: [0, 1, 2, 5, 8, 7, 6, 3]
    const order = [0, 1, 2, 5, 8, 7, 6, 3];
    order.forEach((cellIndex, k) => {
      const cell = computePixelCell('Orbit', cellIndex);
      assert.equal(cell.delayMs, k * 110);
      assert.equal(cell.cycleMs, 950);
      assert.equal(cell.isStaticDim, false);
    });

    // Center cell index 4 must stay static dim with opacity 0.07
    const centerCell = computePixelCell('Orbit', 4);
    assert.equal(centerCell.isStaticDim, true);
    assert.equal(centerCell.opacity, 0.07);
  });
});
