import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);
const ROOM = '10000000-0000-4000-8000-000000000001';
const LEASE = '20000000-0000-4000-8000-000000000001';
const METER = '30000000-0000-4000-8000-000000000001';

function loadActions(mocks) {
  const code = ts.transpileModule(readFileSync(new URL('../app/admin/billing/actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : nativeRequire(name), loaded, loaded.exports);
  return loaded.exports;
}

function fixture(options = {}) {
  const lease = {
    id: LEASE, room_id: ROOM, start_date: '2026-01-01', end_date: null,
    rent_amount: 1000, water_fee: 50, electric_rate: 5, status: 'active',
    room: { room_no: '101' }, lease_tenants: [{ profile_id: 'tenant-a' }],
    ...options.lease,
  };
  const meter = { id: METER, room_id: ROOM, period: '2026-10-01', prev_value: 100, curr_value: 150, units: 50, ...options.meter };
  const invoices = [...(options.invoices ?? [])];
  const items = [];
  const audits = [];
  let nextId = 0;
  const client = {
    from(table) {
      let op = 'select', values = null;
      const filters = {};
      let returning = false;
      const query = {
        select() { returning = true; return query; },
        eq(key, value) { filters[key] = value; return query; },
        insert(value) { op = 'insert'; values = value; return query; },
        update(value) { op = 'update'; values = value; return query; },
        delete() { op = 'delete'; return query; },
        maybeSingle() { return run(true); },
        single() { return run(true); },
        then(resolve, reject) { return run(false).then(resolve, reject); },
      };
      async function run(single) {
        if (table === 'leases' && op === 'select') return { data: filters.id === LEASE ? lease : null, error: null };
        if (table === 'meter_readings' && op === 'select') {
          const found = meter.id === filters.id && meter.room_id === filters.room_id ? meter : null;
          return { data: found, error: null };
        }
        if (table === 'invoices' && op === 'select') {
          const found = invoices.find(row => (!filters.id || row.id === filters.id) && (!filters.lease_id || row.lease_id === filters.lease_id) && (!filters.period || row.period === filters.period));
          return { data: found ?? null, error: null };
        }
        if (table === 'invoices' && op === 'insert') {
          if (options.failInvoiceInsert) return { data: null, error: { code: '23505' } };
          const row = { ...values, id: `invoice-${++nextId}` };
          invoices.push(row);
          return { data: { id: row.id }, error: null };
        }
        if (table === 'invoices' && op === 'update') {
          const row = invoices.find(item => item.id === filters.id && (!filters.status || item.status === filters.status));
          if (row) Object.assign(row, values);
          return { data: returning && row ? { id: row.id } : null, error: null };
        }
        if (table === 'invoices' && op === 'delete') {
          const index = invoices.findIndex(row => row.id === filters.id && row.status === filters.status);
          if (index < 0) return { data: null, error: null };
          const [row] = invoices.splice(index, 1);
          return { data: single ? { id: row.id, lease_id: row.lease_id, period: row.period, due_date: row.due_date, total: row.total } : null, error: null };
        }
        if (table === 'invoice_items' && op === 'insert') {
          if (options.failItemsInsert) return { data: null, error: { message: 'injected item insert failure' } };
          items.push(...values);
          return { data: null, error: null };
        }
        if (table === 'invoice_items' && op === 'select') return { data: items.filter(item => item.invoice_id === filters.invoice_id), error: null };
        if (table === 'audit_logs' && op === 'insert') { audits.push(values); return { data: null, error: null }; }
        throw new Error(`unexpected query ${table}/${op}`);
      }
      return query;
    },
  };
  const actions = loadActions({
    'next/cache': { revalidatePath() {} },
    '@/lib/phase1': {
      requireStaff: async () => ({ userId: 'admin-a' }),
      audit: async (_client, row) => { audits.push(row); },
      toNumberOrNull: value => value == null || String(value).trim() === '' ? null : Number(value),
    },
    '@/lib/format': { todayTH: () => '2026-10-17' },
    '@/lib/supabase/admin': { createAdminClient: () => client },
    '@/lib/supabase/server': { createClient: async () => ({}) },
  });
  return { ...actions, invoices, items, audits, lease, meter };
}

function draftForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ lease_id: LEASE, period: '2026-10', due_date: '2026-10-31', meter_reading_id: METER, extra_amount: '50', extra_description: 'ค่าทำกุญแจ', discount_amount: '25', discount_description: 'ส่วนลดที่อนุมัติ', ...overrides })) form.set(key, value);
  return form;
}

test('draft action creates complete-month invoice snapshot and reports room number', async () => {
  const f = fixture();
  const result = await f.createInvoiceDraft(null, draftForm());
  assert.deepEqual(result, { ok: true, message: 'สร้างบิลร่างห้อง 101 แล้ว ตรวจยอดก่อนออกบิล' });
  assert.equal(f.invoices.length, 1);
  assert.deepEqual(f.invoices[0], { lease_id: LEASE, period: '2026-10-01', issue_date: '2026-10-17', due_date: '2026-10-31', total: 1325, status: 'draft', id: 'invoice-1' });
  assert.deepEqual(f.items.map(item => [item.type, item.amount]), [['rent', 1000], ['water', 50], ['electric', 250], ['extra', 50], ['discount', -25]]);
  assert.equal(f.items.find(item => item.type === 'electric').meter_reading_id, METER);
  assert.equal(f.audits[0].after.room_no, '101');
});

test('draft action rejects unsupported period/amount/duplicate cases before creating a bill', async () => {
  const f = fixture();
  assert.equal((await f.createInvoiceDraft(null, draftForm({ period: '2026-02-31' }))).ok, false);
  assert.equal((await f.createInvoiceDraft(null, draftForm({ period: '2026-11', due_date: '2026-11-31' }))).ok, false);
  assert.equal((await f.createInvoiceDraft(null, draftForm({ extra_amount: 'abc' }))).ok, false);
  assert.equal((await f.createInvoiceDraft(null, draftForm({ extra_amount: '1', extra_description: '' }))).ok, false);
  assert.equal((await f.createInvoiceDraft(null, draftForm({ discount_amount: '1350' }))).ok, false); // total zero
  assert.equal(f.invoices.length, 0);

  const duplicate = fixture({ invoices: [{ id: 'existing', lease_id: LEASE, period: '2026-10-01', status: 'draft' }] });
  assert.equal((await duplicate.createInvoiceDraft(null, draftForm())).ok, false);
  assert.equal(duplicate.invoices.length, 1);

  const wrongRoom = fixture({ meter: { room_id: 'other-room' } });
  assert.equal((await wrongRoom.createInvoiceDraft(null, draftForm())).ok, false);
  assert.equal(wrongRoom.invoices.length, 0);

  const partialMonth = fixture({ lease: { start_date: '2026-10-02' } });
  assert.equal((await partialMonth.createInvoiceDraft(null, draftForm())).ok, false);
  assert.equal(partialMonth.invoices.length, 0);
});

test('draft item failure rolls back draft; issuing requires an exact positive item total', async () => {
  const broken = fixture({ failItemsInsert: true });
  assert.equal((await broken.createInvoiceDraft(null, draftForm())).ok, false);
  assert.equal(broken.invoices.length, 0);

  const f = fixture();
  assert.deepEqual(await f.createInvoiceDraft(null, draftForm()), { ok: true, message: 'สร้างบิลร่างห้อง 101 แล้ว ตรวจยอดก่อนออกบิล' });
  const invoiceId = f.invoices[0].id;
  f.items[0].amount += 1;
  const issueForm = new FormData(); issueForm.set('invoice_id', invoiceId);
  await assert.rejects(f.issueInvoiceDraft(issueForm), /ยอดรวมไม่ตรง/);
  f.items[0].amount -= 1;
  await f.issueInvoiceDraft(issueForm);
  assert.equal(f.invoices[0].status, 'issued');
  assert.equal(f.audits.at(-1).after.status, 'issued');
  await assert.rejects(f.issueInvoiceDraft(issueForm), /เฉพาะรายการร่าง/);
});
