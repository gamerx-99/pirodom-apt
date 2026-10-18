// ทดสอบ migration + RLS บน PGlite (ไม่ต้องใช้ Docker): npm test
// จำลองส่วนของ Supabase ที่ migration ใช้: auth.users, auth.uid(), storage.buckets, storage.objects, role anon/authenticated
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamptz default now()
  );
  -- บน Supabase โฮสต์ storage.objects เปิด RLS อยู่แล้ว (migration ห้ามสั่ง enable เอง
  -- เพราะไม่ได้เป็นเจ้าของตาราง) ชุดทดสอบต้องจำลองสภาพนั้นเอง
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema storage grant all on tables to anon, authenticated;
  -- Supabase โฮสต์ grant execute ให้ anon/authenticated เป็นค่าเริ่มต้นของฟังก์ชันใน schema public
  -- ถ้าไม่จำลองตรงนี้ ชุดทดสอบจะพลาดกรณีฟังก์ชันที่ถอนสิทธิ์ไว้ยังถูกเรียกจาก REST ได้
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  grant all on storage.objects to anon, authenticated;
`);

const dir = new URL("../migrations/", import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), "utf8"));

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const C = "00000000-0000-0000-0000-00000000000c"; // ผู้เช่าเก่าห้อง 101 (ย้ายออกแล้ว)
await db.exec(`
  insert into auth.users values ('${A}'), ('${B}'), ('${C}'), ('${ADMIN}');
  insert into profiles (id, role) values ('${A}', 'tenant'), ('${B}', 'tenant'), ('${C}', 'tenant'), ('${ADMIN}', 'admin');
  insert into rooms (id, room_no, unit_type) values
    ('10000000-0000-0000-0000-000000000001', '101', 'residential'),
    ('10000000-0000-0000-0000-000000000002', '205', 'residential');
  insert into leases (id, room_id, start_date, rent_amount, due_day) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-10-01', 3500, 31),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-10-10', 3500, 10);
  insert into leases (id, room_id, start_date, end_date, status, rent_amount, due_day) values
    ('20000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', '2026-01-01', '2026-09-30', 'ended', 3500, 31);
  insert into lease_tenants values
    ('20000000-0000-0000-0000-000000000001', '${A}', true),
    ('20000000-0000-0000-0000-000000000002', '${B}', true),
    ('20000000-0000-0000-0000-00000000000c', '${C}', true);
  insert into meter_readings (room_id, period, prev_value, curr_value) values
    ('10000000-0000-0000-0000-000000000001', '2026-09-01', 100, 150),
    ('10000000-0000-0000-0000-000000000001', '2026-11-01', 150, 230);
  insert into maintenance_requests (room_id, category, created_at) values
    ('10000000-0000-0000-0000-000000000001', 'ประปา', '2026-06-01');
  insert into invoices (id, lease_id, period, due_date, total, status) values
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '2026-12-01', '2026-11-30', 3500, 'issued'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '2026-12-01', '2026-12-10', 3500, 'issued');
`);

async function as(uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
}
const rejects = (p, re) => assert.rejects(p, re);

// รันเป็นบทบาทที่ระบุ (anon ไม่มี claim, authenticated มี sub)
async function asRole(role, uid, sql) {
  const claim = uid ? `select set_config('request.jwt.claim.sub', '${uid}', false);` : "";
  await db.exec(`set role ${role}; ${claim}`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
}

// ผู้เช่า A เห็นเฉพาะของตัวเอง
assert.equal((await as(A, "select id from invoices")).rows.length, 1);
assert.equal((await as(A, "select id from rooms")).rows.length, 1);
assert.equal((await as(A, "select id from profiles")).rows.length, 1);
assert.equal((await as(A, "select id from room_invitations")).rows.length, 0);
// แอดมินเห็นทั้งหมด
assert.equal((await as(ADMIN, "select id from invoices")).rows.length, 2);

// สร้าง payment จาก client ไม่ได้เลย ต้องผ่าน /api/slipok/verify (service role) ที่ตรวจ SlipOK/reference ซ้ำ
await rejects(as(A, "insert into payments (invoice_id, slip_path) values ('30000000-0000-0000-0000-000000000001', 'a.jpg')"), /permission denied/);
await rejects(as(A, "insert into payments (invoice_id, slip_path) values ('30000000-0000-0000-0000-000000000002', 'b.jpg')"), /permission denied/);
await rejects(as(A, "insert into payments (invoice_id, slip_path, status) values ('30000000-0000-0000-0000-000000000001', 'a.jpg', 'approved')"), /permission denied/);

// แก้บิล/สถานะจาก client ไม่ได้ แม้เป็นแอดมิน (ต้องผ่าน server)
await rejects(as(A, "update invoices set status = 'paid'"), /permission denied/);
await rejects(as(ADMIN, "update invoices set total = 0"), /permission denied/);

// ---------- อนุมัติชำระ: staff เท่านั้น, ยอดเต็มบิล, อนุมัติซ้ำไม่ได้, บิลชำระแล้วล็อก ----------
const INV1 = "30000000-0000-0000-0000-000000000001";
const PAY = (await db.query(
  "insert into payments (invoice_id, slip_path, status) values ($1, 's.jpg', 'pending_review') returning id::text as id",
  [INV1],
)).rows[0].id;
// หนึ่งรายการเปิดต่อบิล
await rejects(db.query("insert into payments (invoice_id, slip_path) values ($1, 'dup.jpg')", [INV1]), /duplicate key/);
const approve = (uid, amount) => as(uid, `select public.approve_invoice_payment('${PAY}', ${amount})`);
await rejects(approve(A, 3500), /staff authorization required/);
await rejects(approve(ADMIN, 3000), /full invoice amount/);
await approve(ADMIN, 3500);
assert.equal((await db.query("select status from payments where id = $1", [PAY])).rows[0].status, "approved");
assert.equal((await db.query("select status from invoices where id = $1", [INV1])).rows[0].status, "paid");
await rejects(approve(ADMIN, 3500), /not eligible/);
await rejects(db.query("update invoices set total = 1 where id = $1", [INV1]), /immutable/);
await rejects(
  db.query("insert into invoice_items (invoice_id, type, unit_price, amount) values ($1, 'extra', 1, 1)", [INV1]),
  /only change while the invoice is a draft/,
);

// 'uploaded' (ยังไม่มีผลตรวจ) อนุมัติไม่ได้; ปฏิเสธคืนสถานะบิลใน transaction เดียว
const INV2 = "30000000-0000-0000-0000-000000000002";
await db.query("update invoices set status = 'pending_review' where id = $1", [INV2]);
const PAY2 = (await db.query(
  "insert into payments (invoice_id, slip_path, status) values ($1, 'u.jpg', 'uploaded') returning id::text as id",
  [INV2],
)).rows[0].id;
await rejects(as(ADMIN, `select public.approve_invoice_payment('${PAY2}', 3500)`), /not eligible/);
const reject = (uid, reason) => as(uid, `select public.reject_invoice_payment('${PAY2}', '${reason}') as s`);
await rejects(reject(B, "x"), /staff authorization required/);
await rejects(reject(ADMIN, " "), /reason required/);
const rejected = (await reject(ADMIN, "สลิปไม่ชัด")).rows[0].s;
assert.ok(["issued", "overdue"].includes(rejected));
assert.equal((await db.query("select status from invoices where id = $1", [INV2])).rows[0].status, rejected);
assert.equal((await db.query("select status from payments where id = $1", [PAY2])).rows[0].status, "rejected");
await rejects(reject(ADMIN, "ซ้ำ"), /not open for review/);

// ย้ายรายการออกจากบิลที่ออกแล้วไปบิลร่างไม่ได้
const draftOf = async (period) => (await db.query(
  "insert into invoices (lease_id, period, due_date, total) values ('20000000-0000-0000-0000-000000000002', $1, $1, 100) returning id::text as id",
  [period],
)).rows[0].id;
const ISSUED = await draftOf("2027-01-01");
const DRAFT = await draftOf("2027-02-01");
await db.query("insert into invoice_items (invoice_id, type, unit_price, amount) values ($1, 'rent', 100, 100)", [ISSUED]);
await db.query("update invoices set status = 'issued' where id = $1", [ISSUED]);
await rejects(
  db.query("update invoice_items set invoice_id = $1 where invoice_id = $2", [DRAFT, ISSUED]),
  /only change while the invoice is a draft/,
);

// ห้องเดียวกันคนละสัญญา: เห็นมิเตอร์/งานซ่อมเฉพาะช่วงสัญญาตัวเอง
assert.deepEqual((await as(A, "select period::text from meter_readings")).rows, [{ period: "2026-11-01" }]);
assert.deepEqual((await as(C, "select period::text from meter_readings")).rows, [{ period: "2026-09-01" }]);
assert.equal((await as(A, "select id from maintenance_requests")).rows.length, 0);
assert.equal((await as(C, "select id from maintenance_requests")).rows.length, 1);
assert.equal((await as(C, "select id from rooms")).rows.length, 0);
await rejects(as(C, "insert into maintenance_requests (room_id, category) values ('10000000-0000-0000-0000-000000000001', 'ไฟฟ้า')"), /row-level security/);

// audit log แก้จาก client ไม่ได้
await rejects(as(ADMIN, "delete from audit_logs"), /permission denied/);

// แจ้งซ่อมได้เฉพาะห้องตัวเอง
await as(A, "insert into maintenance_requests (room_id, category) values ('10000000-0000-0000-0000-000000000001', 'ไฟฟ้า')");
assert.equal((await as(A, "select id from maintenance_requests")).rows.length, 1);
assert.equal((await as(C, "select id from maintenance_requests")).rows.length, 1);
await rejects(as(A, "insert into maintenance_requests (room_id, category) values ('10000000-0000-0000-0000-000000000002', 'ไฟฟ้า')"), /row-level security/);

// กันสร้างบิลซ้ำ (lease_id, period)
 await rejects(db.exec("insert into invoices (lease_id, period, due_date) values ('20000000-0000-0000-0000-000000000001', '2026-12-01', '2026-11-30')"), /duplicate key/);
 // Phase 1: 1 ห้องมี active lease ได้ฉบับเดียว + คำเชิญเพิกถอนได้
 await rejects(db.exec("insert into leases (room_id, start_date, rent_amount, due_day) values ('10000000-0000-0000-0000-000000000001', '2026-11-01', 3500, 31)"), /duplicate key/);
 await db.exec("insert into room_invitations (lease_id, token_hash, expires_at, revoked_at) values ('20000000-0000-0000-0000-000000000001', 'revoked-hash', now() + interval '7 days', now())");

// ---------- storage.objects: path ต้องตรงกับสิทธิ์ ----------
// slips/<lease_id>/<invoice_id>/<file> — tenant อ่าน/อัปโหลดเฉพาะบิลตัวเอง
await as(A, `insert into storage.objects (bucket_id, name) values
  ('slips', '20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/a.jpg')`);
await rejects(as(B, `insert into storage.objects (bucket_id, name) values
  ('slips', '20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/b.jpg')`), /row-level security/);
assert.equal((await as(A, "select id from storage.objects where bucket_id = 'slips'")).rows.length, 1);
assert.equal((await as(B, "select id from storage.objects where bucket_id = 'slips'")).rows.length, 0);
assert.equal((await as(ADMIN, "select id from storage.objects where bucket_id = 'slips'")).rows.length, 1);
// staff อัปโหลดแทนได้ทุกบิล
await as(ADMIN, `insert into storage.objects (bucket_id, name) values
  ('slips', '20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000002/staff.jpg')`);

// documents/<lease_id>/<file> — tenant อ่านเฉพาะสัญญาตัวเอง อัปโหลดเองไม่ได้
await as(ADMIN, `insert into storage.objects (bucket_id, name) values
  ('documents', '20000000-0000-0000-0000-000000000001/contract.pdf'),
  ('documents', '20000000-0000-0000-0000-000000000002/other.pdf')`);
assert.equal((await as(A, "select id from storage.objects where bucket_id = 'documents'")).rows.length, 1);
await rejects(as(A, "insert into storage.objects (bucket_id, name) values ('documents', 'x/y.pdf')"), /row-level security/);

// meters/<room_id>/<period>/<file> — tenant อ่านเฉพาะงวดในช่วงสัญญาตัวเอง
await as(ADMIN, `insert into storage.objects (bucket_id, name) values
  ('meters', '10000000-0000-0000-0000-000000000001/2026-11-01/m.jpg'),
  ('meters', '10000000-0000-0000-0000-000000000001/2026-09-01/old.jpg')`);
assert.deepEqual(
  (await as(A, "select name from storage.objects where bucket_id = 'meters'")).rows,
  [{ name: "10000000-0000-0000-0000-000000000001/2026-11-01/m.jpg" }],
);

// maintenance/<room_id>/<request_id>/<file> — แจ้งซ่อมของตัวเองเท่านั้น
const maintId = (await as(A, "select id::text as id from maintenance_requests")).rows[0].id;
await as(A, `insert into storage.objects (bucket_id, name) values
  ('maintenance', '10000000-0000-0000-0000-000000000001/${maintId}/photo.jpg')`);
assert.equal((await as(A, "select id from storage.objects where bucket_id = 'maintenance'")).rows.length, 1);
await rejects(as(B, `insert into storage.objects (bucket_id, name) values
  ('maintenance', '10000000-0000-0000-0000-000000000001/${maintId}/other.jpg')`), /row-level security/);
assert.equal((await as(B, "select id from storage.objects where bucket_id = 'maintenance'")).rows.length, 0);

// ---------- accept_invite: ลิงก์เชิญรับได้ครั้งเดียว ----------
const D = "00000000-0000-0000-0000-00000000000d";
const E = "00000000-0000-0000-0000-00000000000e";
const GHOST = "00000000-0000-0000-0000-0000000000ff";
await db.exec(`
  insert into auth.users values ('${D}'), ('${E}');
  insert into profiles (id, role) values ('${D}', 'tenant'), ('${E}', 'admin');
  insert into room_invitations (lease_id, token_hash, expires_at) values
    ('20000000-0000-0000-0000-000000000001', 'hash-ok', now() + interval '7 days'),
    ('20000000-0000-0000-0000-000000000002', 'hash-expired', now() - interval '1 day'),
    ('20000000-0000-0000-0000-00000000000c', 'hash-ended', now() + interval '7 days');
`);

const accept = (hash, uid, name = "ผู้เช่า", phone = "0812345678") =>
  db.query(
    "select * from public.accept_invite($1, $2, $3, $4)",
    [hash, uid, name, phone],
  );
const codeOf = (r) => r.rows[0].code;

// ผู้ใช้คนแรกได้ผูกสัญญาและกินคำเชิญ
const first = await accept("hash-ok", D);
assert.equal(codeOf(first), "ok");
assert.equal(first.rows[0].ok, true);
assert.equal(first.rows[0].out_room_id, "10000000-0000-0000-0000-000000000001");
assert.equal(
  (await db.query("select used_by::text as u from room_invitations where token_hash = 'hash-ok'")).rows[0].u,
  D,
);
// A เป็นผู้เช่าหลักของสัญญานี้อยู่แล้ว ผู้ที่มาตามคำเชิญจึงได้ is_primary = false
assert.equal((await db.query("select is_primary from lease_tenants where profile_id = $1", [D])).rows[0].is_primary, false);

// สัญญาที่ยังไม่มีสมาชิก: คนแรกที่รับคำเชิญได้เป็นผู้เช่าหลัก
const J = "00000000-0000-0000-0000-0000000000a0";
await db.exec(`
  insert into auth.users values ('${J}');
  insert into profiles (id, role) values ('${J}', 'tenant');
  insert into rooms (id, room_no, unit_type) values
    ('10000000-0000-0000-0000-000000000009', '999', 'commercial');
  insert into leases (id, room_id, start_date, rent_amount, due_day) values
    ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009', '2026-10-01', 5000, 31);
  insert into room_invitations (lease_id, token_hash, expires_at) values
    ('20000000-0000-0000-0000-000000000009', 'hash-fresh', now() + interval '7 days');
`);
await accept("hash-fresh", J);
assert.equal((await db.query("select is_primary from lease_tenants where profile_id = $1", [J])).rows[0].is_primary, true);

// ผู้ใช้คนที่สอง (แม้เป็น admin) ถูกปฏิเสธ และไม่ได้ผูกสัญญา — นี่คือเคสที่เดิมพลิกเพี้ยน
const second = await accept("hash-ok", E);
assert.equal(codeOf(second), "already_used");
assert.equal(second.rows[0].ok, false);
assert.equal(
  (await db.query("select count(*)::int as n from lease_tenants where profile_id = $1", [E])).rows[0].n,
  0,
);

// กดซ้ำคนเดิม → สำเร็จแบบ idempotent ไม่กินคำเชิญเพิ่ม ไม่ซ้ำ
const repeat = await accept("hash-ok", D);
assert.equal(codeOf(repeat), "ok");
assert.equal((await db.query("select count(*)::int as n from lease_tenants where lease_id = '20000000-0000-0000-0000-000000000001'")).rows[0].n, 2);

// token ผิด / หมดอายุ / เพิกถอน / สัญญาปิด
assert.equal(codeOf(await accept("hash-nope", E)), "invalid_token");
assert.equal(codeOf(await accept("hash-expired", E)), "expired");
assert.equal(codeOf(await accept("revoked-hash", E)), "revoked");
assert.equal(codeOf(await accept("hash-ended", E)), "lease_closed");
assert.equal((await db.query("select count(*)::int as n from lease_tenants where profile_id = $1", [E])).rows[0].n, 0);

// ผูกไม่สำเร็จ → ต้องไม่เหลือ used_at ค้าง (rollback ทั้งฟังก์ชัน)
await db.exec("insert into room_invitations (lease_id, token_hash, expires_at) values ('20000000-0000-0000-0000-000000000002', 'hash-rollback', now() + interval '7 days')");
await rejects(accept("hash-rollback", GHOST), /foreign key/);
assert.equal(
  (await db.query("select count(*)::int as n from room_invitations where token_hash = 'hash-rollback' and used_at is not null")).rows[0].n,
  0,
);
assert.equal(codeOf(await accept("hash-rollback", E)), "ok");

// role ของผู้เชิญเดิมต้องไม่ถูกทับด้วยการรับคำเชิญ
assert.equal((await db.query("select role from profiles where id = $1", [E])).rows[0].role, "admin");

// ---------- ฟังก์ชันเหล่านี้เชื่อ id ที่ผู้เรียกส่งมา ต้องเรียกจาก service_role เท่านั้น ----------
// ถ้า grant หลุด ใครก็ตามที่มี token hash จะผูกตัวเองเข้าสัญญาผู้อื่นผ่าน REST ได้
for (const [role, uid] of [["anon", null], ["authenticated", ADMIN]]) {
  await rejects(
    asRole(role, uid, "select * from public.accept_invite('hash-nope', gen_random_uuid(), 'x', '0812345678')"),
    /permission denied/,
  );
  await rejects(
    asRole(role, uid, "select public.set_primary_tenant('20000000-0000-0000-0000-000000000001', gen_random_uuid())"),
    /permission denied/,
  );
  await rejects(
    asRole(role, uid, "select public.remove_lease_tenant('20000000-0000-0000-0000-000000000001', gen_random_uuid())"),
    /permission denied/,
  );
}

// ---------- ผู้เช่าหลัก: 1 คนต่อสัญญา และถอนหลักไม่ได้ ----------
const LEASE1 = "20000000-0000-0000-0000-000000000001";
const primaryOf = async (lease) =>
  (await db.query("select profile_id::text as p from lease_tenants where lease_id = $1 and is_primary", [lease]))
    .rows.map((r) => r.p);
assert.deepEqual(await primaryOf(LEASE1), [A]);
// 1 สัญญามีหลักได้คนเดียวแม้แตะตรง ๆ
const K = "00000000-0000-0000-0000-0000000000b0";
await db.exec(`
  insert into auth.users values ('${K}');
  insert into profiles (id, role) values ('${K}', 'tenant');
  insert into lease_tenants (lease_id, profile_id, is_primary) values
    ('20000000-0000-0000-0000-000000000009', '${K}', false);
`);
await rejects(
  db.exec("update lease_tenants set is_primary = true where profile_id = '" + K + "'"),
  /duplicate key/,
);
// ถอนผู้เช่าหลักไม่ได้
const removePrimary = (lease, uid) =>
  db.query("select public.remove_lease_tenant($1, $2)", [lease, uid]).then((r) => r.rows[0].remove_lease_tenant);
assert.equal(await removePrimary(LEASE1, A), "is_primary");
assert.equal((await db.query("select count(*)::int as n from lease_tenants where profile_id = $1", [A])).rows[0].n, 1);
// เปลี่ยนผู้เช่าหลักเป็นคนใหม่
const setPrimary = (lease, uid) =>
  db.query("select public.set_primary_tenant($1, $2)", [lease, uid]).then((r) => r.rows[0].set_primary_tenant);
assert.equal(await setPrimary(LEASE1, D), true);
assert.deepEqual(await primaryOf(LEASE1), [D]);
assert.equal(await setPrimary(LEASE1, "00000000-0000-0000-0000-0000000000ff"), false);
// หลังเปลี่ยนหลักแล้ว ถอนคนเดิมได้
assert.equal(await removePrimary(LEASE1, A), "ok");
assert.equal(await removePrimary(LEASE1, A), "not_found");

// ---------- à¸ˆà¸±à¸”à¸à¸²à¸£ role à¸œà¹ˆà¸²à¸™ RPC à¸—à¸µà¹ˆà¸¥à¹‡à¸­à¸à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹€à¸ˆà¹‰à¸²à¸‚à¸­à¸‡ ----------
await db.exec(`grant select, update on public.profiles to service_role;`);
await db.query("update profiles set role = 'owner' where id = any($1::uuid[])", [[A, B]]);

const setStaffRole = async (targetId, targetRole, actorId) => {
  await db.exec("set role service_role");
  try {
    return await db.query(
      "select public.set_staff_role($1, $2, $3, null, null) as result",
      [targetId, targetRole, actorId],
    );
  } finally {
    await db.exec("reset role");
  }
};

assert.equal(
  (await db.query("select has_function_privilege('service_role', 'public.set_staff_role(uuid,text,uuid,text,text)', 'execute') as allowed")).rows[0].allowed,
  true,
);
for (const role of ["anon", "authenticated"]) {
  await rejects(
    asRole(role, ADMIN, `select public.set_staff_role('${A}', 'admin', '${ADMIN}', null, null)`),
    /permission denied/,
  );
}
await rejects(setStaffRole(A, "admin", ADMIN), /owner_required/);
await rejects(setStaffRole(A, "admin", C), /actor_not_staff/);
await rejects(setStaffRole(A, "admin", A), /self_role_change/);

const demotedOwner = await setStaffRole(A, "admin", B);
assert.deepEqual(demotedOwner.rows[0].result, { role: "owner", display_name: null });
assert.equal((await db.query("select role from profiles where id = $1", [A])).rows[0].role, "admin");
await rejects(setStaffRole(B, "tenant", B), /last_owner/);
await rejects(setStaffRole(C, "invalid", B), /invalid_target_role/);

console.log("rls.test: all passed");
