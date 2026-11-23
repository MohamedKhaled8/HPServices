import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

export const resolveSnackbarVisibility = (
  isVisible: boolean,
  isMounted: boolean,
  hasDocument: boolean
): boolean => {
  return isMounted && isVisible && hasDocument;
};

export const createMockSnackbarPortal = (
  isVisible: boolean,
  label: string,
  variant: string,
  targetBody: { children: any[]; appendChild: (c: any) => void; removeChild: (c: any) => void }
) => {
  if (!isVisible) {
    return { mounted: false, element: null };
  }

  const element = {
    className: 'hp-upload-snackbar-floating',
    role: 'status',
    label,
    variant,
    children: [
      {
        className: 'hp-upload-snackbar-pill',
        label,
        pixelGrid: true,
      },
    ],
  };

  targetBody.appendChild(element);
  return {
    mounted: true,
    element,
    unmount: () => targetBody.removeChild(element),
  };
};

describe('UploadSnackbar - Portal and Visibility Logic', () => {
  test('returns false when isVisible is false, unmounted, or document is absent', () => {
    assert.equal(resolveSnackbarVisibility(false, true, true), false);
    assert.equal(resolveSnackbarVisibility(true, false, true), false);
    assert.equal(resolveSnackbarVisibility(true, true, false), false);
    assert.equal(resolveSnackbarVisibility(true, true, true), true);
  });

  test('renders inside document.body via portal when isVisible is true', () => {
    const mockBody = {
      children: [] as any[],
      appendChild(node: any) {
        this.children.push(node);
      },
      removeChild(node: any) {
        this.children = this.children.filter((c) => c !== node);
      },
    };

    const arabicLabel = 'جاري رفع الملفات (2/5)...';
    const result = createMockSnackbarPortal(true, arabicLabel, 'Drive', mockBody);

    assert.equal(result.mounted, true);
    assert.equal(mockBody.children.length, 1);
    assert.equal(mockBody.children[0].className, 'hp-upload-snackbar-floating');
    assert.equal(mockBody.children[0].children[0].className, 'hp-upload-snackbar-pill');
    assert.equal(mockBody.children[0].children[0].label, arabicLabel);
    assert.equal(mockBody.children[0].children[0].pixelGrid, true);
  });

  test('unmounts cleanly from document.body when isVisible becomes false', () => {
    const mockBody = {
      children: [] as any[],
      appendChild(node: any) {
        this.children.push(node);
      },
      removeChild(node: any) {
        this.children = this.children.filter((c) => c !== node);
      },
    };

    const portal = createMockSnackbarPortal(true, 'جاري رفع الصورة...', 'Drive', mockBody);
    assert.equal(mockBody.children.length, 1);

    portal.unmount?.();
    assert.equal(mockBody.children.length, 0);

    const inactivePortal = createMockSnackbarPortal(false, 'جاري رفع الصورة...', 'Drive', mockBody);
    assert.equal(inactivePortal.mounted, false);
    assert.equal(mockBody.children.length, 0);
  });
});
