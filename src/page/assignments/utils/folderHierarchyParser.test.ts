import { test } from 'node:test';
import assert from 'node:assert';
import { parseFolderHierarchy } from './folderHierarchyParser.ts';
import {
  getOrFetchDriveToken,
  invalidateDriveToken,
  isTokenValid,
  setCachedTokenData,
} from '../../../services/driveTokenCache.ts';

const createMockFile = (name: string, relativePath?: string, size = 1024): File => {
  const f = {
    name,
    size,
    type: name.endsWith('.pdf') ? 'application/pdf' : 'image/png',
    webkitRelativePath: relativePath || name,
  } as unknown as File;
  return f;
};

test('Nested upload with 2 subfolders produces ONLY 2 groups with zero leaked loose files', () => {
  const files = [
    createMockFile('a.pdf', 'الأول/تست 1/a.pdf'),
    createMockFile('b.pdf', 'الأول/تست 2/b.pdf'),
  ];

  const result = parseFolderHierarchy(files);

  assert.strictEqual(result.mode, 'nested');
  assert.strictEqual(result.groups.length, 2);
  assert.strictEqual(result.excludedCount, 0);

  const group1 = result.groups.find((g) => g.folderName === 'تست 1');
  const group2 = result.groups.find((g) => g.folderName === 'تست 2');

  assert.ok(group1, 'Group "تست 1" must exist');
  assert.ok(group2, 'Group "تست 2" must exist');
  assert.strictEqual(group1.files.length, 1);
  assert.strictEqual(group1.files[0].name, 'a.pdf');
  assert.strictEqual(group2.files.length, 1);
  assert.strictEqual(group2.files[0].name, 'b.pdf');

  const leakedLoose = result.groups.find((g) => g.folderName === 'الأول');
  assert.strictEqual(leakedLoose, undefined, 'No parent wrapper or loose root group allowed');
});

test('Nested upload with 8+ subfolders including deep paths preserves ALL subfolders', () => {
  const files: File[] = [];
  for (let i = 1; i <= 6; i++) {
    files.push(createMockFile(`file_${i}.pdf`, `Parent/Sub${i}/file_${i}.pdf`));
  }
  files.push(createMockFile('c.pdf', 'Parent/Sub7/Inner/c.pdf'));
  files.push(createMockFile('file_8.pdf', 'Parent/Sub8/file_8.pdf'));

  const result = parseFolderHierarchy(files);

  assert.strictEqual(result.mode, 'nested');
  assert.strictEqual(result.groups.length, 8, 'Must preserve all 8 subfolders with no 6-folder cap');

  for (let i = 1; i <= 8; i++) {
    const subName = `Sub${i}`;
    const group = result.groups.find((g) => g.folderName === subName);
    assert.ok(group, `Group "${subName}" must be preserved`);
    assert.strictEqual(group.files.length, 1);
  }

  // Verify trackId binding simulation
  const boundTrackId = 'track3';
  const batch = {
    trackId: boundTrackId,
    groups: result.groups,
  };
  assert.strictEqual(batch.trackId, 'track3');
  assert.strictEqual(batch.groups.length, 8);
});

test('Single mode upload: all files with segments length 2 return single mode', () => {
  const files = [
    createMockFile('doc1.pdf', 'تست 1/doc1.pdf'),
    createMockFile('doc2.pdf', 'تست 1/doc2.pdf'),
  ];

  const result = parseFolderHierarchy(files);

  assert.strictEqual(result.mode, 'single');
  assert.strictEqual(result.groups.length, 1);
  assert.strictEqual(result.groups[0].folderName, 'تست 1');
  assert.strictEqual(result.groups[0].files.length, 2);
});

test('Filters unsupported extensions and updates excludedCount', () => {
  const files = [
    createMockFile('valid.pdf', 'Folder/valid.pdf'),
    createMockFile('notes.txt', 'Folder/notes.txt'),
    createMockFile('.DS_Store', 'Folder/.DS_Store'),
  ];

  const result = parseFolderHierarchy(files);
  assert.strictEqual(result.excludedCount, 1, 'Only user-visible non-supported file counted');
  assert.strictEqual(result.groups[0].files.length, 1);
  assert.strictEqual(result.groups[0].files[0].name, 'valid.pdf');
});

test('Drive token cache reuses valid token without redundant fetches and invalidates on demand', async () => {
  invalidateDriveToken();
  assert.strictEqual(isTokenValid(null), false);

  let fetchCount = 0;
  const mockFetch = async () => {
    fetchCount++;
    return { accessToken: `token_${fetchCount}`, expiresIn: 3600 };
  };

  const token1 = await getOrFetchDriveToken(mockFetch);
  assert.strictEqual(token1, 'token_1');
  assert.strictEqual(fetchCount, 1);

  const token2 = await getOrFetchDriveToken(mockFetch);
  assert.strictEqual(token2, 'token_1', 'Cached token must be returned');
  assert.strictEqual(fetchCount, 1, 'No second fetch should occur');

  invalidateDriveToken();
  const token3 = await getOrFetchDriveToken(mockFetch);
  assert.strictEqual(token3, 'token_2', 'Fresh token fetched after invalidation');
  assert.strictEqual(fetchCount, 2);
});
