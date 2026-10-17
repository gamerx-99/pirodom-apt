import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc16, promptPayPayload } from '../lib/promptpay.ts';

test('crc16 matches the CRC-16/CCITT-FALSE check value', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('phone target is converted to 0066 format with amount and valid CRC', () => {
  const payload = promptPayPayload('081-234-5678', 3720);
  assert.ok(payload);
  assert.ok(payload.startsWith('000201010212'));
  assert.ok(payload.includes('29370016A000000677010111011300668123456785303764'));
  assert.ok(payload.includes('54073720.005802TH6304'));
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
});

test('13-digit ID uses sub-tag 02', () => {
  const payload = promptPayPayload('1234567890123', 1);
  assert.ok(payload.includes('0016A00000067701011102131234567890123'));
});

test('invalid IDs or amounts produce no payload', () => {
  assert.equal(promptPayPayload('12345', 100), null);
  assert.equal(promptPayPayload('0812345678', 0), null);
  assert.equal(promptPayPayload('0812345678', Number.NaN), null);
});
