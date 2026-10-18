import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createTestDb, asUser } from '../supabase/tests/harness.mjs';

const nativeRequire = createRequire(import.meta.url);
const ADMIN = '00000000-0000-0000-0000-0000000000ad';
const OWNER = '00000000-0000-0000-0000-0000000000ae';
const TENANT = '00000000-0000-0000-0000-00000000000a';
const INV = '30000000-0000-4000-8000-000000000001';

function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : nativeRequire(name), loaded, loaded.exports);
  return loaded.exports;
}

async function fixture() {
  const db = await createTestDb();
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${OWNER}'), ('${TENANT}');
    insert into profiles(id,role) values ('${ADMIN}','admin'), ('${OWNER}','owner'), ('${TENANT}','tenant');
    insert into rooms(id,room_no,unit_type) values ('10000000-0000-4000-8000-000000000001','101','residential');
    insert into leases(id,room_id,start_date,rent_amount,due_day) values
      ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-01-01',100,31);
    insert into lease_tenants(lease_id,profile_id,is_primary) values
      ('20000000-0000-4000-8000-000000000001','${TENANT}',true);
    insert into invoices(id,lease_id,period,due_date,total,status) values
      ('${INV}','20000000-0000-4000-8000-000000000001','2026-10-01','2026-10-31',100,'issued');
  `);
  return db;
}

// Execute the handlers' data calls against the real migrated Postgres engine.
// Only auth, Storage and the external provider are mocked; no network is used.
function dataClient(db, options = {}) {
  return {
    from(table) {
      let op = 'select', values, columns = '*', single = false, returning = false, max;
      const filters = [];
      const query = {
        select(v = '*') { columns = v; returning = true; return query; },
        eq(k, v) { filters.push([k, [v]]); return query; },
        in(k, v) { filters.push([k, v]); return query; },
        limit(v) { max = v; return query; },
        insert(v) { op = 'insert'; values = v; return query; },
        maybeSingle() { single = true; return run(); },
        single() { single = true; return run(); },
        then(resolve, reject) { return run().then(resolve, reject); },
      };
      async function run() {
        const params = [];
        const bind = v => { params.push(v); return '$' + params.length; };
        let sql = 'select ' + columns + ' from public.' + table;
        if (op === 'insert') {
          const keys = Object.keys(values);
          sql = 'insert into public.' + table + '(' + keys.join(',') + ') values (' + keys.map(k => bind(values[k])).join(',') + ')';
        }
        if (filters.length) sql += ' where ' + filters.map(([k, vs]) => k + ' in (' + vs.map(bind).join(',') + ')').join(' and ');
        if (max) sql += ' limit ' + Number(max);
        if (op !== 'select' && returning) sql += ' returning ' + columns;
        try {
          const { rows } = await db.query(sql, params);
          if (table === 'payments' && op === 'insert' && options.loseInsertResponse) {
            options.loseInsertResponse = false;
            return { data: null, error: { code: '08006', message: 'insert committed but response lost' } };
          }
          return { data: single ? rows[0] ?? null : rows, error: null };
        } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
      }
      return query;
    },
    async rpc(name, args) {
      if (options.failFinalize) {
        options.failFinalize = false;
        return { data: null, error: { message: 'injected database failure' } };
      }
      assert.equal(name, 'finalize_invoice_payment_verification');
      try {
        const { rows } = await db.query('select public.finalize_invoice_payment_verification($1,$2) as status', [args.p_payment_id, args.p_actor_id]);
        return { data: rows[0].status, error: null };
      } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
    },
  };
}

test('saved slip is recoverable without reupload/provider call; log, reference and admin alerts persist', async () => {
  const db = await fixture();
  const realFetch = globalThis.fetch;
  let providerCalls = 0, uploads = 0, deletes = 0;
  const admin = dataClient(db, { failFinalize: true, loseInsertResponse: true });
  const session = { ...dataClient(db), auth: { getUser: async () => ({ data: { user: { id: TENANT } } }) } };
  try {
    const { POST } = load('../app/api/slipok/verify/route.ts', {
      '@/lib/phase1': { audit: async () => {}, toNumberOrNull: v => v == null ? null : Number(v) },
      '@/lib/settings': { getSetting: async () => 'fixture-not-a-key', isSlipokConfigured: async () => true },
      '@/lib/supabase/admin': { createAdminClient: () => admin },
      '@/lib/supabase/server': { createClient: async () => session },
      '@/lib/payment-status': { OPEN_PAYMENT_STATUSES: ['uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'pending_review'] },
      '@/lib/storage': {
        storagePath: (...parts) => parts.join('/'),
        uploadPrivateFile: async (_, path) => { uploads++; return path; },
        removePrivateFile: async () => { deletes++; },
      },
    });
    globalThis.fetch = async () => {
      providerCalls++;
      return Response.json({ success: true, data: { success: true, transRef: 'valid-original-reference', amount: 100 } });
    };
    const form = new FormData();
    form.set('invoice_id', INV);
    form.set('slip', new File(['fixture'], 'slip.png', { type: 'image/png' }));
    const response = await POST(new Request('https://review.local/api/slipok/verify', { method: 'POST', headers: { origin: 'https://review.local' }, body: form }));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).saved, true);
    const payment = (await db.query('select id::text,slip_path,status,submitted_by::text from payments')).rows[0];
    assert.equal(payment.status, 'uploaded');
    assert.equal(payment.submitted_by, TENANT);
    assert.ok(payment.slip_path.startsWith('slips/'));
    assert.equal((await db.query('select count(*)::int as n from notifications')).rows[0].n, 2);
    assert.equal((await asUser(db, TENANT, "select id from notifications where channel='web'")).rows.length, 0);
    await assert.rejects(asUser(db, TENANT, "insert into notifications(profile_id,type,channel) values ('" + TENANT + "','payment_uploaded','web')"), /permission denied/);
    await assert.rejects(asUser(db, ADMIN, "select finalize_invoice_payment_verification('" + payment.id + "','" + ADMIN + "')"), /permission denied/);
    await assert.rejects(asUser(db, TENANT, "select finalize_invoice_payment_verification('" + payment.id + "','" + TENANT + "')"), /permission denied/);
    await assert.rejects(asUser(db, ADMIN, "select approve_invoice_payment('" + payment.id + "',100)"), /not eligible/);

    let role = 'tenant';
    const { recoverPayment } = load('../app/admin/payments/actions.ts', {
      'next/cache': { revalidatePath() {} },
      '@/lib/phase1': { requireStaff: async () => { if (role !== 'admin') throw Error('staff only'); return { userId: ADMIN }; } },
      '@/lib/supabase/server': { createClient: async () => ({}) },
      '@/lib/supabase/admin': { createAdminClient: () => admin },
      '@/lib/notify': { notifyPaymentResult: async () => {} },
    });
    const recovery = new FormData(); recovery.set('payment_id', payment.id);
    assert.equal((await recoverPayment(null, recovery)).ok, false);
    role = 'admin';
    assert.equal((await recoverPayment(null, recovery)).ok, true);
    assert.equal((await recoverPayment(null, recovery)).ok, true);
    assert.equal((await db.query('select status from payments where id=$1', [payment.id])).rows[0].status, 'slipok_passed');
    assert.equal((await db.query('select status from invoices where id=$1', [INV])).rows[0].status, 'pending_review');
    assert.equal((await db.query('select count(*)::int as n from payment_verifications')).rows[0].n, 1);
    assert.equal((await db.query('select provider_reference from payment_verifications')).rows[0].provider_reference, 'valid-original-reference');
    assert.equal((await db.query("select count(*)::int as n from audit_logs where action='payment.verification.finalize'")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int as n from audit_logs where action='payment.upload.received' and actor_id=$1", [TENANT])).rows[0].n, 1);
    assert.deepEqual([providerCalls, uploads, deletes], [1, 1, 0]);
    await asUser(db, ADMIN, "select approve_invoice_payment('" + payment.id + "',100)");
    assert.equal((await db.query('select status from invoices where id=$1', [INV])).rows[0].status, 'paid');
    await assert.rejects(admin.rpc('finalize_invoice_payment_verification', { p_payment_id: payment.id, p_actor_id: ADMIN }).then(r => { if (r.error) throw Error(r.error.message); }), /not open/);
  } finally { globalThis.fetch = realFetch; await db.close(); }
});

test('recovery refuses absent/invalid logs, preserves mismatch, and rolls back on audit failure', async () => {
  const db = await fixture();
  try {
    const payment = (await db.query("insert into payments(invoice_id,slip_path) values ($1,'fixture.png') returning id::text", [INV])).rows[0].id;
    const finish = () => db.query('select finalize_invoice_payment_verification($1,$2)', [payment, ADMIN]);
    await assert.rejects(finish(), /saved verification unavailable/);
    await db.query("insert into payment_verifications(payment_id,result,provider_reference) values ($1,$2,'ref')", [payment, JSON.stringify({ status: 'slipok_passed', amount: 99, reference: 'ref' })]);
    await assert.rejects(finish(), /does not match invoice/);
    const extraLog = (await db.query("insert into payment_verifications(payment_id,result) values ($1,'{\"status\":\"pending_review\"}') returning id::text", [payment])).rows[0].id;
    await assert.rejects(finish(), /ambiguous/);
    await db.query('delete from payment_verifications where id=$1', [extraLog]);
    await db.query('update payment_verifications set result=$1 where payment_id=$2', [JSON.stringify({ status: 'approved' }), payment]);
    await assert.rejects(finish(), /saved verification invalid/);
    await db.query('update payment_verifications set result=$1 where payment_id=$2', [JSON.stringify({ status: 'slipok_passed', amount: 100, reference: 'ref' }), payment]);
    await db.exec("alter table audit_logs add constraint fixture_finalize_failure check (action <> 'payment.verification.finalize') not valid");
    await assert.rejects(finish(), /fixture_finalize_failure/);
    assert.equal((await db.query('select status from payments')).rows[0].status, 'uploaded');
    assert.equal((await db.query('select status from invoices')).rows[0].status, 'issued');
    await db.exec('alter table audit_logs drop constraint fixture_finalize_failure');
    await db.query('update payment_verifications set result=$1 where payment_id=$2', [JSON.stringify({ status: 'mismatch', reason: 'duplicate_reference' }), payment]);
    await finish();
    assert.equal((await db.query('select status from payments')).rows[0].status, 'mismatch');
    await assert.rejects(asUser(db, ADMIN, "select approve_invoice_payment('" + payment + "',100)"), /not eligible/);
    await assert.rejects(db.query("insert into payment_verifications(payment_id,result,provider_reference) values ($1,'{}','ref')", [payment]), /duplicate key/);
    const invoice2 = (await db.query("insert into invoices(lease_id,period,due_date,total,status) select lease_id,'2026-11-01','2026-11-30',100,'issued' from invoices where id=$1 returning id::text", [INV])).rows[0].id;
    await db.exec("alter table notifications add constraint fixture_notification_failure check (channel <> 'web') not valid");
    await assert.rejects(db.query("insert into payments(invoice_id,slip_path) values ($1,'notification-failure.png')", [invoice2]), /fixture_notification_failure/);
    assert.equal((await db.query("select count(*)::int as n from payments where invoice_id=$1", [invoice2])).rows[0].n, 0);
  } finally { await db.close(); }
});

test('web notification endpoint authenticates staff and returns only the pending queue summary', async () => {
  let user = null, role = 'tenant', reads = 0, failed = false;
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      if (table === 'profiles') return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { role }, error: null }; } };
      assert.equal(table, 'payments'); reads++;
      return { select() { return this; }, in() { return this; }, order() { return this; }, async limit() {
        return failed ? { error: { message: 'fixture failure' } } : { data: [{ id: 'p', status: 'uploaded', invoices: { period: '2026-10-01', leases: { rooms: { room_no: '101' } } } }], count: 4, error: null };
      } };
    },
  };
  const { GET } = load('../app/api/admin/payment-notifications/route.ts', {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/payment-status': { OPEN_PAYMENT_STATUSES: ['uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'pending_review'] },
  });
  assert.equal((await GET()).status, 401);
  user = { id: TENANT };
  assert.equal((await GET()).status, 403);
  assert.equal(reads, 0);
  role = 'admin';
  const response = await GET();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { count: 4, items: [{ id: 'p', status: 'uploaded', period: '2026-10', room: '101' }] });
  failed = true;
  assert.equal((await GET()).status, 500);
});
