import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paymentResultText, pushLineText } from '../lib/line-push.ts';
import { createTestDb, asUser } from '../supabase/tests/harness.mjs';

const okFetch = (calls) => async (url, init) => {
  calls.push({ url, init });
  return new Response('{}', { status: 200 });
};

test('push is skipped without token or LINE id and never calls the network', async () => {
  const calls = [];
  assert.equal((await pushLineText(undefined, 'U1', 'x', okFetch(calls))).status, 'skipped');
  assert.equal((await pushLineText('t', null, 'x', okFetch(calls))).status, 'skipped');
  assert.equal(calls.length, 0);
});

test('push sends one text message and reports HTTP or network failures without throwing', async () => {
  const calls = [];
  assert.deepEqual(await pushLineText('t', 'U1', 'hello', okFetch(calls)), { status: 'sent' });
  assert.equal(calls[0].url, 'https://api.line.me/v2/bot/message/push');
  assert.equal(calls[0].init.headers.authorization, 'Bearer t');
  assert.deepEqual(JSON.parse(calls[0].init.body), { to: 'U1', messages: [{ type: 'text', text: 'hello' }] });

  const http = await pushLineText('t', 'U1', 'x', async () => new Response('bad', { status: 400 }));
  assert.equal(http.status, 'failed');
  assert.match(http.error, /HTTP 400/);
  const net = await pushLineText('t', 'U1', 'x', async () => { throw new Error('offline'); });
  assert.deepEqual(net, { status: 'failed', error: 'offline' });
});

test('result text carries room, period, total and the rejection reason', () => {
  const base = { roomNo: '101', period: '2026-11-01', total: 3720 };
  assert.match(paymentResultText({ ...base, result: 'approved' }), /ห้อง 101 งวด 2026-11 ยอด 3,720\.00 บาท\n.*ยืนยันการชำระแล้ว/);
  assert.match(paymentResultText({ ...base, result: 'rejected', reason: 'ยอดไม่ตรง' }), /ไม่ผ่านการตรวจ: ยอดไม่ตรง/);
});

test('LINE result rows are unique per tenant/payment/type and tenants cannot write them', async () => {
  const db = await createTestDb();
  const T = '00000000-0000-0000-0000-00000000000a';
  await db.exec(`
    insert into auth.users values ('${T}'), ('00000000-0000-0000-0000-0000000000ad');
    insert into profiles (id, role, line_user_id) values ('${T}', 'tenant', 'U-tenant'), ('00000000-0000-0000-0000-0000000000ad', 'admin', null);
    insert into rooms (id, room_no, unit_type) values ('10000000-0000-0000-0000-000000000001', '101', 'residential');
    insert into leases (id, room_id, start_date, rent_amount, due_day) values
      ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-10-01', 3500, 31);
    insert into lease_tenants values ('20000000-0000-0000-0000-000000000001', '${T}', true);
    insert into invoices (id, lease_id, period, due_date, total, status) values
      ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-11-01', '2026-11-30', 3500, 'issued');
    insert into payments (id, invoice_id, slip_path, status) values
      ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 's.jpg', 'pending_review');
  `);
  const insert = `insert into notifications (profile_id, type, channel, payment_id, status, sent_at)
    values ('${T}', 'payment_approved', 'line', '40000000-0000-0000-0000-000000000001', 'pending', null)`;
  await db.exec(insert);
  await assert.rejects(db.exec(insert), /duplicate key/);
  // web แจ้งแอดมินเดิมยังได้ status 'sent' และ sent_at อัตโนมัติ
  const web = await db.query("select status, sent_at is not null as stamped from notifications where channel = 'web'");
  assert.deepEqual(web.rows, [{ status: 'sent', stamped: true }]);
  await assert.rejects(asUser(db, T, insert.replace('payment_approved', 'payment_rejected')), /permission denied/);
  assert.equal((await asUser(db, T, "select id from notifications where channel = 'line'")).rows.length, 1);
});
