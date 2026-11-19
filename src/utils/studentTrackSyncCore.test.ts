import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTrackKey,
  trackKeyToDisplayName,
  groupFilesIntoAssignmentUnits,
  computeSynchronizedAssignedFiles
} from './studentTrackSyncCore.ts';
import type { AssignedFile, AssignmentFileMeta } from '../types/index.ts';

test('getTrackKey parses various Arabic and English track labels correctly', () => {
  assert.equal(getTrackKey('الأول'), 'track1');
  assert.equal(getTrackKey('الاول'), 'track1');
  assert.equal(getTrackKey('المسار الأول'), 'track1');
  assert.equal(getTrackKey('الأولى'), 'track1');
  assert.equal(getTrackKey('track1'), 'track1');
  assert.equal(getTrackKey('1'), 'track1');

  assert.equal(getTrackKey('الثاني'), 'track2');
  assert.equal(getTrackKey('المسار الثاني'), 'track2');
  assert.equal(getTrackKey('الثانية'), 'track2');
  assert.equal(getTrackKey('track2'), 'track2');
  assert.equal(getTrackKey('2'), 'track2');

  assert.equal(getTrackKey('الثالث'), 'track3');
  assert.equal(getTrackKey('المسار الثالث'), 'track3');
  assert.equal(getTrackKey('الثالثة'), 'track3');
  assert.equal(getTrackKey('track3'), 'track3');
  assert.equal(getTrackKey('3'), 'track3');

  assert.equal(getTrackKey(null), null);
  assert.equal(getTrackKey(''), null);
  assert.equal(getTrackKey('unified130'), null);
  assert.equal(getTrackKey('unknown'), null);
});

test('trackKeyToDisplayName returns official Arabic name', () => {
  assert.equal(trackKeyToDisplayName('track1'), 'الأول');
  assert.equal(trackKeyToDisplayName('track2'), 'الثاني');
  assert.equal(trackKeyToDisplayName('track3'), 'الثالث');
});

test('groupFilesIntoAssignmentUnits correctly clusters folders and root files', () => {
  const files: AssignmentFileMeta[] = [
    { id: 'f1', name: 'ملف1_نموذجأ.pdf', url: 'http://f1', track: 'track1', storagePath: 'sp1', folderPath: 'واجب_علم_نفس' },
    { id: 'f2', name: 'ملف1_نموذجب.pdf', url: 'http://f2', track: 'track1', storagePath: 'sp2', folderPath: 'واجب_علم_نفس' },
    { id: 'f3', name: 'ملف_منفرد.pdf', url: 'http://f3', track: 'track1', storagePath: 'sp3' }
  ];

  const units = groupFilesIntoAssignmentUnits(files);
  assert.equal(units.length, 2);

  const folderUnit = units.find(u => u.isFolder);
  assert.ok(folderUnit);
  assert.equal(folderUnit.files.length, 2);
  assert.equal(folderUnit.unitName, 'واجب_علم_نفس');

  const rootUnit = units.find(u => !u.isFolder);
  assert.ok(rootUnit);
  assert.equal(rootUnit.files.length, 1);
  assert.equal(rootUnit.unitName, 'ملف_منفرد.pdf');
});

// Scenario 1 & 2: Transition from Track 1 to Track 2
test('Scenario 1 & 2: Moving from Track 1 to Track 2 removes Track 1 files and adds Track 2 files', () => {
  const existingFiles: AssignedFile[] = [
    {
      id: 't1_file_1',
      name: 'تكليف1_مسار1.pdf',
      customName: 'أحمد_محمد_-_تكليف1_مسار1.pdf',
      url: 'http://t1_1',
      track: 'track1',
      assignedAt: '2026-11-01T10:00:00.000Z'
    },
    {
      id: 't1_file_2',
      name: 'تكليف2_مسار1.pdf',
      customName: 'أحمد_محمد_-_تكليف2_مسار1.pdf',
      url: 'http://t1_2',
      track: 'track1',
      assignedAt: '2026-11-01T10:00:00.000Z'
    }
  ];

  const track2Files: AssignmentFileMeta[] = [
    {
      id: 't2_file_1',
      name: 'تكليف1_مسار2.pdf',
      url: 'http://t2_1',
      track: 'track2',
      storagePath: 'sp_t2_1',
      folderPath: 'مجلد_مسار2'
    }
  ];

  const result = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['t1_file_1', 't1_file_2']),
    studentId: 'student_123',
    studentNameArabic: 'أحمد محمد'
  });

  assert.equal(result.canSync, true);
  assert.equal(result.action, 'synced');
  assert.equal(result.removedFiles.length, 2);
  assert.equal(result.addedFiles.length, 1);
  assert.equal(result.updatedAssignedFiles.length, 1);

  // New file must belong to Track 2
  assert.equal(result.updatedAssignedFiles[0].id, 't2_file_1');
  assert.equal(result.updatedAssignedFiles[0].track, 'track2');
  assert.equal(result.updatedAssignedFiles[0].customName?.includes('أحمد_محمد'), true);

  // No Track 1 files should remain
  assert.equal(result.updatedAssignedFiles.some(f => f.track === 'track1'), false);
});

// Scenario 3 & 4: Transition from Track 1 to Track 3
test('Scenario 3 & 4: Moving from Track 1 to Track 3 removes Track 1 files and adds Track 3 files', () => {
  const existingFiles: AssignedFile[] = [
    {
      id: 't1_file_1',
      name: 'تكليف1_مسار1.pdf',
      customName: 'سارة_علي_-_تكليف1_مسار1.pdf',
      url: 'http://t1_1',
      track: 'track1'
    }
  ];

  const track3Files: AssignmentFileMeta[] = [
    {
      id: 't3_file_1',
      name: 'تكليف1_مسار3.pdf',
      url: 'http://t3_1',
      track: 'track3',
      storagePath: 'sp_t3_1'
    },
    {
      id: 't3_file_2',
      name: 'تكليف2_مسار3.pdf',
      url: 'http://t3_2',
      track: 'track3',
      storagePath: 'sp_t3_2'
    }
  ];

  const result = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track3',
    newTrackFiles: track3Files,
    oldTrackFileIds: new Set(['t1_file_1']),
    studentId: 'student_456',
    studentNameArabic: 'سارة علي'
  });

  assert.equal(result.canSync, true);
  assert.equal(result.removedFiles.length, 1);
  assert.equal(result.addedFiles.length, 2);
  assert.equal(result.updatedAssignedFiles.length, 2);
  assert.equal(result.updatedAssignedFiles.every(f => f.track === 'track3'), true);
  assert.equal(result.updatedAssignedFiles.some(f => f.track === 'track1'), false);
});

// Scenario 5: Transition from Track 2 to Track 3
test('Scenario 5: Moving from Track 2 to Track 3 cleanly replaces allocations', () => {
  const existingFiles: AssignedFile[] = [
    {
      id: 't2_f1',
      name: 'تكليف_مسار2.pdf',
      customName: 'محمود_-_تكليف_مسار2.pdf',
      url: 'http://t2',
      track: 'track2'
    }
  ];

  const track3Files: AssignmentFileMeta[] = [
    {
      id: 't3_f1',
      name: 'تكليف_مسار3.pdf',
      url: 'http://t3',
      track: 'track3',
      storagePath: 'sp_t3'
    }
  ];

  const result = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: 'track2',
    newTrackKey: 'track3',
    newTrackFiles: track3Files,
    oldTrackFileIds: new Set(['t2_f1']),
    studentId: 'student_789',
    studentNameArabic: 'محمود حسن'
  });

  assert.equal(result.canSync, true);
  assert.equal(result.removedFiles.length, 1);
  assert.equal(result.removedFiles[0].id, 't2_f1');
  assert.equal(result.addedFiles.length, 1);
  assert.equal(result.addedFiles[0].id, 't3_f1');
  assert.equal(result.updatedAssignedFiles[0].track, 'track3');
});

// Scenario 6: Returning to a previous track restores correct files without duplication
test('Scenario 6: Returning from Track 3 to Track 1 restores Track 1 files without duplication', () => {
  const existingFiles: AssignedFile[] = [
    {
      id: 't3_f1',
      name: 'تكليف_مسار3.pdf',
      url: 'http://t3',
      track: 'track3'
    }
  ];

  const track1Files: AssignmentFileMeta[] = [
    {
      id: 't1_f1',
      name: 'تكليف_مسار1_أ.pdf',
      url: 'http://t1_a',
      track: 'track1',
      storagePath: 'sp1'
    },
    {
      id: 't1_f2',
      name: 'تكليف_مسار1_ب.pdf',
      url: 'http://t1_b',
      track: 'track1',
      storagePath: 'sp2'
    }
  ];

  const result = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: 'track3',
    newTrackKey: 'track1',
    newTrackFiles: track1Files,
    oldTrackFileIds: new Set(['t3_f1']),
    studentId: 'student_101',
    studentNameArabic: 'خالد إبراهيم'
  });

  assert.equal(result.canSync, true);
  assert.equal(result.removedFiles.length, 1);
  assert.equal(result.removedFiles[0].track, 'track3');
  assert.equal(result.addedFiles.length, 2);
  assert.equal(result.updatedAssignedFiles.length, 2);
  assert.equal(result.updatedAssignedFiles.every(f => f.track === 'track1'), true);

  // Check no duplicates in updated list
  const ids = result.updatedAssignedFiles.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

// Scenario 7: Multiple track changes in succession prevents accumulation of old files
test('Scenario 7: Successive transitions (1 -> 2 -> 3 -> 1 -> 2) prevent old file accumulation', () => {
  const track1Files: AssignmentFileMeta[] = [
    { id: 'f_t1', name: 'f_t1.pdf', url: 'http://1', track: 'track1', storagePath: 's1' }
  ];
  const track2Files: AssignmentFileMeta[] = [
    { id: 'f_t2', name: 'f_t2.pdf', url: 'http://2', track: 'track2', storagePath: 's2' }
  ];
  const track3Files: AssignmentFileMeta[] = [
    { id: 'f_t3', name: 'f_t3.pdf', url: 'http://3', track: 'track3', storagePath: 's3' }
  ];

  // Step 1: Start with Track 1 file
  let currentFiles: AssignedFile[] = [
    { id: 'f_t1', name: 'f_t1.pdf', customName: 'f_t1', url: 'http://1', track: 'track1' }
  ];

  // Step 2: 1 -> 2
  let res = computeSynchronizedAssignedFiles({
    existingFiles: currentFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['f_t1']),
    studentId: 's1'
  });
  currentFiles = res.updatedAssignedFiles;
  assert.equal(currentFiles.length, 1);
  assert.equal(currentFiles[0].id, 'f_t2');

  // Step 3: 2 -> 3
  res = computeSynchronizedAssignedFiles({
    existingFiles: currentFiles,
    oldTrackKey: 'track2',
    newTrackKey: 'track3',
    newTrackFiles: track3Files,
    oldTrackFileIds: new Set(['f_t2']),
    studentId: 's1'
  });
  currentFiles = res.updatedAssignedFiles;
  assert.equal(currentFiles.length, 1);
  assert.equal(currentFiles[0].id, 'f_t3');

  // Step 4: 3 -> 1
  res = computeSynchronizedAssignedFiles({
    existingFiles: currentFiles,
    oldTrackKey: 'track3',
    newTrackKey: 'track1',
    newTrackFiles: track1Files,
    oldTrackFileIds: new Set(['f_t3']),
    studentId: 's1'
  });
  currentFiles = res.updatedAssignedFiles;
  assert.equal(currentFiles.length, 1);
  assert.equal(currentFiles[0].id, 'f_t1');

  // Step 5: 1 -> 2
  res = computeSynchronizedAssignedFiles({
    existingFiles: currentFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['f_t1']),
    studentId: 's1'
  });
  currentFiles = res.updatedAssignedFiles;
  assert.equal(currentFiles.length, 1);
  assert.equal(currentFiles[0].id, 'f_t2');

  // Exactly 1 file remains, ZERO accumulated files from tracks 1 and 3!
  assert.equal(currentFiles.some(f => f.track === 'track1'), false);
  assert.equal(currentFiles.some(f => f.track === 'track3'), false);
});

// Scenario 8: Files shared across multiple students does not affect other students
test('Scenario 8: Sync operates exclusively on the target student without collateral impact', () => {
  // Student A files
  const studentAFiles: AssignedFile[] = [
    { id: 'shared_file_1', name: 'ملف_مشترك.pdf', url: 'http://shared', track: 'track1' }
  ];

  // Student B files (has the same shared file)
  const studentBFiles: AssignedFile[] = [
    { id: 'shared_file_1', name: 'ملف_مشترك.pdf', url: 'http://shared', track: 'track1' }
  ];

  const track2Files: AssignmentFileMeta[] = [
    { id: 't2_f1', name: 'جديد.pdf', url: 'http://new', track: 'track2', storagePath: 's' }
  ];

  // Only Student A changes track
  const resultA = computeSynchronizedAssignedFiles({
    existingFiles: studentAFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['shared_file_1']),
    studentId: 'student_A'
  });

  // Student A files are updated
  assert.equal(resultA.updatedAssignedFiles[0].id, 't2_f1');

  // Student B files are completely untouched
  assert.equal(studentBFiles.length, 1);
  assert.equal(studentBFiles[0].id, 'shared_file_1');
  assert.equal(studentBFiles[0].track, 'track1');
});

// Scenario 9: Manual files and Unified 130 files are NOT deleted by mistake
test('Scenario 9: Preserves manual files and Unified 130 files during track change', () => {
  const existingFiles: AssignedFile[] = [
    // Track 1 file (should be removed)
    { id: 't1_f1', name: 'واجب_مسار1.pdf', url: 'http://t1', track: 'track1' },
    // Unified 130 practical education file (MUST BE KEPT)
    { id: 'u130_f1', name: 'كشكول_التربية_العملي_130.pdf', url: 'http://u130', track: 'unified130' },
    // Manual file added independently (MUST BE KEPT)
    { id: 'manual_f1', name: 'ملف_استثنائي_خاص.pdf', url: 'http://manual', track: undefined }
  ];

  const track2Files: AssignmentFileMeta[] = [
    { id: 't2_f1', name: 'واجب_مسار2.pdf', url: 'http://t2', track: 'track2', storagePath: 'sp2' }
  ];

  const result = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['t1_f1']), // manual_f1 is NOT in track 1
    studentId: 'student_special'
  });

  assert.equal(result.canSync, true);
  assert.equal(result.removedFiles.length, 1);
  assert.equal(result.removedFiles[0].id, 't1_f1');

  // Preserved files must contain BOTH the unified130 file AND the manual file
  assert.equal(result.preservedFiles.some(f => f.id === 'u130_f1'), true);
  assert.equal(result.preservedFiles.some(f => f.id === 'manual_f1'), true);

  // Total files = 2 preserved + 1 new = 3
  assert.equal(result.updatedAssignedFiles.length, 3);
  assert.equal(result.updatedAssignedFiles.some(f => f.id === 't1_f1'), false);
  assert.equal(result.updatedAssignedFiles.some(f => f.id === 'u130_f1'), true);
  assert.equal(result.updatedAssignedFiles.some(f => f.id === 'manual_f1'), true);
  assert.equal(result.updatedAssignedFiles.some(f => f.id === 't2_f1'), true);
});

// Scenario 10: New track has no files -> Do NOT delete existing files
test('Scenario 10: If new track has no files, existing files are preserved to prevent leaving student with zero files', () => {
  const existingFiles: AssignedFile[] = [
    { id: 't1_f1', name: 'ملف_المسار_الأول.pdf', url: 'http://t1', track: 'track1' }
  ];

  const emptyTrack3Files: AssignmentFileMeta[] = [];

  const result = computeSynchronizedAssignedFiles({
    existingFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track3',
    newTrackFiles: emptyTrack3Files,
    oldTrackFileIds: new Set(['t1_f1']),
    studentId: 'student_empty_test'
  });

  assert.equal(result.canSync, false);
  assert.equal(result.action, 'no_new_files_preserved');
  assert.equal(result.removedFiles.length, 0);
  assert.equal(result.addedFiles.length, 0);

  // Existing files are 100% preserved
  assert.equal(result.updatedAssignedFiles.length, 1);
  assert.equal(result.updatedAssignedFiles[0].id, 't1_f1');
});

// Scenario 11: Error resilience and atomic integrity (original input unmodified on error or abort)
test('Scenario 11: Atomic integrity ensures original student file arrays are not mutated in place', () => {
  const originalFiles: AssignedFile[] = Object.freeze([
    Object.freeze({ id: 't1_f1', name: 'ملف1.pdf', url: 'http://1', track: 'track1' }) as unknown as AssignedFile
  ]) as unknown as AssignedFile[];

  const track2Files: AssignmentFileMeta[] = [
    { id: 't2_f1', name: 'ملف2.pdf', url: 'http://2', track: 'track2', storagePath: 's2' }
  ];

  const result = computeSynchronizedAssignedFiles({
    existingFiles: originalFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['t1_f1']),
    studentId: 'student_immutable_test'
  });

  // Verify pure return value does not mutate input array
  assert.equal(originalFiles.length, 1);
  assert.equal(originalFiles[0].id, 't1_f1');
  assert.notEqual(result.updatedAssignedFiles, originalFiles);
});

// Scenario 12: Admin changes track then Student changes track - sequential symmetry
test('Scenario 12: Changing track via Admin (1 -> 2) then via Student (2 -> 3) executes symmetrical flawless sync', () => {
  const track1Files: AssignmentFileMeta[] = [
    { id: 't1_f1', name: 'ملف_1.pdf', url: 'http://1', track: 'track1', storagePath: 's1' }
  ];
  const track2Files: AssignmentFileMeta[] = [
    { id: 't2_f1', name: 'ملف_2.pdf', url: 'http://2', track: 'track2', storagePath: 's2' }
  ];
  const track3Files: AssignmentFileMeta[] = [
    { id: 't3_f1', name: 'ملف_3.pdf', url: 'http://3', track: 'track3', storagePath: 's3' }
  ];

  // Initial state in Track 1
  let studentFiles: AssignedFile[] = [
    { id: 't1_f1', name: 'ملف_1.pdf', customName: 'ملف_1.pdf', url: 'http://1', track: 'track1' }
  ];

  // Stage 1: Admin changes student from Track 1 to Track 2
  const adminSync = computeSynchronizedAssignedFiles({
    existingFiles: studentFiles,
    oldTrackKey: 'track1',
    newTrackKey: 'track2',
    newTrackFiles: track2Files,
    oldTrackFileIds: new Set(['t1_f1']),
    studentId: 'student_dual_flow'
  });
  assert.equal(adminSync.canSync, true);
  assert.equal(adminSync.updatedAssignedFiles.length, 1);
  assert.equal(adminSync.updatedAssignedFiles[0].id, 't2_f1');
  studentFiles = adminSync.updatedAssignedFiles;

  // Stage 2: Student themselves changes track from Track 2 to Track 3
  const studentSelfSync = computeSynchronizedAssignedFiles({
    existingFiles: studentFiles,
    oldTrackKey: 'track2',
    newTrackKey: 'track3',
    newTrackFiles: track3Files,
    oldTrackFileIds: new Set(['t2_f1']),
    studentId: 'student_dual_flow'
  });
  assert.equal(studentSelfSync.canSync, true);
  assert.equal(studentSelfSync.updatedAssignedFiles.length, 1);
  assert.equal(studentSelfSync.updatedAssignedFiles[0].id, 't3_f1');
  assert.equal(studentSelfSync.updatedAssignedFiles[0].track, 'track3');

  // Confirmed: perfectly symmetrical between Admin and Student workflows
  assert.equal(studentSelfSync.updatedAssignedFiles.some(f => f.track === 'track1'), false);
  assert.equal(studentSelfSync.updatedAssignedFiles.some(f => f.track === 'track2'), false);
});
