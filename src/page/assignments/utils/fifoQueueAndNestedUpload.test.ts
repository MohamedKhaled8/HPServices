import { test } from 'node:test';
import assert from 'node:assert';
import { parseFolderHierarchy } from './folderHierarchyParser.ts';
import {
  getVisibleFoldersAtLevel,
  computeAggregateFolderCounts,
  buildBreadcrumbTrail,
  collectAllDescendantFileIds,
} from './folderTreeUtils.ts';
import type { AssignmentFolderMeta } from '../../../services/firebaseService.ts';
import type { QueuedUploadJob, UploadBatchRequest } from '../types/backgroundUpload.types.ts';

const createMockFile = (name: string, relativePath?: string, size = 1024): File => {
  return {
    name,
    size,
    type: name.endsWith('.pdf') ? 'application/pdf' : 'image/png',
    webkitRelativePath: relativePath || name,
  } as unknown as File;
};

test('FIFO Queue Test: Enqueuing Track 3 while Track 1 is uploading appends Track 3 and preserves strict FIFO order', async () => {
  const queue: QueuedUploadJob[] = [];
  let isWorkerRunning = false;
  let activeWorkers = 0;
  let maxConcurrentWorkers = 0;
  let totalFoldersCount = 0;
  let completedFoldersCount = 0;
  const executionOrder: Array<{ trackId: string; folderName: string }> = [];
  const progressSnapshots: string[] = [];

  const runWorker = async () => {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    while (queue.length > 0) {
      activeWorkers++;
      maxConcurrentWorkers = Math.max(maxConcurrentWorkers, activeWorkers);

      const job = queue[0];
      progressSnapshots.push(
        `(${completedFoldersCount + 1}/${totalFoldersCount}) — ${job.folderName}`
      );

      // Simulate async upload delay
      await new Promise((r) => setTimeout(r, 10));

      executionOrder.push({
        trackId: job.targetTrackId || 'track1',
        folderName: job.folderName,
      });

      queue.shift();
      completedFoldersCount++;
      activeWorkers--;
    }

    isWorkerRunning = false;
  };

  const enqueue = (batch: UploadBatchRequest) => {
    const jobs: QueuedUploadJob[] = batch.groups.map((g, idx) => ({
      jobId: `${batch.id}_${idx}`,
      batchId: batch.id,
      scope: batch.scope,
      targetTrackId: batch.trackId,
      uploadStrategy: batch.uploadStrategy || 'extract-subfolders',
      folderName: g.folderName,
      files: g.files,
    }));
    queue.push(...jobs);
    totalFoldersCount += jobs.length;

    if (!isWorkerRunning) {
      runWorker();
    }
  };

  // 1. Enqueue Batch 1 (Track 1 with 2 subfolders)
  enqueue({
    id: 'batch_1',
    scope: 'track',
    trackId: 'track1',
    groups: [
      { folderName: 'Track1_FolderA', files: [createMockFile('1.pdf')] },
      { folderName: 'Track1_FolderB', files: [createMockFile('2.pdf')] },
    ],
    totalFiles: 2,
  });

  assert.strictEqual(totalFoldersCount, 2);
  assert.strictEqual(isWorkerRunning, true);

  // 2. While Track 1 is processing, enqueue Batch 2 (Track 3 with 3 subfolders)
  await new Promise((r) => setTimeout(r, 5));
  enqueue({
    id: 'batch_2',
    scope: 'track',
    trackId: 'track3',
    groups: [
      { folderName: 'Track3_FolderX', files: [createMockFile('3.pdf')] },
      { folderName: 'Track3_FolderY', files: [createMockFile('4.pdf')] },
      { folderName: 'Track3_FolderZ', files: [createMockFile('5.pdf')] },
    ],
    totalFiles: 3,
  });

  // Verify total count dynamically updated from 2 to 5
  assert.strictEqual(totalFoldersCount, 5);

  // Wait for worker to finish all jobs
  while (isWorkerRunning || queue.length > 0) {
    await new Promise((r) => setTimeout(r, 10));
  }

  // Verify single worker lock was never breached
  assert.strictEqual(maxConcurrentWorkers, 1);
  assert.strictEqual(completedFoldersCount, 5);
  assert.strictEqual(queue.length, 0);

  // Verify strict FIFO order: Track 1 folders completed first, then Track 3
  assert.deepStrictEqual(executionOrder, [
    { trackId: 'track1', folderName: 'Track1_FolderA' },
    { trackId: 'track1', folderName: 'Track1_FolderB' },
    { trackId: 'track3', folderName: 'Track3_FolderX' },
    { trackId: 'track3', folderName: 'Track3_FolderY' },
    { trackId: 'track3', folderName: 'Track3_FolderZ' },
  ]);

  // Verify progress updated dynamically (e.g. later jobs reflect total 5)
  assert.ok(progressSnapshots.some((s) => s.includes('/5')));
});

test('Keep-Parent vs Extract-Subfolders Test: parsing preserves rootFolderName and links children in keep-parent mode', () => {
  const files = [
    createMockFile('a.pdf', 'مسار/مسار أول/a.pdf'),
    createMockFile('b.pdf', 'مسار/مسار ثاني/b.pdf'),
  ];

  const parsed = parseFolderHierarchy(files);
  assert.strictEqual(parsed.mode, 'nested');
  assert.strictEqual(parsed.rootFolderName, 'مسار');
  assert.strictEqual(parsed.groups.length, 2);

  // Simulated Keep-Parent mode:
  const parentDoc: AssignmentFolderMeta = {
    id: 'parent_123',
    name: parsed.rootFolderName || 'مسار',
    path: 'مسار',
    parentPath: '',
    parentFolderId: null,
    isParentFolder: true,
  };

  const keepParentChildren: AssignmentFolderMeta[] = parsed.groups.map((g, idx) => ({
    id: `child_${idx}`,
    name: g.folderName,
    path: `${parentDoc.path}/${g.folderName}`,
    parentPath: parentDoc.path,
    parentFolderId: parentDoc.id,
    isParentFolder: false,
  }));

  assert.strictEqual(keepParentChildren.length, 2);
  assert.strictEqual(keepParentChildren[0].parentFolderId, 'parent_123');
  assert.strictEqual(keepParentChildren[1].parentFolderId, 'parent_123');
  assert.strictEqual(keepParentChildren[0].path, 'مسار/مسار أول');
  assert.strictEqual(keepParentChildren[1].path, 'مسار/مسار ثاني');

  // Simulated Extract-Subfolders mode (existing behavior):
  const extractChildren: AssignmentFolderMeta[] = parsed.groups.map((g, idx) => ({
    id: `ext_${idx}`,
    name: g.folderName,
    path: g.folderName,
    parentPath: '',
    parentFolderId: null,
    isParentFolder: false,
  }));

  assert.strictEqual(extractChildren[0].parentFolderId, null);
  assert.strictEqual(extractChildren[0].parentPath, '');
  assert.strictEqual(extractChildren[0].path, 'مسار أول');
});

test('Tree Navigation & Aggregate Count Test: root hides nested children, navigation reveals items, counts are non-zero', () => {
  const parentFolder: AssignmentFolderMeta = {
    id: 'parent_doc',
    name: 'مسار',
    path: 'مسار',
    parentPath: '',
    parentFolderId: null,
    isParentFolder: true,
  };

  const childFolder1: AssignmentFolderMeta = {
    id: 'child_1',
    name: 'مسار أول',
    path: 'مسار/مسار أول',
    parentPath: 'مسار',
    parentFolderId: 'parent_doc',
  };

  const childFolder2: AssignmentFolderMeta = {
    id: 'child_2',
    name: 'مسار ثاني',
    path: 'مسار/مسار ثاني',
    parentPath: 'مسار',
    parentFolderId: 'parent_doc',
  };

  const legacyFolder: AssignmentFolderMeta = {
    id: 'legacy_doc',
    name: 'مجلد قديم',
    path: 'مجلد قديم',
    parentPath: '',
  };

  const allFolders: AssignmentFolderMeta[] = [
    parentFolder,
    legacyFolder,
    childFolder1,
    childFolder2,
  ];

  const allFiles = [
    { id: 'f1', folderPath: 'مسار/مسار أول' },
    { id: 'f2', folderPath: 'مسار/مسار أول' },
    { id: 'f3', folderPath: 'مسار/مسار ثاني' },
    { id: 'f4', folderPath: 'مجلد قديم' },
  ];

  // 1. Root level view: only root folders visible, child folders hidden
  const rootVisible = getVisibleFoldersAtLevel(allFolders, '');
  assert.strictEqual(rootVisible.length, 2);
  assert.ok(rootVisible.some((f) => f.name === 'مسار'));
  assert.ok(rootVisible.some((f) => f.name === 'مجلد قديم'));
  assert.strictEqual(rootVisible.some((f) => f.name === 'مسار أول'), false);
  assert.strictEqual(rootVisible.some((f) => f.name === 'مسار ثاني'), false);

  // 2. Inside "مسار": reveals child folders
  const insideParent = getVisibleFoldersAtLevel(allFolders, 'مسار', 'parent_doc');
  assert.strictEqual(insideParent.length, 2);
  assert.ok(insideParent.some((f) => f.name === 'مسار أول'));
  assert.ok(insideParent.some((f) => f.name === 'مسار ثاني'));
  assert.strictEqual(insideParent.some((f) => f.name === 'مسار'), false);

  // 3. Inside "مسار أول": reveals its files
  const filesInsideChild1 = allFiles.filter((f) => f.folderPath === 'مسار/مسار أول');
  assert.strictEqual(filesInsideChild1.length, 2);

  // 4. Breadcrumb trail
  const trail = buildBreadcrumbTrail('مسار/مسار أول', allFolders);
  assert.deepStrictEqual(trail, [
    { name: 'المسار الرئيسي', path: '' },
    { name: 'مسار', path: 'مسار', folderId: 'parent_doc' },
    { name: 'مسار أول', path: 'مسار/مسار أول', folderId: 'child_1' },
  ]);

  // 5. Aggregate counts for parent folder
  const counts = computeAggregateFolderCounts(parentFolder, allFolders, allFiles);
  assert.strictEqual(counts.isParent, true);
  assert.strictEqual(counts.subfoldersCount, 2);
  assert.strictEqual(counts.totalFilesCount, 3); // 2 in child1 + 1 in child2 = 3 files (never 0!)

  // 6. Descendant file IDs collection
  const descendantIds = collectAllDescendantFileIds('مسار', allFiles);
  assert.strictEqual(descendantIds.length, 3);
  assert.ok(descendantIds.includes('f1'));
  assert.ok(descendantIds.includes('f2'));
  assert.ok(descendantIds.includes('f3'));

  // 7. Navigation into parent folder with path only (activeFolderId omitted)
  const insideParentByPathOnly = getVisibleFoldersAtLevel(allFolders, 'مسار');
  assert.strictEqual(insideParentByPathOnly.length, 2);
  assert.ok(insideParentByPathOnly.some((f) => f.name === 'مسار أول'));
  assert.ok(insideParentByPathOnly.some((f) => f.name === 'مسار ثاني'));

  // 8. Research folder (ابحاث) containing Word and PDF files
  const abhaathParent: AssignmentFolderMeta = {
    id: 'p_abhaath',
    name: 'ابحاث',
    path: 'ابحاث',
    parentPath: '',
    parentFolderId: null,
    isParentFolder: true,
  };
  const hhhhFolder: AssignmentFolderMeta = {
    id: 'c_hhhh',
    name: 'hhhh',
    path: 'ابحاث/hhhh',
    parentPath: 'ابحاث',
    parentFolderId: 'p_abhaath',
  };
  const amrFolder: AssignmentFolderMeta = {
    id: 'c_amr',
    name: 'عمرو فاروق',
    path: 'ابحاث/عمرو فاروق',
    parentPath: 'ابحاث',
    parentFolderId: 'p_abhaath',
  };
  const abhaathFolders = [abhaathParent, hhhhFolder, amrFolder];
  const abhaathFiles = [
    { id: 'file_w1', folderPath: 'ابحاث/hhhh' },
    { id: 'file_p1', folderPath: 'ابحاث/عمرو فاروق' },
  ];
  const abhaathVisible = getVisibleFoldersAtLevel(abhaathFolders, 'ابحاث');
  assert.strictEqual(abhaathVisible.length, 2);
  assert.ok(abhaathVisible.some((f) => f.name === 'hhhh'));
  assert.ok(abhaathVisible.some((f) => f.name === 'عمرو فاروق'));

  const abhaathCounts = computeAggregateFolderCounts(abhaathParent, abhaathFolders, abhaathFiles);
  assert.strictEqual(abhaathCounts.subfoldersCount, 2);
  assert.strictEqual(abhaathCounts.totalFilesCount, 2);
});
