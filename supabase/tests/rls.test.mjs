// ทดสอบ migration + RLS บน PGlite (ไม่ต้องใช้ Docker): npm test
// จำลองส่วนของ Supabase ที่ migration ใช้: auth.users, auth.uid(), storage.buckets, storage.objects, role anon/authenticated
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin;
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
  grant usage on schema public, auth, storage to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema storage grant all on tables to anon, authenticated;
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

// ผู้เช่า A เห็นเฉพาะของตัวเอง
assert.equal((await as(A, "select id from invoices")).rows.length, 1);
assert.equal((await as(A, "select id from rooms")).rows.length, 1);
assert.equal((await as(A, "select id from profiles")).rows.length, 1);
assert.equal((await as(A, "select id from room_invitations")).rows.length, 0);
// แอดมินเห็นทั้งหมด
assert.equal((await as(ADMIN, "select id from invoices")).rows.length, 2);

// สร้าง payment ได้เฉพาะบิลตัวเอง และส่งได้แค่ invoice_id + slip_path
await as(A, "insert into payments (invoice_id, slip_path) values ('30000000-0000-0000-0000-000000000001', 'a.jpg')");
await rejects(as(A, "insert into payments (invoice_id, slip_path) values ('30000000-0000-0000-0000-000000000002', 'b.jpg')"), /row-level security/);
await rejects(as(A, "insert into payments (invoice_id, slip_path, status) values ('30000000-0000-0000-0000-000000000001', 'a.jpg', 'approved')"), /permission denied/);
await rejects(as(A, "insert into payments (invoice_id, slip_path, amount) values ('30000000-0000-0000-0000-000000000001', 'a.jpg', 1)"), /permission denied/);

// แก้บิล/สถานะจาก client ไม่ได้ แม้เป็นแอดมิน (ต้องผ่าน server)
await rejects(as(A, "update invoices set status = 'paid'"), /permission denied/);
await rejects(as(ADMIN, "update invoices set total = 0"), /permission denied/);

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

console.log("rls.test: all passed");
