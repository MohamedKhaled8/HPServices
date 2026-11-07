import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUEST_SPREADSHEET_STANDARD_KEYS,
  workflowStatusLabelAr,
  workflowStatusRank,
  translateKey,
  getServiceNameHelper,
  normPhone
} from './requestsHelpersCore.ts';

// -------------------------------------------------------------
// 1. workflowStatusLabelAr Tests
// -------------------------------------------------------------
test('workflowStatusLabelAr: returns correct Arabic labels for all valid workflow statuses', () => {
  assert.equal(workflowStatusLabelAr('pending'), 'قيد الانتظار');
  assert.equal(workflowStatusLabelAr('submitted'), 'تم التقديم');
  assert.equal(workflowStatusLabelAr('receipt_sent'), 'تم إرسال الإيصال');
  assert.equal(workflowStatusLabelAr('completed'), 'مكتمل');
  assert.equal(workflowStatusLabelAr('rejected'), 'مرفوض');
});

test('workflowStatusLabelAr: gracefully defaults to pending for undefined or unknown status', () => {
  assert.equal(workflowStatusLabelAr(undefined), 'قيد الانتظار');
  assert.equal(workflowStatusLabelAr(''), 'قيد الانتظار');
  assert.equal(workflowStatusLabelAr('unknown_status'), 'قيد الانتظار');
});

// -------------------------------------------------------------
// 2. workflowStatusRank Tests
// -------------------------------------------------------------
test('workflowStatusRank: returns correct numerical ranks for workflow ordering', () => {
  assert.equal(workflowStatusRank('pending'), 0);
  assert.equal(workflowStatusRank('submitted'), 1);
  assert.equal(workflowStatusRank('receipt_sent'), 2);
  assert.equal(workflowStatusRank('completed'), 3);
  assert.equal(workflowStatusRank('rejected'), 4);
});

test('workflowStatusRank: defaults to 0 for undefined or unknown', () => {
  assert.equal(workflowStatusRank(undefined), 0);
  assert.equal(workflowStatusRank(''), 0);
  assert.equal(workflowStatusRank('something_else'), 0);
});

// -------------------------------------------------------------
// 3. translateKey Tests
// -------------------------------------------------------------
test('translateKey: translates known Arabic request schema keys correctly', () => {
  assert.equal(translateKey('fullNameArabic'), 'الاسم بالعربية');
  assert.equal(translateKey('fullNameEnglish'), 'الاسم بالإنجليزية');
  assert.equal(translateKey('nationalID'), 'رقم الهوية');
  assert.equal(translateKey('fawryCode'), 'كود فوري');
  assert.equal(translateKey('receiptUrl'), 'إيصال الدفع');
  assert.equal(translateKey('whatsappNumber'), 'رقم الواتساب');
  assert.equal(translateKey('notes'), 'ملاحظات إضافية');
});

test('translateKey: falls back to the original key string if unknown', () => {
  assert.equal(translateKey('custom_field_xyz'), 'custom_field_xyz');
  assert.equal(translateKey(''), '');
});

// -------------------------------------------------------------
// 4. getServiceNameHelper Tests
// -------------------------------------------------------------
test('getServiceNameHelper: resolves known service IDs to Arabic service names', () => {
  assert.equal(getServiceNameHelper('1'), 'سجل بياناتك');
  assert.equal(getServiceNameHelper('2'), 'العميل المميز');
  assert.equal(getServiceNameHelper('3'), 'شحن الكتب الدراسية');
  assert.equal(getServiceNameHelper('4'), 'دفع المصروفات الدراسية');
  assert.equal(getServiceNameHelper('5'), 'حل وتسليم تكليفات');
  assert.equal(getServiceNameHelper('6'), 'شهادات اونلاين');
  assert.equal(getServiceNameHelper('7'), 'التقديم علي التحول الرقمي');
  assert.equal(getServiceNameHelper('8'), 'المراجعة النهائية');
  assert.equal(getServiceNameHelper('9'), 'مشروع التخرج');
  assert.equal(getServiceNameHelper('10'), 'استخراج مستندات');
  assert.equal(getServiceNameHelper('11'), 'استلام و شحن التحول الرقمي');
  assert.equal(getServiceNameHelper('12'), 'التقديم علي افادة و اثبات قيد');
});

test('getServiceNameHelper: supports custom config service names for services 3, 5, and 8', () => {
  assert.equal(getServiceNameHelper('3', 'شحن كتب خاص'), 'شحن كتب خاص');
  assert.equal(getServiceNameHelper('3'), 'شحن الكتب الدراسية');
  assert.equal(getServiceNameHelper('5', undefined, 'تكليفات خاصة'), 'تكليفات خاصة');
  assert.equal(getServiceNameHelper('5'), 'حل وتسليم تكليفات');
  assert.equal(getServiceNameHelper('8', undefined, undefined, 'مراجعة نهائية خاصة'), 'مراجعة نهائية خاصة');
  assert.equal(getServiceNameHelper('8'), 'المراجعة النهائية');
});

test('getServiceNameHelper: provides readable fallback for unknown service IDs', () => {
  assert.equal(getServiceNameHelper('99999'), 'خدمة 99999');
  assert.equal(getServiceNameHelper(''), 'خدمة غير معروفة');
});

// -------------------------------------------------------------
// 5. normPhone Tests
// -------------------------------------------------------------
test('normPhone: strips non-digits and returns last 10 digits', () => {
  assert.equal(normPhone('+20 100 123 4567'), '01001234567'.slice(-10));
  assert.equal(normPhone('012-3456-7890'), '1234567890');
  assert.equal(normPhone('123'), '');
  assert.equal(normPhone(null), '');
  assert.equal(normPhone(undefined), '');
});

// -------------------------------------------------------------
// 6. REQUEST_SPREADSHEET_STANDARD_KEYS Tests
// -------------------------------------------------------------
test('REQUEST_SPREADSHEET_STANDARD_KEYS: contains core keys for O(1) set lookup', () => {
  assert.ok(REQUEST_SPREADSHEET_STANDARD_KEYS.has('full_name_arabic'));
  assert.ok(REQUEST_SPREADSHEET_STANDARD_KEYS.has('national_id'));
  assert.ok(REQUEST_SPREADSHEET_STANDARD_KEYS.has('fawryCode'));
  assert.ok(REQUEST_SPREADSHEET_STANDARD_KEYS.has('receiptUrl'));
  assert.ok(!REQUEST_SPREADSHEET_STANDARD_KEYS.has('some_random_custom_column_name'));
});
