// ทดสอบ migration + RLS บน PGlite (ไม่ต้องใช้ Docker): npm run test:db
// จำลองส่วนของ Supabase ที่ migration ใช้: auth.users, auth.uid(), storage.buckets, role anon/authenticated
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
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);

const dir = new URL("../migrations/", import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), "utf8"));

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
await db.exec(`
  insert into auth.users values ('${A}'), ('${B}'), ('${ADMIN}');
  insert into profiles (id, role) values ('${A}', 'tenant'), ('${B}', 'tenant'), ('${ADMIN}', 'admin');
  insert into rooms (id, room_no, unit_type) values
    ('10000000-0000-0000-0000-000000000001', '101', 'residential'),
    ('10000000-0000-0000-0000-000000000002', '205', 'residential');
  insert into leases (id, room_id, start_date, rent_amount, due_day) values
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '2026-11-01', 3500, 31),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-11-10', 3500, 10);
  insert into lease_tenants values
    ('20000000-0000-0000-0000-000000000001', '${A}', true),
    ('20000000-0000-0000-0000-000000000002', '${B}', true);
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

// แจ้งซ่อมได้เฉพาะห้องตัวเอง
await as(A, "insert into maintenance_requests (room_id, category) values ('10000000-0000-0000-0000-000000000001', 'ไฟฟ้า')");
await rejects(as(A, "insert into maintenance_requests (room_id, category) values ('10000000-0000-0000-0000-000000000002', 'ไฟฟ้า')"), /row-level security/);

// กันสร้างบิลซ้ำ (lease_id, period)
await rejects(db.exec("insert into invoices (lease_id, period, due_date) values ('20000000-0000-0000-0000-000000000001', '2026-12-01', '2026-11-30')"), /duplicate key/);

console.log("rls.test: all passed");
