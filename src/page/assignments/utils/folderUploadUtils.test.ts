import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFolderNameFromFiles,
  isSupportedAssignmentFile,
  filterSupportedAssignmentFiles,
  formatFileSize,
  computeTotalFilesSize,
  SUPPORTED_ASSIGNMENT_EXTENSIONS,
} from './folderUploadUtils.ts';

describe('folderUploadUtils', () => {
  test('returns empty string for empty files list', () => {
    assert.equal(extractFolderNameFromFiles([]), '');
  });

  test('extracts top-level folder name from webkitRelativePath', () => {
    const mockFile = {
      name: 'task1.pdf',
      webkitRelativePath: 'تكليف الأسبوع الأول/task1.pdf',
    } as unknown as File;
    assert.equal(extractFolderNameFromFiles([mockFile]), 'تكليف الأسبوع الأول');
  });

  test('extracts folder name from nested subfolder path', () => {
    const mockFile = {
      name: 'sub.png',
      webkitRelativePath: 'Assignment_2026/nested/sub.png',
    } as unknown as File;
    assert.equal(extractFolderNameFromFiles([mockFile]), 'Assignment_2026');
  });

  test('sanitizes illegal path characters from folder name', () => {
    const mockFile = {
      name: 'doc.pdf',
      webkitRelativePath: 'Folder:Part*1?/doc.pdf',
    } as unknown as File;
    assert.equal(extractFolderNameFromFiles([mockFile]), 'Folder_Part_1_');
  });

  test('accepts supported extensions (.pdf, .png, .jpg, etc.)', () => {
    SUPPORTED_ASSIGNMENT_EXTENSIONS.forEach((ext) => {
      const file = { name: `test${ext}` } as File;
      assert.equal(isSupportedAssignmentFile(file), true);
    });
  });

  test('rejects unsupported extensions', () => {
    assert.equal(isSupportedAssignmentFile({ name: 'script.js' } as File), false);
    assert.equal(isSupportedAssignmentFile({ name: 'archive.zip' } as File), false);
    assert.equal(isSupportedAssignmentFile({ name: 'app.exe' } as File), false);
  });

  test('rejects OS hidden/junk files', () => {
    assert.equal(isSupportedAssignmentFile({ name: '.DS_Store' } as File), false);
    assert.equal(isSupportedAssignmentFile({ name: 'Thumbs.db' } as File), false);
    assert.equal(isSupportedAssignmentFile({ name: 'desktop.ini' } as File), false);
  });

  test('separates valid files and counts unsupported files without counting OS junk', () => {
    const pdf = { name: 'doc.pdf' } as File;
    const png = { name: 'image.png' } as File;
    const zip = { name: 'data.zip' } as File;
    const ds = { name: '.DS_Store' } as File;

    const result = filterSupportedAssignmentFiles([pdf, png, zip, ds]);
    assert.deepEqual(result.validFiles, [pdf, png]);
    assert.equal(result.invalidCount, 1);
  });

  test('formats file size accurately', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(500), '500 B');
    assert.equal(formatFileSize(1024), '1.0 KB');
    assert.equal(formatFileSize(1024 * 1024 * 2.5), '2.5 MB');
  });

  test('computes total files size', () => {
    const f1 = { size: 1000 } as File;
    const f2 = { size: 2500 } as File;
    assert.equal(computeTotalFilesSize([f1, f2]), 3500);
    assert.equal(computeTotalFilesSize([]), 0);
  });
});
