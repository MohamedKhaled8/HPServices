import { test } from 'node:test';
import assert from 'node:assert';
import { extractDriveFileId, deleteFromGoogleDrive } from './googleDriveService.ts';
import { deleteCloudStorageFile, deleteCloudStorageFilesBackground } from './cloudStorageDeletion.ts';

test('extractDriveFileId: extracts ID from export download URL', () => {
  const url = 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv';
  assert.strictEqual(extractDriveFileId(url), '1AbCdEfGhIjKlMnOpQrStUv');
});

test('extractDriveFileId: extracts ID from file /d/ URL', () => {
  const url = 'https://drive.google.com/file/d/1XyZ9876543210ABCDEF_qw/view';
  assert.strictEqual(extractDriveFileId(url), '1XyZ9876543210ABCDEF_qw');
});

test('extractDriveFileId: handles raw valid Google Drive file IDs', () => {
  const rawId = '1AbCdEfGhIjKlMnOpQrStUv';
  assert.strictEqual(extractDriveFileId(rawId), rawId);
});

test('extractDriveFileId: returns null for invalid inputs or file paths', () => {
  assert.strictEqual(extractDriveFileId(''), null);
  assert.strictEqual(extractDriveFileId('short'), null);
  assert.strictEqual(extractDriveFileId('some/relative/path.pdf'), null);
  assert.strictEqual(extractDriveFileId(null as any), null);
});

test('deleteFromGoogleDrive: returns false gracefully without throwing when id is missing or invalid', async () => {
  const result = await deleteFromGoogleDrive('');
  assert.strictEqual(result, false);
});

test('deleteCloudStorageFile: returns true on empty storagePath and never throws on unconfigured services', async () => {
  const emptyRes = await deleteCloudStorageFile();
  assert.strictEqual(emptyRes, true);

  const driveRes = await deleteCloudStorageFile('invalid_id', 'google-drive');
  assert.strictEqual(typeof driveRes, 'boolean');
});

test('deleteCloudStorageFilesBackground: handles empty array and does not throw', () => {
  assert.doesNotThrow(() => {
    deleteCloudStorageFilesBackground([]);
  });
});
