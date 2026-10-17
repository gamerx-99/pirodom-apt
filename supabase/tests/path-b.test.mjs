// ทดสอบเส้นทาง B: เอกสารสัญญา (Phase 4a) บน PGlite — รันด้วย npm run test:path-b
// พิสูจน์ 4 ข้อตาม ROADMAP-PARALLEL ข้อ 4.4
//   1. ผู้เช่าคนละห้อง/คนละสัญญา เห็น 0 รายการ
//   2. ผู้เช่าอีกคนในสัญญาเดียวกัน เห็นได้
//   3. ผู้เช่าที่ย้ายออกแล้ว (สัญญาปิด) เปิดเอกสารเดิมไม่ได้
//   4. ผู้เช่าอัปโหลดเข้า storage.objects เองไม่ได้
// บอกให้รู้: ชุดนี้ไม่ยิงเครือข่ายและไม่แตะ service role จริง พิสูจน์แค่ชั้น policy
import assert from "node:assert/strict";
import { asRole, asUser, assertObjectNameConvention, createTestDb, toObjectName } from "./harness.mjs";

const db = await createTestDb();

const ROOM1 = "10000000-0000-0000-0000-000000000001"; // 101
const ROOM2 = "10000000-0000-0000-0000-000000000002"; // 205
const L1 = "20000000-0000-0000-0000-000000000001"; // ห้อง 101 active
const L2 = "20000000-0000-0000-0000-000000000002"; // ห้อง 205 active
const L3 = "20000000-0000-0000-0000-000000000003"; // ห้อง 101 สัญญาเก่า ปิดแล้ว

const T1 = "00000000-0000-0000-0000-00000000000a"; // ผู้เช่าหลักห้อง 101
const T2 = "00000000-0000-0000-0000-00000000000b"; // ผู้เช่าร่วมสัญญาเดียวกับ T1
const OTHER = "00000000-0000-0000-0000-00000000000c"; // ผู้เช่าห้อง 205
const MOVED = "00000000-0000-0000-0000-00000000000d"; // ย้ายออกแล้ว สัญญาปิด
const STAFF = "00000000-0000-0000-0000-0000000000ad"; // เจ้าของ/แอดมิน

await db.exec(`
  insert into auth.users values ('${T1}'), ('${T2}'), ('${OTHER}'), ('${MOVED}'), ('${STAFF}');
  insert into profiles (id, role) values
    ('${T1}', 'tenant'), ('${T2}', 'tenant'), ('${OTHER}', 'tenant'), ('${MOVED}', 'tenant'), ('${STAFF}', 'admin');
  insert into rooms (id, room_no, unit_type) values
    ('${ROOM1}', '101', 'residential'), ('${ROOM2}', '205', 'residential');
  insert into leases (id, room_id, start_date, end_date, status, rent_amount, due_day) values
    ('${L1}', '${ROOM1}', '2026-10-01', null, 'active', 3500, 31),
    ('${L2}', '${ROOM2}', '2026-10-01', null, 'active', 3500, 10),
    ('${L3}', '${ROOM1}', '2026-01-01', '2026-09-30', 'ended', 3500, 31);
  insert into lease_tenants (lease_id, profile_id, is_primary) values
    ('${L1}', '${T1}', true), ('${L1}', '${T2}', false),
    ('${L2}', '${OTHER}', true), ('${L3}', '${MOVED}', true);
`);

// เอกสารชุดเดิมยังไม่มี uploaded_by (คอลัมน์เพิ่มทีหลัง) → ต้องเป็น null ไม่ใช่ error
const DOC1 = "40000000-0000-0000-0000-000000000001";
const DOC2 = "40000000-0000-0000-0000-000000000002";
const DOC_OLD = "40000000-0000-0000-0000-000000000003";
const DOC3 = "40000000-0000-0000-0000-000000000004";
await db.exec(`
  insert into documents (id, lease_id, type, file_path, created_at) values
    ('${DOC1}', '${L1}', 'สัญญาเช่าห้อง 101', 'documents/${L1}/contract-101.pdf', '2026-10-01 09:00:00+07'),
    ('${DOC2}', '${L1}', 'สัญญาเช่าห้อง 101', 'documents/${L1}/annex-101.pdf',   '2026-10-05 09:00:00+07'),
    ('${DOC3}', '${L2}', 'สัญญาเช่าห้อง 205', 'documents/${L2}/contract-205.pdf', '2026-10-02 09:00:00+07'),
    ('${DOC_OLD}', '${L3}', 'สัญญาเช่าฉบับเดิม', 'documents/${L3}/old-101.pdf',   '2026-01-15 09:00:00+07');
  insert into storage.objects (bucket_id, name) values
    ('documents', '${L1}/contract-101.pdf'),
    ('documents', '${L1}/annex-101.pdf'),
    ('documents', '${L2}/contract-205.pdf'),
    ('documents', '${L3}/old-101.pdf');
`);

const ids = async (uid, sql) => (await asUser(db, uid, sql)).rows.map((r) => r.id);
const names = async (uid) => (await asUser(db, uid, "select name from storage.objects where bucket_id = 'documents' order by name")).rows.map((r) => r.name);
const rejects = (p, re) => assert.rejects(p, re);

// ---------- ข้อ 2: ผู้เช่าอีกคนในสัญญาเดียวกันเห็นได้ (ทั้งหลักและร่วม) ----------
assert.deepEqual(await ids(T1, "select id from documents order by id"), [DOC1, DOC2].sort());
assert.deepEqual(await ids(T2, "select id from documents order by id"), [DOC1, DOC2].sort());

// ---------- ข้อ 1: ผู้เช่าคนละห้อง/คนละสัญญาเห็นเฉพาะของตัวเอง ----------
assert.deepEqual(await ids(OTHER, "select id from documents order by id"), [DOC3]);
assert.ok(!(await ids(OTHER, "select id from documents")).includes(DOC1));
// ตัว path ใน storage ต้องไม่หลุดไปข้ามสัญญาด้วย
assert.deepEqual(await names(T1), [`${L1}/annex-101.pdf`, `${L1}/contract-101.pdf`]);
assert.deepEqual(await names(OTHER), [`${L2}/contract-205.pdf`]);

// ---------- ข้อ 3: ย้ายออกแล้ว (สัญญาปิด) เปิดเอกสารเดิมไม่ได้ ----------
assert.deepEqual(await ids(MOVED, "select id from documents"), []);
// หน้า /liff/documents ดึง file_path เพื่อขอ Signed URL จาก server → ไม่มีแถว = ไม่มี path = ออกลิงก์ไม่ได้
assert.deepEqual(
  (await asUser(db, MOVED, "select file_path from documents")).rows,
  [],
);
// policy tenant_documents_select กรองสถานะสัญญาแล้ว ผู้เช่าที่ย้ายออกจึงไม่เห็น metadata แถวเก่าด้วย
assert.deepEqual(await names(MOVED), []);

// ---------- ข้อ 4: ผู้เช่าอัปโหลดเอกสารเองไม่ได้ (ทั้งตารางและ storage) ----------
await rejects(
  asUser(db, T1, `insert into storage.objects (bucket_id, name) values ('documents', '${L1}/hack.pdf')`),
  /row-level security/,
);
await rejects(
  asUser(db, T1, `insert into storage.objects (bucket_id, name) values ('documents', '${L2}/hack.pdf')`),
  /row-level security/,
);
await rejects(
  asUser(db, T1, `insert into documents (lease_id, type, file_path) values ('${L1}', 'แฮก', 'documents/${L1}/hack.pdf')`),
  /row-level security/,
);
// UPDATE/DELETE ที่ไม่มี policy ให้ผู้เช่า จะไม่ error แต่กรองทิ้งเงียบ ๆ → ต้องพิสูจน์ด้วยผลลัพธ์ ไม่ใช่ error
await asUser(db, T1, `update documents set file_path = 'documents/${L1}/new.pdf'`);
await asUser(db, T2, `delete from documents where id = '${DOC1}'`);
assert.equal((await asUser(db, STAFF, `select file_path from documents where id = '${DOC1}'`)).rows[0].file_path, `documents/${L1}/contract-101.pdf`);
assert.equal((await ids(STAFF, "select id from documents")).length, 4);
// anon (ยังไม่ล็อกอิน) เห็น 0 แถว ไม่ใช่ error
assert.deepEqual((await asRole(db, "anon", null, "select id from documents")).rows, []);
assert.deepEqual(await names(T1), [`${L1}/annex-101.pdf`, `${L1}/contract-101.pdf`]);

// staff เขียนได้ผ่าน service role/policy staff_all
const DOC_NEW = "40000000-0000-0000-0000-000000000005";
await asUser(db, STAFF, `insert into documents (id, lease_id, type, file_path, uploaded_by)
  values ('${DOC_NEW}', '${L1}', 'สัญญาเช่าฉบับใหม่', 'documents/${L1}/contract-new.pdf', '${STAFF}')`);
assert.ok((await ids(T1, "select id from documents")).includes(DOC_NEW));
assert.equal((await asUser(db, T1, `select uploaded_by::text from documents where id = '${DOC_NEW}'`)).rows[0].uploaded_by, STAFF);
// แอดมินเห็นเอกสารทุกสัญญา
assert.equal((await asUser(db, STAFF, "select id from documents")).rows.length, 5);

// ---------- เก็บความถูกต้องของ path กับ lease_id ----------
// path ไม่ตรองสัญญาในแถวนั้นไม่ได้บันทึก (ไม่งั้นผู้เช่าเห็นรายการแต่เปิดไฟล์ไม่ได้ หรือกลับกัน)
await rejects(
  asUser(db, STAFF, `insert into documents (lease_id, type, file_path) values ('${L1}', 'ผิด', 'documents/${L2}/wrong.pdf')`),
  /documents_path_matches_lease/,
);
await rejects(
  asUser(db, STAFF, `insert into documents (lease_id, type, file_path) values ('${L1}', 'ว่าง', 'documents/${L1}/')`),
  /documents_path_matches_lease/,
);

// uploaded_by ต้องเป็น profile ที่มีจริง
await rejects(
  asUser(db, STAFF, `insert into documents (lease_id, type, file_path, uploaded_by)
    values ('${L1}', 'ผิด', 'documents/${L1}/x.pdf', '00000000-0000-0000-0000-0000000000ff')`),
  /foreign key/,
);
// แถวเดิมที่ไม่ได้ใส่ uploaded_by ต้องเป็น null (ลบ profile ผู้อัปโหลดไม่ลบเอกสาร)
assert.equal((await asUser(db, STAFF, `select uploaded_by from documents where id = '${DOC1}'`)).rows[0].uploaded_by, null);

// ---------- โครงสร้างที่ migration เพิ่ม ----------
const idx = await db.query(
  "select indexdef from pg_indexes where schemaname = 'public' and tablename = 'documents' and indexname = 'documents_lease_created_idx'",
);
assert.equal(idx.rows.length, 1, "ต้องมีดัชนี documents_lease_created_idx");
assert.match(idx.rows[0].indexdef, /lease_id/);
assert.match(idx.rows[0].indexdef, /created_at DESC/);

// อ่านตาม (lease_id, created_at desc) คือรูปแบบที่หน้าแอดมิน/ผู้เช่าใช้
assert.deepEqual(
  (await asUser(db, T1, "select id from documents where lease_id = '" + L1 + "' order by created_at desc")).rows.map((r) => r.id),
  [DOC_NEW, DOC2, DOC1],
);

// uploaded_by → public.profiles
const fks = await db.query(`
  select fn.nspname as ref_schema, cf.relname as ref_table
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  join pg_class cf on cf.oid = c.confrelid
  join pg_namespace fn on fn.oid = cf.relnamespace
  where n.nspname = 'public' and t.relname = 'documents' and c.contype = 'f'
`);
const fkTargets = fks.rows.map((r) => `${r.ref_schema}.${r.ref_table}`).sort();
assert.deepEqual(fkTargets, ["public.leases", "public.profiles"]);

const col = await db.query(
  "select column_name, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'uploaded_by'",
);
assert.deepEqual(col.rows, [{ column_name: "uploaded_by", is_nullable: "YES" }]);

// ยังไม่มีสิทธิ์เขียนจากผู้เช่า: policy ของผู้เช่าบน documents ต้องเป็น read อย่างเดียว
const tenantPolicies = await db.query(`
  select pol.polname, pol.polcmd
  from pg_policy pol
  join pg_class t on t.oid = pol.polrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public' and t.relname = 'documents' and pol.polcmd <> '*'
  order by pol.polcmd
`);
assert.deepEqual(tenantPolicies.rows, [{ polname: "tenant_read", polcmd: "r" }]);

// policy ฝั่ง storage ยังเป็นเดิม: staff ทั้งหมด + ผู้เช่าอ่านอย่างเดียว (ไม่มี insert/update/delete)
const storagePolicies = await db.query(`
  select pol.polname, pol.polcmd
  from pg_policy pol
  where pol.polrelid = 'storage.objects'::regclass
    and pol.polname like '%documents%'
  order by pol.polname
`);
assert.deepEqual(storagePolicies.rows, [
  { polname: "staff_documents_all", polcmd: "*" },
  { polname: "tenant_documents_select", polcmd: "r" },
]);

// ---------- ซัญญาไฟล์กับ path ที่ policy ฝั่ง storage คาดไว้ ----------
// lib/storage.ts สร้าง path แบบ documents/<lease_id>/<file> ไม่มีใครเขียน bucket อื่นลง documents
for (const name of [`${L1}/contract-101.pdf`, `${L2}/contract-205.pdf`, `${L3}/old-101.pdf`]) {
  assert.equal(name.split("/").length, 2);
}

// ชื่อ object ต้องตรงกับที่ lib/storage.ts เขียนจริง คือไม่มีชื่อ bucket นำหน้า
assertObjectNameConvention(assert);
assert.equal(toObjectName("documents", `documents/${L1}/contract-101.pdf`), `${L1}/contract-101.pdf`);

console.log("path-b.test: all passed");
