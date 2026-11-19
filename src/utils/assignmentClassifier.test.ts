import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSpecialization,
  resolveStudentSpecialization,
  isSpecializationMatch,
  classifyAssignment
} from './assignmentClassifier.ts';

test('normalizeSpecialization normalizes common variants correctly', () => {
  assert.equal(normalizeSpecialization('عربي'), 'لغة عربية');
  assert.equal(normalizeSpecialization('لغة عربية'), 'لغة عربية');
  assert.equal(normalizeSpecialization('اللغة العربية'), 'لغة عربية');
  assert.equal(normalizeSpecialization('إنجليزي'), 'لغة إنجليزية');
  assert.equal(normalizeSpecialization('انجليزي'), 'لغة إنجليزية');
  assert.equal(normalizeSpecialization('English'), 'لغة إنجليزية');
  assert.equal(normalizeSpecialization('رياضيات'), 'رياضيات');
  assert.equal(normalizeSpecialization('علوم'), 'علوم');
  assert.equal(normalizeSpecialization('كيمياء'), 'علوم');
  assert.equal(normalizeSpecialization('فيزياء'), 'علوم');
  assert.equal(normalizeSpecialization('دراسات'), 'دراسات اجتماعية');
  assert.equal(normalizeSpecialization('تاريخ'), 'دراسات اجتماعية');
  assert.equal(normalizeSpecialization('جغرافيا'), 'دراسات اجتماعية');
  assert.equal(normalizeSpecialization('حاسب آلي'), 'حاسب آلي وتكنولوجيا تعليم');
  assert.equal(normalizeSpecialization(null), 'عام / أخرى');
  assert.equal(normalizeSpecialization(''), 'عام / أخرى');
  assert.equal(normalizeSpecialization('أخرى'), 'عام / أخرى');
});

test('resolveStudentSpecialization resolves correctly by hierarchy', () => {
  // 1. From request data if available
  const student = { course: 'عربي', department: 'تاريخ' };
  const request = { educational_specialization: 'رياضيات' };
  assert.equal(resolveStudentSpecialization(student, request), 'رياضيات');

  // 2. From student.course if request not available
  assert.equal(resolveStudentSpecialization(student), 'لغة عربية');

  // 3. From department if course is missing
  assert.equal(resolveStudentSpecialization({ department: 'كيمياء' }), 'علوم');

  // 4. Default fallback
  assert.equal(resolveStudentSpecialization(null), 'عام / أخرى');
});

test('isSpecializationMatch matches correctly', () => {
  // Matching single specialization
  assert.equal(isSpecializationMatch('عربي', ['لغة عربية']), true);
  assert.equal(isSpecializationMatch('اللغة العربية', ['لغة عربية']), true);
  assert.equal(isSpecializationMatch('رياضيات', ['لغة عربية']), false);

  // Matching multiple selected specializations
  assert.equal(isSpecializationMatch('رياضيات', ['لغة عربية', 'رياضيات']), true);
  assert.equal(isSpecializationMatch('علوم', ['لغة عربية', 'رياضيات']), false);

  // Matching all / الكل
  assert.equal(isSpecializationMatch('رياضيات', ['الكل']), true);
  assert.equal(isSpecializationMatch('علوم', ['جميع التخصصات']), true);
  assert.equal(isSpecializationMatch('أي شيء', []), true);
  assert.equal(isSpecializationMatch('أي شيء', undefined), true);
});

test('classifyAssignment classifies delivery types accurately', () => {
  assert.equal(classifyAssignment({ name: 'حل وتسليم التكليفات', price: 300 }), 'personalized');
  assert.equal(classifyAssignment({ name: 'حل PDF فقط', price: 200 }), 'plain');
  assert.equal(classifyAssignment({ name: 'التربية العملي', price: 130 }), 'unified');
});

test('missing assignments filter logic accurately computes missing files and statuses', () => {
  const selectedBatch = [
    { id: 'f1', name: 'واجب 1' },
    { id: 'f2', name: 'واجب 2' },
    { id: 'f3', name: 'واجب 3' },
    { id: 'f4', name: 'واجب 4' },
    { id: 'f5', name: 'واجب 5' },
    { id: 'f6', name: 'واجب 6' },
    { id: 'f7', name: 'واجب 7' },
    { id: 'f8', name: 'واجب 8' },
  ];

  // Case 1: New student with 0 assignments -> receives all 8
  const newStudentExisting: any[] = [];
  const missingForNew = selectedBatch.filter(b => !newStudentExisting.some(e => e.id === b.id));
  assert.equal(missingForNew.length, 8);

  // Case 2: Old student with 5 assignments -> receives the 3 missing
  const oldStudentExisting5 = [
    { id: 'f1', name: 'واجب 1' },
    { id: 'f2', name: 'واجب 2' },
    { id: 'f3', name: 'واجب 3' },
    { id: 'f4', name: 'واجب 4' },
    { id: 'f5', name: 'واجب 5' },
  ];
  const missingForOld5 = selectedBatch.filter(b => !oldStudentExisting5.some(e => e.id === b.id));
  assert.equal(missingForOld5.length, 3);
  assert.deepEqual(missingForOld5.map(f => f.id), ['f6', 'f7', 'f8']);

  // Case 3: Old student with 6 assignments -> receives the 2 missing
  const oldStudentExisting6 = [
    ...oldStudentExisting5,
    { id: 'f6', name: 'واجب 6' },
  ];
  const missingForOld6 = selectedBatch.filter(b => !oldStudentExisting6.some(e => e.id === b.id));
  assert.equal(missingForOld6.length, 2);
  assert.deepEqual(missingForOld6.map(f => f.id), ['f7', 'f8']);

  // Case 4: Complete student with all 8 -> receives 0 (skipped)
  const completedStudentExisting = [...selectedBatch];
  const missingForComplete = selectedBatch.filter(b => !completedStudentExisting.some(e => e.id === b.id));
  assert.equal(missingForComplete.length, 0);
});

test('multi-folder distribution accurately tracks folderPath, prevents duplicate delivery, and handles new vs existing students', () => {
  // Scenario: 5 folders with multiple assignments
  const folder1Files = [
    { id: 'f1_1', name: 'تكليف 1_أ.pdf', track: 'track1', folderPath: 'مجلد_1' },
    { id: 'f1_2', name: 'تكليف 1_ب.pdf', track: 'track1', folderPath: 'مجلد_1' },
  ];
  const folder2Files = [
    { id: 'f2_1', name: 'تكليف 2.docx', track: 'track1', folderPath: 'مجلد_2' },
  ];
  const folder3Files = [
    { id: 'f3_1', name: 'مشروع_تطبيقي.pdf', track: 'track1', folderPath: 'مجلد_3' },
  ];
  const allBatchFiles = [...folder1Files, ...folder2Files, ...folder3Files];

  const isAlreadyAssigned = (file: any, existingFiles: any[]) => {
    return existingFiles.some((f) => {
      if (f.id && file.id && f.id === file.id) return true;
      if (f.name === file.name && f.track === file.track) {
        if (f.folderPath && file.folderPath) {
          return f.folderPath === file.folderPath;
        }
        return true;
      }
      return false;
    });
  };

  // Case A: 100 existing students have received folder1 and folder2
  const existingStudentFiles = [
    { id: 'f1_1', name: 'تكليف 1_أ.pdf', track: 'track1', folderPath: 'مجلد_1' },
    { id: 'f1_2', name: 'تكليف 1_ب.pdf', track: 'track1', folderPath: 'مجلد_1' },
    { id: 'f2_1', name: 'تكليف 2.docx', track: 'track1', folderPath: 'مجلد_2' },
  ];

  const missingForExisting = allBatchFiles.filter(f => !isAlreadyAssigned(f, existingStudentFiles));
  // Must receive ONLY folder3 (1 file), 0 duplicate from folder1 or folder2!
  assert.equal(missingForExisting.length, 1);
  assert.equal(missingForExisting[0].id, 'f3_1');
  assert.equal(missingForExisting[0].folderPath, 'مجلد_3');

  // Case B: 3 new students have 0 assignments
  const newStudentFiles: any[] = [];
  const missingForNew = allBatchFiles.filter(f => !isAlreadyAssigned(f, newStudentFiles));
  // Must receive ALL 4 files across all folders!
  assert.equal(missingForNew.length, 4);
  assert.deepEqual(missingForNew.map(f => f.id), ['f1_1', 'f1_2', 'f2_1', 'f3_1']);

  // Case C: Adding 1 new file inside an existing folder (folder 1)
  const folder1Updated = [
    ...folder1Files,
    { id: 'f1_3', name: 'تكليف 1_ج_جديد.pdf', track: 'track1', folderPath: 'مجلد_1' },
  ];
  const missingForExistingInFolder1 = folder1Updated.filter(f => !isAlreadyAssigned(f, existingStudentFiles));
  assert.equal(missingForExistingInFolder1.length, 1);
  assert.equal(missingForExistingInFolder1[0].id, 'f1_3');

  // Case D: Completely satisfied student gets 0 files (never throws, cleanly skips)
  const allCompletedStudent = [...allBatchFiles];
  const missingForCompleted = allBatchFiles.filter(f => !isAlreadyAssigned(f, allCompletedStudent));
  assert.equal(missingForCompleted.length, 0);
});

test('unit-based folder variant distribution distributes 1 variant per assignment folder without choking', () => {
  // Scenario: 13 assignment folders, each having 100 model variants (1,300 files total)
  const folders = [
    'تكليف اول د سميرة',
    'تكليف ثاني د سميرة',
    'تكليف ثالث د نعمه',
    'تكليف اول د خميس',
    'تكليف ثاني د خميس',
    'تكليف ثالث د خميس',
    'تكليف اول د محمد رسلان',
    'تكليف ثاني د محمد رسلان',
    'تكليف اول د نعمه',
    'تكليف ثاني د نعمه',
    'تكليف اول د مني الحروب',
    'تكليف ثاني د مني الحروب',
    'تكليف رابع د سميرة'
  ];

  const allFiles: any[] = [];
  const folderToFileIds = new Map<string, Set<string>>();

  folders.forEach((folderName, fIdx) => {
    folderToFileIds.set(folderName, new Set());
    for (let variant = 1; variant <= 100; variant++) {
      const fileId = `f_${fIdx}_${variant}`;
      allFiles.push({
        id: fileId,
        name: `${folderName} (${variant}).pdf`,
        folderPath: folderName,
        track: 'track1'
      });
      folderToFileIds.get(folderName)!.add(fileId);
    }
  });

  assert.equal(allFiles.length, 1300);

  // Ashraqat has 12 files (1 variant from 12 folders), missing only the 13th folder ('تكليف رابع د سميرة')
  const ashraqatAssigned = folders.slice(0, 12).map((folderName, fIdx) => ({
    id: `f_${fIdx}_15`,
    name: `${folderName} (15).pdf`,
    folderPath: folderName,
    track: 'track1'
  }));
  assert.equal(ashraqatAssigned.length, 12);

  // Group files into Assignment Units (13 units total)
  const unitMap = new Map<string, any>();
  allFiles.forEach(f => {
    const key = `folder:::${f.folderPath}`;
    if (!unitMap.has(key)) {
      unitMap.set(key, { key, folderPath: f.folderPath, files: [] });
    }
    unitMap.get(key).files.push(f);
  });
  const units = Array.from(unitMap.values());
  assert.equal(units.length, 13);

  const studentHasUnit = (unit: any, studentFiles: any[]) => {
    const idSet = folderToFileIds.get(unit.folderPath);
    return studentFiles.some(sf => sf.folderPath === unit.folderPath || (sf.id && idSet?.has(sf.id)));
  };

  // 1. Ashraqat: Missing exactly 1 unit!
  const ashraqatMissing = units.filter(u => !studentHasUnit(u, ashraqatAssigned));
  assert.equal(ashraqatMissing.length, 1);
  assert.equal(ashraqatMissing[0].folderPath, 'تكليف رابع د سميرة');

  // 2. New Student: Missing all 13 units!
  const newStudentAssigned: any[] = [];
  const newStudentMissing = units.filter(u => !studentHasUnit(u, newStudentAssigned));
  assert.equal(newStudentMissing.length, 13);

  // 3. Complete Student: Missing 0 units!
  const completeStudentAssigned = folders.map((folderName, fIdx) => ({
    id: `f_${fIdx}_1`,
    name: `${folderName} (1).pdf`,
    folderPath: folderName,
    track: 'track1'
  }));
  const completeStudentMissing = units.filter(u => !studentHasUnit(u, completeStudentAssigned));
  assert.equal(completeStudentMissing.length, 0);

  // Total files assigned to Ashraqat = 1 (NOT 1,288 files!)
  const ashraqatNewFiles = ashraqatMissing.map(u => u.files[0]);
  assert.equal(ashraqatNewFiles.length, 1);
  assert.equal(ashraqatAssigned.length + ashraqatNewFiles.length, 13);
});

test('folder-based recall groups by date and folder and allows selective revocation', () => {
  // Mock students with assigned files on different dates and folders
  const students = [
    {
      id: 's1',
      assignedFiles: [
        { id: 'f1', folderPath: 'مجلد_عربي', assignedAt: '2026-11-18T10:00:00.000Z' },
        { id: 'f2', folderPath: 'مجلد_علوم', assignedAt: '2026-11-18T10:00:00.000Z' },
        { id: 'f3', folderPath: 'مجلد_رياضيات', assignedAt: '2026-11-10T10:00:00.000Z' },
      ]
    },
    {
      id: 's2',
      assignedFiles: [
        { id: 'f1_2', folderPath: 'مجلد_عربي', assignedAt: '2026-11-18T10:00:00.000Z' },
        { id: 'f3_2', folderPath: 'مجلد_رياضيات', assignedAt: '2026-11-10T10:00:00.000Z' },
      ]
    }
  ];

  // 1. Group by folderPath + date
  const groups = new Map<string, { folderPath: string; dateString: string; studentIds: Set<string> }>();
  students.forEach(s => {
    s.assignedFiles.forEach(f => {
      const dateString = f.assignedAt.substring(0, 10);
      const key = `${f.folderPath}:::${dateString}`;
      if (!groups.has(key)) {
        groups.set(key, { folderPath: f.folderPath, dateString, studentIds: new Set() });
      }
      groups.get(key)!.studentIds.add(s.id);
    });
  });

  assert.equal(groups.size, 3);
  assert.equal(groups.get('مجلد_عربي:::2026-11-18')?.studentIds.size, 2);
  assert.equal(groups.get('مجلد_علوم:::2026-11-18')?.studentIds.size, 1);
  assert.equal(groups.get('مجلد_رياضيات:::2026-11-10')?.studentIds.size, 2);

  // 2. Revoke a single folder sent on 2026-11-18 ('مجلد_عربي')
  const folderToRevoke = 'مجلد_عربي';
  const targetDate = '2026-11-18';
  students.forEach(s => {
    s.assignedFiles = s.assignedFiles.filter(f => {
      const isTargetFolder = f.folderPath === folderToRevoke;
      const isTargetDate = f.assignedAt.substring(0, 10) === targetDate;
      return !(isTargetFolder && isTargetDate);
    });
  });

  // Verify 'مجلد_عربي' on 2026-11-18 is revoked from both students
  assert.equal(students[0].assignedFiles.some(f => f.folderPath === 'مجلد_عربي'), false);
  assert.equal(students[1].assignedFiles.some(f => f.folderPath === 'مجلد_عربي'), false);

  // But 'مجلد_علوم' on 2026-11-18 and 'مجلد_رياضيات' on 2026-11-10 REMAIN untouched!
  assert.equal(students[0].assignedFiles.length, 2);
  assert.equal(students[0].assignedFiles[0].folderPath, 'مجلد_علوم');
  assert.equal(students[0].assignedFiles[1].folderPath, 'مجلد_رياضيات');
  assert.equal(students[1].assignedFiles.length, 1);
  assert.equal(students[1].assignedFiles[0].folderPath, 'مجلد_رياضيات');
});
