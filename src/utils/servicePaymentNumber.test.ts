import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getServicePaymentNumber,
  isLegacyStaticPaymentNumber
} from './servicePaymentNumber.ts';

test('selected service shows its own payment number', () => {
  const configs = {
    '3': { instaPay: 'books@instapay', cashWallet: '01011111111' }
  };
  assert.equal(getServicePaymentNumber('3', 'Vodafone', configs), '01011111111');
  assert.equal(getServicePaymentNumber('3', 'instaPay', configs), 'books@instapay');
});

test('different services have different payment numbers', () => {
  const configs = {
    '3': { instaPay: 'books@instapay', cashWallet: '01011111111' },
    '5': { instaPay: 'tasks@instapay', cashWallet: '01022222222' },
    '4': { instaPay: 'fees@instapay', cashWallet: '01033333333' }
  };

  const bookWallet = getServicePaymentNumber('3', 'Vodafone', configs);
  const assignmentWallet = getServicePaymentNumber('5', 'Vodafone', configs);
  const feesInsta = getServicePaymentNumber('4', 'instaPay', configs);

  assert.equal(bookWallet, '01011111111');
  assert.equal(assignmentWallet, '01022222222');
  assert.equal(feesInsta, 'fees@instapay');
  assert.notEqual(bookWallet, assignmentWallet);
});

test('old static number is not used', () => {
  const configs = {
    '8': { instaPay: 'review-unique@instapay', cashWallet: '01199999999' }
  };
  const number = getServicePaymentNumber('8', 'Vodafone', configs);
  assert.equal(number, '01199999999');
  assert.equal(isLegacyStaticPaymentNumber(number), false);
  assert.notEqual(number, '01050889591');
  assert.notEqual(getServicePaymentNumber('8', 'instaPay', configs), 'raoufpk97@instapay');
  assert.notEqual(getServicePaymentNumber('8', 'instaPay', configs), '01017180923');
});

test('missing payment number is handled safely', () => {
  assert.equal(getServicePaymentNumber('2', 'Vodafone', {}), '');
  assert.equal(getServicePaymentNumber('3', 'Vodafone', { '3': {} }), '');
  assert.equal(getServicePaymentNumber('3', 'Cash', { '3': { cashWallet: '01011111111' } }), '');
  assert.equal(getServicePaymentNumber('3', 'Vodafone', { '3': { cashWallet: '   ' } }), '');
});
