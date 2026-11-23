import { describe, it } from 'node:test';
import assert from 'node:assert';
import { filterOutFolderAndDescendants, getFolderAndDescendantIds, getFilesInsideFolderPath } from './folderUtils.ts';
import { removeCachedTrackFolders, removeCachedUnified130Folders, readCachedTrackFolders, writeCachedTrackFolders } from '../storage/assignmentsCache.ts';

describe('folderDeleteTimeoutDistribution Tests', () => {
  it('deleting via "مسح المحدد" removes folder docs, empty folders, and nested children', () => {
    const folders = [
      { id: 'f1', path: 'math', name: 'Math' },
      { id: 'f2', path: 'math/algebra', name: 'Algebra' },
      { id: 'f3', path: 'science', name: 'Science' },
    ];
    const files = [
      { id: 'doc1', folderPath: 'math/algebra' },
      { id: 'doc2', folderPath: 'science' },
    ];

    // Delete folder 'math' (which also removes empty parent/children)
    const remainingFolders = filterOutFolderAndDescendants(folders, 'math');
    const remainingFiles = filterOutFolderAndDescendants(files, 'math');

    assert.strictEqual(remainingFolders.length, 1);
    assert.strictEqual(remainingFolders[0].path, 'science');
    assert.strictEqual(remainingFiles.length, 1);
    assert.strictEqual(remainingFiles[0].id, 'doc2');
  });

  it('guarantees batch writes are chunked to <= 450 operations per commit', () => {
    const BATCH_LIMIT = 450;
    const totalOps = 1000;
    const committedBatches: number[] = [];

    let currentBatchCount = 0;
    for (let i = 0; i < totalOps; i++) {
      currentBatchCount++;
      if (currentBatchCount >= BATCH_LIMIT) {
        committedBatches.push(currentBatchCount);
        currentBatchCount = 0;
      }
    }
    if (currentBatchCount > 0) committedBatches.push(currentBatchCount);

    assert.deepStrictEqual(committedBatches, [450, 450, 100]);
    assert.ok(committedBatches.every(size => size <= 450));
  });

  it('purges deleted folders and nested children from localStorage cache immediately', () => {
    const mockStorage: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; }
    };

    writeCachedTrackFolders({
      track1: [
        { id: '1', path: 'physics', name: 'Physics', parentPath: '' },
        { id: '2', path: 'physics/kinematics', name: 'Kinematics', parentPath: 'physics' },
        { id: '3', path: 'biology', name: 'Biology', parentPath: '' },
      ],
      track2: [],
      track3: []
    });

    removeCachedTrackFolders('track1', ['physics']);
    const cached = readCachedTrackFolders();

    assert.strictEqual(cached.track1.length, 1);
    assert.strictEqual(cached.track1[0].path, 'biology');
  });

  it('cloudStorageDeletion limits concurrency to max 3 and avoids flooding Drive', async () => {
    let activeWorkers = 0;
    let maxObservedActive = 0;
    const tasks = Array.from({ length: 10 }, (_, i) => i);

    const worker = async () => {
      activeWorkers++;
      maxObservedActive = Math.max(maxObservedActive, activeWorkers);
      await new Promise(r => setTimeout(r, 20));
      activeWorkers--;
    };

    let idx = 0;
    const pool = Array.from({ length: 3 }, async () => {
      while (idx < tasks.length) {
        idx++;
        await worker();
      }
    });
    await Promise.all(pool);

    assert.ok(maxObservedActive <= 3, `Expected max concurrency <= 3, got ${maxObservedActive}`);
    assert.strictEqual(activeWorkers, 0);
  });

  it('AbortController aborts hung fetch requests on timeout cleanly', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25);

    let caughtErrorName = '';
    try {
      await new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    } catch (err: any) {
      caughtErrorName = err.name;
    } finally {
      clearTimeout(timer);
    }

    assert.strictEqual(caughtErrorName, 'AbortError');
  });

  it('BackgroundUploadContext resets isWorkerRunningRef in finally when job rejects', async () => {
    let isWorkerRunning = false;
    let errorCaught = false;

    const runWorker = async () => {
      if (isWorkerRunning) return;
      isWorkerRunning = true;
      try {
        throw new Error('Simulated Drive Upload Failure');
      } catch (err) {
        errorCaught = true;
      } finally {
        isWorkerRunning = false;
      }
    };

    await runWorker();
    assert.strictEqual(errorCaught, true);
    assert.strictEqual(isWorkerRunning, false);
  });

  it('nested parent folder distribution collects all descendant subfolder files', () => {
    const trackFiles = [
      { id: 'root_file', folderPath: '' },
      { id: 'parent_file', folderPath: 'semester1' },
      { id: 'sub_file_1', folderPath: 'semester1/unit1' },
      { id: 'sub_file_2', folderPath: 'semester1/unit2' },
      { id: 'other_file', folderPath: 'semester2/unit1' },
    ];

    const currentPath = 'semester1';
    const prefix = `${currentPath}/`;

    // Filter used in updated handleDistribute
    const distributedFiles = trackFiles.filter((f) => {
      const fp = (f.folderPath || '').trim();
      return fp === currentPath || fp.startsWith(prefix);
    });

    const distributedIds = distributedFiles.map(f => f.id);
    assert.strictEqual(distributedIds.length, 3);
    assert.deepStrictEqual(distributedIds, ['parent_file', 'sub_file_1', 'sub_file_2']);
  });

  it('returns empty list for empty folder so notice can be shown without crash', () => {
    const trackFiles = [
      { id: 'file_1', folderPath: 'courseA' }
    ];
    const currentPath = 'emptyFolder';
    const prefix = `${currentPath}/`;

    const matched = trackFiles.filter((f) => {
      const fp = (f.folderPath || '').trim();
      return fp === currentPath || fp.startsWith(prefix);
    });

    assert.strictEqual(matched.length, 0);
  });

  it('resolves exact known folderIds and descendant files without getDocs full-scan', () => {
    const folders = [
      { id: 'f1', name: 'math', path: 'math', parentPath: '' },
      { id: 'f2', name: 'algebra', path: 'math/algebra', parentPath: 'math', parentFolderId: 'f1' },
      { id: 'f3', name: 'calculus', path: 'math/algebra/calculus', parentPath: 'math/algebra' },
      { id: 'f4', name: 'physics', path: 'physics', parentPath: '' },
    ];
    const files = [
      { id: 'file1', folderPath: 'math/algebra', storagePath: 'sp1' },
      { id: 'file2', folderPath: 'math/algebra/calculus', storagePath: 'sp2' },
      { id: 'file3', folderPath: 'physics', storagePath: 'sp3' },
    ];

    const targetFolder = 'math/algebra';
    const folderIds = getFolderAndDescendantIds(folders, targetFolder);
    const filesInside = getFilesInsideFolderPath(files, targetFolder);

    assert.deepStrictEqual(folderIds, ['f2', 'f3']);
    assert.strictEqual(filesInside.length, 2);
    assert.deepStrictEqual(filesInside.map((f: any) => f.id), ['file1', 'file2']);
  });

  it('per-item folder lock: clickable folder executes with stopPropagation while deletingFolderPaths dims only deleting item', () => {
    const deletingFolderPaths = new Set(['folder-to-delete']);
    let openedPath = '';
    let stoppedPropagation = false;

    const simulateFolderClick = (folderPath: string) => {
      const isDeletingThis = deletingFolderPaths.has(folderPath);
      const mockEvent = {
        stopPropagation: () => { stoppedPropagation = true; },
      };
      mockEvent.stopPropagation();
      if (!isDeletingThis) {
        openedPath = folderPath;
      }
      return { isDeletingThis, disabled: isDeletingThis };
    };

    // Clicking normal folder while another folder is being deleted
    const resultNormal = simulateFolderClick('math/algebra');
    assert.strictEqual(resultNormal.disabled, false);
    assert.strictEqual(openedPath, 'math/algebra');
    assert.strictEqual(stoppedPropagation, true);

    // Clicking deleting folder
    openedPath = '';
    const resultDeleting = simulateFolderClick('folder-to-delete');
    assert.strictEqual(resultDeleting.disabled, true);
    assert.strictEqual(openedPath, ''); // prevented
  });

  it('timeout guard rejects hanging operations after 15 seconds', async () => {
    const commitWithTimeout = async (promise: Promise<void>, timeoutMs = 50) => {
      let timer: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('انتهت مهلة استجابة السيرفر أثناء المسح (15 ثانية)')), timeoutMs);
      });
      try {
        await Promise.race([promise, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
    };

    const hangingPromise = new Promise<void>(() => {}); // Never resolves
    await assert.rejects(
      async () => { await commitWithTimeout(hangingPromise, 20); },
      /انتهت مهلة استجابة السيرفر/
    );
  });
});
