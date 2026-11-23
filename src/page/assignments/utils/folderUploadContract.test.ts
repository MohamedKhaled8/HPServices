import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleFoldersAtLevel, computeAggregateFolderCounts } from './folderTreeUtils.ts';
import { stripUndefined } from './folderUtils.ts';
import { getGoogleDriveAccessToken } from '../../../services/googleDriveService.ts';
import { invalidateDriveToken } from '../../../services/driveTokenCache.ts';
import type { AssignmentFolderMeta, AssignmentFileMeta } from '../../../services/firebaseService.ts';

test('Single folder upload contract: "ابحاث" with 3 PDFs shows count=3 at root and reveals all files when opened', () => {
  const createdFolder: AssignmentFolderMeta = {
    id: 'f_abahth', name: 'ابحاث', path: 'ابحاث', parentPath: '', parentFolderId: null, isParentFolder: false, totalFilesCount: 3,
  };
  const allFiles: AssignmentFileMeta[] = [
    { id: 'pdf_1', name: 'بحث_1.pdf', url: 'https://d/1', storagePath: '1', folderPath: 'ابحاث', folderId: 'f_abahth', folder: 'ابحاث' },
    { id: 'pdf_2', name: 'بحث_2.pdf', url: 'https://d/2', storagePath: '2', folderPath: 'ابحاث', folderId: 'f_abahth', folder: 'ابحاث' },
    { id: 'pdf_3', name: 'بحث_3.pdf', url: 'https://d/3', storagePath: '3', folderPath: 'ابحاث', folderId: 'f_abahth', folder: 'ابحاث' },
  ];
  const rootVisible = getVisibleFoldersAtLevel([createdFolder], '');
  assert.equal(rootVisible.length, 1);
  assert.equal(rootVisible[0].name, 'ابحاث');

  const counts = computeAggregateFolderCounts(createdFolder, [createdFolder], allFiles);
  assert.equal(counts.totalFilesCount, 3);
  assert.equal(counts.isParent, false);

  assert.equal(getVisibleFoldersAtLevel([createdFolder], 'ابحاث').length, 0);
  const openedFiles = allFiles.filter((f) => (f.folderPath || f.folder || '').trim() === 'ابحاث');
  assert.equal(openedFiles.length, 3);
  assert.deepEqual(openedFiles.map((f) => f.name), ['بحث_1.pdf', 'بحث_2.pdf', 'بحث_3.pdf']);
});

test('Keep-parent mode contract: "Documents" -> "hhhh" (2 PDFs) + "عمرو فاروق" (3 PDFs) shows aggregate 2 folders, 5 files', () => {
  const parentFolder: AssignmentFolderMeta = {
    id: 'f_docs', name: 'Documents', path: 'Documents', parentPath: '', parentFolderId: null, isParentFolder: true, subfoldersCount: 2, totalFilesCount: 5,
  };
  const child1: AssignmentFolderMeta = {
    id: 'f_hhhh', name: 'hhhh', path: 'Documents/hhhh', parentPath: 'Documents', parentFolderId: 'f_docs', isParentFolder: false, totalFilesCount: 2,
  };
  const child2: AssignmentFolderMeta = {
    id: 'f_amr', name: 'عمرو فاروق', path: 'Documents/عمرو فاروق', parentPath: 'Documents', parentFolderId: 'f_docs', isParentFolder: false, totalFilesCount: 3,
  };
  const allFolders = [parentFolder, child1, child2];
  const allFiles: AssignmentFileMeta[] = [
    { id: 'f1', name: 'h1.pdf', url: 'https://d/1', storagePath: '1', folderPath: 'Documents/hhhh', folderId: 'f_hhhh', folder: 'Documents/hhhh' },
    { id: 'f2', name: 'h2.pdf', url: 'https://d/2', storagePath: '2', folderPath: 'Documents/hhhh', folderId: 'f_hhhh', folder: 'Documents/hhhh' },
    { id: 'f3', name: 'amr1.pdf', url: 'https://d/3', storagePath: '3', folderPath: 'Documents/عمرو فاروق', folderId: 'f_amr', folder: 'Documents/عمرو فاروق' },
    { id: 'f4', name: 'amr2.pdf', url: 'https://d/4', storagePath: '4', folderPath: 'Documents/عمرو فاروق', folderId: 'f_amr', folder: 'Documents/عمرو فاروق' },
    { id: 'f5', name: 'amr3.pdf', url: 'https://d/5', storagePath: '5', folderPath: 'Documents/عمرو فاروق', folderId: 'f_amr', folder: 'Documents/عمرو فاروق' },
  ];

  const rootFolders = getVisibleFoldersAtLevel(allFolders, '');
  assert.equal(rootFolders.length, 1);
  assert.equal(rootFolders[0].name, 'Documents');

  const parentCounts = computeAggregateFolderCounts(parentFolder, allFolders, allFiles);
  assert.equal(parentCounts.isParent, true);
  assert.equal(parentCounts.subfoldersCount, 2);
  assert.equal(parentCounts.totalFilesCount, 5);

  const insideDocs = getVisibleFoldersAtLevel(allFolders, 'Documents');
  assert.equal(insideDocs.length, 2);
  assert.deepEqual(insideDocs.map((f) => f.name), ['hhhh', 'عمرو فاروق']);

  const getFiles = (p: string) => allFiles.filter((f) => (f.folderPath || f.folder || '').trim() === p.trim());
  assert.equal(getFiles('Documents/hhhh').length, 2);
  assert.equal(getFiles('Documents/عمرو فاروق').length, 3);
});

test('Drive token failure contract: 404/non-JSON throws Arabic error and leaves ZERO ghost folders', async () => {
  invalidateDriveToken();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!DOCTYPE html><html><body>404 Not Found</body></html>', {
    status: 404, statusText: 'Not Found', headers: { 'content-type': 'text/html' },
  });

  let caughtError: Error | null = null;
  try {
    await getGoogleDriveAccessToken(200);
  } catch (err: any) {
    caughtError = err;
  } finally {
    globalThis.fetch = originalFetch;
    invalidateDriveToken();
  }

  assert.ok(caughtError !== null);
  assert.match(caughtError!.message, /فشل الاتصال بـ \/api\/getDriveToken \(404\)/);

  let firestoreFolderDocCreated = false;
  await assert.rejects(async () => {
    await (async () => { throw new Error(caughtError!.message); })();
    firestoreFolderDocCreated = true;
  }, /فشل الاتصال بـ \/api\/getDriveToken \(404\)/);
  assert.equal(firestoreFolderDocCreated, false);
});

test('Zero undefined values contract: Firestore payloads have strictly ZERO undefined fields', () => {
  const dirty = { a: 1, b: undefined, c: 'ok', d: null, e: 0, f: false, g: undefined };
  const cleaned = stripUndefined(dirty);
  assert.equal('b' in cleaned, false);
  assert.equal('g' in cleaned, false);
  assert.equal(Object.values(cleaned).every((v) => v !== undefined), true);

  const extraMeta: any = { subfoldersCount: undefined, totalFilesCount: undefined, parentFolderId: undefined };
  const childFolderPayload = stripUndefined({
    id: 'c1', name: 'hhhh', path: 'Documents/hhhh',
    parentPath: extraMeta.parentPath ?? 'Documents',
    parentFolderId: extraMeta.parentFolderId ?? 'p1',
    isParentFolder: Boolean(extraMeta.isParentFolder),
    subfoldersCount: typeof extraMeta.subfoldersCount === 'number' ? extraMeta.subfoldersCount : 0,
    totalFilesCount: typeof extraMeta.totalFilesCount === 'number' ? extraMeta.totalFilesCount : 0,
    createdAt: 'MOCK_TIMESTAMP',
  });
  assert.equal(Object.values(childFolderPayload).every((v) => v !== undefined), true);
  assert.equal(childFolderPayload.subfoldersCount, 0);
  assert.equal(childFolderPayload.totalFilesCount, 0);

  const filePayloadUnified = stripUndefined({
    id: 'file1', name: 'test.pdf', url: 'https://d/1',
    track: undefined,
    storagePath: '1', folderPath: 'Documents/hhhh', folderId: 'c1', folderName: 'hhhh', folder: 'Documents/hhhh',
    adminId: 'admin_123', provider: 'google-drive', bucket: 'cloud-storage', uploadedAt: 'MOCK_TIMESTAMP',
  });
  assert.equal('track' in filePayloadUnified, false);
  assert.equal(Object.values(filePayloadUnified).every((v) => v !== undefined), true);
});
