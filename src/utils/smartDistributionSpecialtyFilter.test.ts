import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_SPECIALIZATIONS,
  normalizeSpecialization,
  resolveStudentSpecialization,
  isSpecializationMatch
} from './assignmentClassifier.ts';

interface MockStudent {
  id: string;
  course: string;
  department?: string;
  educational_specialization?: string;
}

const filterStudents = (students: MockStudent[], selected: string[] | undefined): MockStudent[] =>
  students.filter((s) => isSpecializationMatch(resolveStudentSpecialization(s), selected));

test('selecting علم نفس واجتماع and شريعة ودراسات إسلامية excludes دراسات اجتماعية and neighbors', () => {
  const selected = ['علم نفس واجتماع', 'شريعة ودراسات إسلامية'];

  const students: MockStudent[] = [
    ...Array.from({ length: 66 }, (_, i) => ({
      id: `social_${i}`,
      course: i % 2 === 0 ? 'دراسات اجتماعية' : 'دراسات'
    })),
    { id: 'psych_1', course: 'علم نفس واجتماع' },
    { id: 'psych_2', course: 'علم نفس' },
    { id: 'psych_3', course: 'علم اجتماع' },
    { id: 'sharia_1', course: 'شريعة ودراسات إسلامية' },
    { id: 'sharia_2', course: 'دراسات إسلامية' },
    { id: 'sharia_3', course: 'أصول دين' },
    { id: 'phil_1', course: 'فلسفة ومنطق' },
    { id: 'hist_1', course: 'تاريخ وجغرافيا' },
    { id: 'hist_2', course: 'تاريخ' }
  ];

  const matched = filterStudents(students, selected);
  const matchedIds = matched.map((s) => s.id);

  assert.deepEqual(matchedIds, ['psych_1', 'psych_2', 'psych_3', 'sharia_1', 'sharia_2', 'sharia_3']);
  assert.equal(matched.filter((s) => s.id.startsWith('social_')).length, 0);
  assert.equal(matched.filter((s) => s.id.startsWith('phil_')).length, 0);
  assert.equal(matched.filter((s) => s.id.startsWith('hist_')).length, 0);
});

test('selecting دراسات اجتماعية matches ONLY دراسات اجتماعية and excludes شريعة and علم نفس', () => {
  const selected = ['دراسات اجتماعية'];

  const students: MockStudent[] = [
    { id: 'social_1', course: 'دراسات اجتماعية' },
    { id: 'social_2', course: 'دراسات' },
    { id: 'sharia_1', course: 'شريعة ودراسات إسلامية' },
    { id: 'sharia_2', course: 'دراسات إسلامية' },
    { id: 'psych_1', course: 'علم نفس واجتماع' },
    { id: 'psych_2', course: 'علم اجتماع' },
    { id: 'hist_1', course: 'تاريخ وجغرافيا' }
  ];

  const matched = filterStudents(students, selected);
  assert.deepEqual(matched.map((s) => s.id), ['social_1', 'social_2']);
});

test('all 18 standard specializations map exclusively without cross-bleeding', () => {
  assert.equal(STANDARD_SPECIALIZATIONS.length, 18);

  for (const canonical of STANDARD_SPECIALIZATIONS) {
    assert.equal(normalizeSpecialization(canonical), canonical);
    for (const other of STANDARD_SPECIALIZATIONS) {
      assert.equal(
        isSpecializationMatch(canonical, [other]),
        canonical === other,
        `Expected ${canonical} vs [${other}] to be ${canonical === other}`
      );
    }
  }
});

test('potentially colliding Arabic specialty variants map to distinct canonical categories', () => {
  assert.equal(normalizeSpecialization('تربية فنية'), 'تربية فنية');
  assert.equal(normalizeSpecialization('تربية موسيقية'), 'تربية موسيقية');
  assert.equal(normalizeSpecialization('تربية رياضية'), 'تربية رياضية');
  assert.equal(normalizeSpecialization('رياض أطفال'), 'تعليم ابتدائي / طفولة');
  assert.equal(normalizeSpecialization('رياضيات'), 'رياضيات');

  assert.equal(normalizeSpecialization('لغة عربية'), 'لغة عربية');
  assert.equal(normalizeSpecialization('لغة إنجليزية'), 'لغة إنجليزية');
  assert.equal(normalizeSpecialization('لغة فرنسية'), 'لغة فرنسية');

  assert.equal(normalizeSpecialization('محاسبة'), 'مواد تجارية');
  assert.equal(normalizeSpecialization('علوم حاسب'), 'حاسب آلي وتكنولوجيا تعليم');
  assert.equal(normalizeSpecialization('فني صناعي'), 'زراعي / صناعي');
  assert.equal(normalizeSpecialization('تخصص غير معروف'), 'عام / أخرى');

  assert.equal(isSpecializationMatch('تربية رياضية', ['رياضيات']), false);
  assert.equal(isSpecializationMatch('رياض أطفال', ['رياضيات']), false);
  assert.equal(isSpecializationMatch('محاسبة', ['حاسب آلي وتكنولوجيا تعليم']), false);
  assert.equal(isSpecializationMatch('فني صناعي', ['تربية فنية']), false);
});

test('جميع التخصصات matches all 18 canonical specializations including عام / أخرى', () => {
  for (const canonical of STANDARD_SPECIALIZATIONS) {
    assert.equal(isSpecializationMatch(canonical, ['جميع التخصصات']), true);
  }
  assert.equal(isSpecializationMatch('تخصص مخصص', ['جميع التخصصات']), true);
});
