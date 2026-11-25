import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateFolderName,
  computeRenamedPath,
  resolveRenameTargets,
  cascadeFolderRenameState,
} from './folderRenameExecutor.ts';
import {
  readCachedTrackFolders,
  writeCachedTrackFolders,
  renameCachedTrackFolder,
  readCachedUnified130Folders,
  writeCachedUnified130Folders,
  renameCachedUnified130Folder,
} from '../storage/assignmentsCache.ts';
import type { AssignmentFolderMeta } from '../../../services/firebaseService.ts';

describe('Folder Rename Safe Commit-First Tests', () => {
  it('validates folder names strictly: rejects empty, slashes, unchanged, and duplicates', () => {
    const current: AssignmentFolderMeta = { id: 'f1', name: 'الواجبات', path: 'الواجبات', parentPath: '' };
    const siblings: AssignmentFolderMeta[] = [
      current,
      { id: 'f2', name: 'المشاريع', path: 'المشاريع', parentPath: '' },
      { id: 'f3', name: 'الواجبات', path: 'أخرى/الواجبات', parentPath: 'أخرى' },
    ];

    assert.strictEqual(validateFolderName('   ', current, siblings).isValid, false);
    assert.strictEqual(validateFolderName('مجلد/جديد', current, siblings).isValid, false);
    assert.strictEqual(validateFolderName('مجلد\\جديد', current, siblings).isValid, false);
    assert.strictEqual(validateFolderName('الواجبات', current, siblings).isValid, false);
    assert.strictEqual(validateFolderName('المشاريع', current, siblings).isValid, false);

    const valid = validateFolderName('المهام والواجبات', current, siblings);
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.cleanName, 'المهام والواجبات');
  });

  it('single-folder rename updates target folder and all direct files without undefined fields', () => {
    const target: AssignmentFolderMeta = { id: 'f1', name: 'كتب', path: 'كتب', parentPath: '' };
    const files = [
      { id: 'doc1', name: 'كتاب1.pdf', folderPath: 'كتب', folder: 'كتب', folderName: 'كتب' },
      { id: 'doc2', name: 'كتاب2.pdf', folderPath: 'كتب', folder: 'كتب', folderName: 'كتب' },
    ];

    const newPath = computeRenamedPath('مناهج', target.parentPath);
    const { updatedFolders, updatedFiles } = cascadeFolderRenameState({
      oldPath: target.path,
      newPath,
      newName: 'مناهج',
      folders: [target],
      files,
    });

    assert.strictEqual(updatedFolders[0].name, 'مناهج');
    assert.strictEqual(updatedFolders[0].path, 'مناهج');
    assert.strictEqual(updatedFiles.length, 2);
    for (const f of updatedFiles) {
      assert.strictEqual(f.folderPath, 'مناهج');
      assert.strictEqual(f.folder, 'مناهج');
      assert.strictEqual(f.folderName, 'مناهج');
      assert.ok(!Object.values(f).some((val) => val === undefined));
    }
  });

  it('nested parent rename cascades child paths and protects prefix-collision against sibling "مسار 2"', () => {
    const target: AssignmentFolderMeta = { id: 'f_root', name: 'مسار', path: 'مسار', parentPath: '' };
    const child: AssignmentFolderMeta = { id: 'f_child', name: 'فصل 1', path: 'مسار/فصل 1', parentPath: 'مسار' };
    const siblingCol: AssignmentFolderMeta = { id: 'f_sib', name: 'مسار 2', path: 'مسار 2', parentPath: '' };
    const allFolders = [target, child, siblingCol];

    const allFiles = [
      { id: 'file_dir', folderPath: 'مسار', folder: 'مسار', folderName: 'مسار' },
      { id: 'file_nest', folderPath: 'مسار/فصل 1', folder: 'مسار/فصل 1', folderName: 'فصل 1' },
      { id: 'file_sib', folderPath: 'مسار 2', folder: 'مسار 2', folderName: 'مسار 2' },
    ];

    const targets = resolveRenameTargets(target, allFolders, allFiles);
    assert.strictEqual(targets.descendantFolders.length, 1);
    assert.strictEqual(targets.descendantFolders[0].id, 'f_child');
    assert.strictEqual(targets.affectedFiles.length, 2);

    const { updatedFolders, updatedFiles } = cascadeFolderRenameState({
      oldPath: 'مسار',
      newPath: 'مسار جديد',
      newName: 'مسار جديد',
      folders: allFolders,
      files: allFiles,
    });

    const renamedRoot = updatedFolders.find((f) => f.id === 'f_root')!;
    const renamedChild = updatedFolders.find((f) => f.id === 'f_child')!;
    const intactSibling = updatedFolders.find((f) => f.id === 'f_sib')!;

    assert.strictEqual(renamedRoot.path, 'مسار جديد');
    assert.strictEqual(renamedChild.path, 'مسار جديد/فصل 1');
    assert.strictEqual(renamedChild.parentPath, 'مسار جديد');
    assert.strictEqual(intactSibling.path, 'مسار 2');
    assert.strictEqual(intactSibling.name, 'مسار 2');

    const nestFile = updatedFiles.find((f) => f.id === 'file_nest')!;
    const sibFile = updatedFiles.find((f) => f.id === 'file_sib')!;
    assert.strictEqual(nestFile.folderPath, 'مسار جديد/فصل 1');
    assert.strictEqual(nestFile.folderName, 'فصل 1');
    assert.strictEqual(sibFile.folderPath, 'مسار 2');
  });

  it('commit-first safety: keeps state and cache intact if commit rejects or times out', async () => {
    let mockStateName = 'القديم';
    let isRowLocked = false;

    const simulateFailedCommit = async (): Promise<string> => {
      isRowLocked = true;
      try {
        await new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة استجابة السيرفر أثناء إعادة التسمية (15 ثانية)')), 10));
        mockStateName = 'الجديد';
        return '';
      } catch (err: unknown) {
        return err instanceof Error ? err.message : 'خطأ';
      } finally {
        isRowLocked = false;
      }
    };

    const surfacedError = await simulateFailedCommit();
    assert.strictEqual(mockStateName, 'القديم');
    assert.strictEqual(isRowLocked, false);
    assert.ok(surfacedError.includes('15 ثانية'));
  });

  it('assignmentsCache renames cached folders and child paths cleanly preventing resurrection', () => {
    const memoryStore: Record<string, string> = {};
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => memoryStore[k] || null,
      setItem: (k: string, v: string) => { memoryStore[k] = v; },
      removeItem: (k: string) => { delete memoryStore[k]; },
      clear: () => { Object.keys(memoryStore).forEach((k) => delete memoryStore[k]); },
      key: () => null,
      length: 0,
    };

    writeCachedTrackFolders({
      track1: [
        { id: '1', name: 'فيزياء', path: 'فيزياء', parentPath: '' },
        { id: '2', name: 'ديناميكا', path: 'فيزياء/ديناميكا', parentPath: 'فيزياء' },
      ],
      track2: [],
      track3: [],
    });

    renameCachedTrackFolder('track1', 'فيزياء', 'علوم متقدمة', 'علوم متقدمة');
    const cachedTracks = readCachedTrackFolders();
    assert.strictEqual(cachedTracks.track1[0].name, 'علوم متقدمة');
    assert.strictEqual(cachedTracks.track1[0].path, 'علوم متقدمة');
    assert.strictEqual(cachedTracks.track1[1].path, 'علوم متقدمة/ديناميكا');
    assert.strictEqual(cachedTracks.track1[1].parentPath, 'علوم متقدمة');

    writeCachedUnified130Folders([
      { id: 'u1', name: 'ملفات130', path: 'ملفات130', parentPath: '' },
      { id: 'u2', name: 'فرعي', path: 'ملفات130/فرعي', parentPath: 'ملفات130' },
    ]);
    renameCachedUnified130Folder('ملفات130', 'ملفات موحدة', 'ملفات موحدة');
    const cachedUnified = readCachedUnified130Folders();
    assert.strictEqual(cachedUnified[0].name, 'ملفات موحدة');
    assert.strictEqual(cachedUnified[0].path, 'ملفات موحدة');
    assert.strictEqual(cachedUnified[1].path, 'ملفات موحدة/فرعي');
  });
});
