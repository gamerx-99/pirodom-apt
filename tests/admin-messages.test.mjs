import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { fillMessage } from '../lib/messages.ts';

const nativeRequire = createRequire(import.meta.url);

function loadAction(mocks) {
  const code = ts.transpileModule(readFileSync(new URL('../app/admin/messages/actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : nativeRequire(name), loaded, loaded.exports);
  return loaded.exports;
}

function fixture({ authorized = true } = {}) {
  const rows = [];
  const sent = [];
  let roleAllowed = authorized;
  const recipients = [
    { id: 'lease-a', room_no: '101', lease_tenants: [{ profile_id: 'tenant-a', profiles: { display_name: 'A', line_user_id: 'U-A' } }], invoices: [{ total: 1250.5, due_date: '2026-10-31', status: 'issued' }] },
    { id: 'lease-b', room_no: '102', lease_tenants: [{ profile_id: 'tenant-b', profiles: { display_name: 'B', line_user_id: null } }], invoices: [] },
  ];
  let nextId = 0;
  const client = {
    from(table) {
      let op = 'select', values, id, allowedStatuses;
      const query = {
        select() { return query; },
        eq(key, value) { if (key === 'id') id = value; return query; },
        in(_key, value) { allowedStatuses = value; return query; },
        insert(value) { op = 'insert'; values = value; return query; },
        update(value) { op = 'update'; values = value; return query; },
        single: async () => {
          const row = { ...values, id: `notification-${++nextId}`, status: 'pending' };
          rows.push(row);
          return { data: { id: row.id }, error: null };
        },
        maybeSingle: async () => {
          const row = rows.find(item => item.id === id && allowedStatuses?.includes(item.status));
          if (!row) return { data: null, error: null };
          Object.assign(row, values);
          return { data: { id: row.id, message: row.message, profiles: { line_user_id: 'U-A' } }, error: null };
        },
        then(resolve, reject) {
          if (table === 'leases' && op === 'select') return Promise.resolve({ data: recipients, error: null }).then(resolve, reject);
          if (table === 'notifications' && op === 'update') {
            const row = rows.find(item => item.id === id);
            if (row) Object.assign(row, values);
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          throw new Error(`unexpected query ${table}/${op}`);
        },
      };
      return query;
    },
  };
  const actions = loadAction({
    'next/cache': { revalidatePath() {} },
    '@/lib/env': { getEnv: () => 'test-token' },
    '@/lib/line-push': { pushLineText: async (_token, to, text) => {
      if (!to) return { status: 'skipped', error: 'profile has no LINE user id' };
      sent.push({ to, text });
      return { status: 'sent' };
    } },
    '@/lib/messages': { MESSAGE_MAX_LENGTH: 1000, fillMessage },
    '@/lib/phase1': { requireStaff: async () => { if (!roleAllowed) throw new Error('staff only'); return { userId: 'admin-a' }; } },
    '@/lib/recipients': { loadRecipients: async () => {
      const { data, error } = await client.from('leases').select().eq('status', 'active');
      if (error) throw error;
      return data.map(lease => {
        const open = lease.invoices.filter(invoice => ['issued', 'overdue'].includes(invoice.status));
        return { leaseId: lease.id, roomNo: lease.room_no, tenants: lease.lease_tenants.map(t => ({ profileId: t.profile_id, name: t.profiles.display_name, lineUserId: t.profiles.line_user_id })), unpaid: open.reduce((sum, invoice) => sum + invoice.total, 0), nextDue: open.map(invoice => invoice.due_date).sort()[0] ?? null };
      });
    } },
    '@/lib/supabase/admin': { createAdminClient: () => client },
    '@/lib/supabase/server': { createClient: async () => ({}) },
  });
  return { ...actions, rows, sent, client, setAuthorized: value => { roleAllowed = value; } };
}

test('message template fills room, unpaid total and earliest due date', () => {
  assert.equal(fillMessage('{ห้อง} {ยอดค้าง} {ครบกำหนด}', { room: '101', unpaid: 1250.5, nextDue: '2026-10-31' }), '101 1,250.50 2026-10-31');
  assert.equal(fillMessage('{ครบกำหนด}', { room: '101', unpaid: 0, nextDue: null }), '-');
});

test('send action authorizes staff and derives recipients from the server, then persists per-tenant result', async () => {
  const f = fixture();
    const unauthorized = new FormData();
    unauthorized.set('mode', 'all'); unauthorized.set('message', 'Hello');
    f.setAuthorized(false);
    assert.equal((await f.sendMessages(null, unauthorized)).ok, false);
    assert.equal(f.rows.length, 0);
    f.setAuthorized(true);

    const form = new FormData();
    form.set('mode', 'unpaid');
    form.set('message', 'ห้อง {ห้อง} ค้าง {ยอดค้าง} ครบ {ครบกำหนด}');
    form.set('lease_id', 'forged-lease'); // ignored for unpaid mode
    const result = await f.sendMessages(null, form);
    assert.deepEqual(result, { ok: true, message: 'ส่งแล้ว 1 · ไม่สำเร็จ 0 · ข้าม 0' });
    assert.equal(f.rows.length, 1);
    assert.equal(f.rows[0].profile_id, 'tenant-a');
    assert.equal(f.rows[0].created_by, 'admin-a');
    assert.equal(f.rows[0].message, 'ห้อง 101 ค้าง 1,250.50 ครบ 2026-10-31');
    assert.equal(f.rows[0].status, 'sent');
    assert.deepEqual(f.sent, [{ to: 'U-A', text: 'ห้อง 101 ค้าง 1,250.50 ครบ 2026-10-31' }]);
});

test('resend atomically claims only failed/skipped rows and preserves prior result if row is already pending', async () => {
  const f = fixture();
  f.rows.push({ id: 'failed-1', profile_id: 'tenant-a', message: 'Saved message', channel: 'line', status: 'failed' });
  const form = new FormData(); form.set('notification_id', 'failed-1');
  assert.deepEqual(await f.resendNotification(null, form), { ok: true, message: 'ส่งข้อความแล้ว' });
  assert.equal(f.rows[0].status, 'sent');
  assert.deepEqual(f.sent, [{ to: 'U-A', text: 'Saved message' }]);
  assert.deepEqual(await f.resendNotification(null, form), { ok: false, message: 'รายการนี้ถูกส่งแล้วหรือกำลังดำเนินการ กรุณารีเฟรชประวัติ' });
});
