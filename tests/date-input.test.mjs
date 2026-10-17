import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDMY, maskDMY, parseDMY } from '../lib/date-input.ts';

test('DD/MM/YYYY parses to ISO, including Buddhist-era years', () => {
  assert.equal(parseDMY('18/10/2026'), '2026-10-18');
  assert.equal(parseDMY('1/2/2026'), '2026-02-01');
  assert.equal(parseDMY('18/10/2569'), '2026-10-18');
});

test('impossible or month-first dates are rejected', () => {
  assert.equal(parseDMY('10/18/2026'), null);
  assert.equal(parseDMY('29/02/2026'), null);
  assert.equal(parseDMY('2026-10-18'), null);
  assert.equal(parseDMY(''), null);
});

test('format and mask produce DD/MM/YYYY', () => {
  assert.equal(formatDMY('2026-10-18'), '18/10/2026');
  assert.equal(formatDMY(undefined), '');
  assert.equal(maskDMY('18102026'), '18/10/2026');
  assert.equal(maskDMY('1810'), '18/10');
});
