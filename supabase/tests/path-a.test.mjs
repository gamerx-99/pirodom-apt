// ทดสอบเฉพาะเส้นทาง A (Phase 2a มิเตอร์ + Phase 4b งานซ่อม) บน PGlite: npm run test:path-a
// ใช้ harness กลางเดียวกับ rls.test.mjs — ไม่ต้องใช้ Docker และไม่ต้องมี Supabase จริง
import assert from "node:assert/strict";
import { asRole, asUser, createTestDb, toObjectName } from "./harness.mjs";

const db = await createTestDb();

const A = "00000000-0000-0000-0000-00000000000a"; // ผู้เช่าปัจจุบันห้อง 101
const B = "00000000-0000-0000-0000-00000000000b"; // ผู้เช่าปัจจุบันห้อง 205
const C = "00000000-0000-0000-0000-00000000000c"; // ผู้เช่าเก่าห้อง 101 (สัญญาจบแล้ว)
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const ROOM_101 = "10000000-0000-0000-0000-000000000001";
const ROOM_205 = "10000000-0000-0000-0000-000000000002";
const REQ_101 = "40000000-0000-0000-0000-000000000001";
const REQ_205 = "40000000-0000-0000-0000-000000000002";
const REQ_OLD = "40000000-0000-0000-0000-000000000003"; // งานของผู้เช่าเดิม ห้อง 101 (ก่อนสัญญาปัจจุบัน)

await db.exec(`
  insert into auth.users values ('${A}'), ('${B}'), ('${C}'), ('${ADMIN}');
  insert into profiles (id, role) values
    ('${A}', 'tenant'), ('${B}', 'tenant'), ('${C}', 'tenant'), ('${ADMIN}', 'admin');
  insert into rooms (id, room_no, unit_type, status) values
    ('${ROOM_101}', '101', 'residential', 'occupied'),
    ('${ROOM_205}', '205', 'residential', 'occupied');
  insert into leases (id, room_id, start_date, rent_amount, due_day) values
    ('20000000-0000-0000-0000-000000000001', '${ROOM_101}', '2026-10-01', 3500, 31),
    ('20000000-0000-0000-0000-000000000002', '${ROOM_205}', '2026-10-10', 3500, 10);
  insert into leases (id, room_id, start_date, end_date, status, rent_amount, due_day) values
    ('20000000-0000-0000-0000-00000000000c', '${ROOM_101}', '2026-01-01', '2026-09-30', 'ended', 3500, 31);
  insert into lease_tenants values
    ('20000000-0000-0000-0000-000000000001', '${A}', true),
    ('20000000-0000-0000-0000-000000000002', '${B}', true),
    ('20000000-0000-0000-0000-00000000000c', '${C}', true);
  -- งานซ่อมของแต่ละห้อง (created_at อยู่ในช่วงสัญญาปัจจุบันของแต่ละคน)
  insert into maintenance_requests (id, room_id, category, priority, created_at) values
    ('${REQ_101}', '${ROOM_101}', 'ไฟฟ้า', 'high', '2026-11-05'),
    ('${REQ_205}', '${ROOM_205}', 'ประปา', 'normal', '2026-11-06'),
    ('${REQ_OLD}', '${ROOM_101}', 'แอร์', 'normal', '2026-06-10');
  -- งวดมิเตอร์: งวดของผู้เช่าเก่า + งวดปัจจุบัน (ต้องมีแถว meter_readings ไม่งั้น policy รูปมิเตอร์จะไม่ให้เห็นไฟล์)
  insert into meter_readings (room_id, period, prev_value, curr_value, photo_path, recorded_by) values
    ('${ROOM_101}', '2026-09-01', 220, 300, null, '${ADMIN}'),
    ('${ROOM_101}', '2026-11-01', 300, 392, 'meters/${ROOM_101}/2026-11-01/m101.jpg', '${ADMIN}'),
    ('${ROOM_205}', '2026-11-01', 120, 160, 'meters/${ROOM_205}/2026-11-01/m205.jpg', '${ADMIN}');
`);

const rejects = (p, re) => assert.rejects(p, re);
const count = async (uid, sql) => (await asUser(db, uid, sql)).rows.length;
const statusOf = async (id) =>
  (await db.query("select status from maintenance_requests where id = $1", [id])).rows[0].status;

// ---------- 1. ผู้เช่าคนอื่นอ่านรูปของห้องอื่นไม่ได้ (meters + maintenance) ----------
// ชื่อ object ต้องตรงกับที่ lib/storage.ts เขียนจริง คือไม่มีชื่อ bucket นำหน้า
// (ถ้าใส่ prefix ไว้ policy จะไม่มีวันตรงกับไฟล์จริง แต่เทสต์นี้ยังผ่าน = หลอกตัวเอง)
assert.equal(toObjectName("meters", `meters/${ROOM_101}/2026-11-01/m101.jpg`), `${ROOM_101}/2026-11-01/m101.jpg`);
assert.equal(toObjectName("maintenance", `maintenance/${ROOM_101}/${REQ_101}/p1.jpg`), `${ROOM_101}/${REQ_101}/p1.jpg`);

// meters/<room_id>/<YYYY-MM-DD>/<file>
await asUser(db, ADMIN, `insert into storage.objects (bucket_id, name) values
  ('meters', '${ROOM_101}/2026-11-01/m101.jpg'),
  ('meters', '${ROOM_101}/2026-09-01/m101-old.jpg'),
  ('meters', '${ROOM_205}/2026-11-01/m205.jpg')`);

const metersOf = async (uid) =>
  (await asUser(db, uid, "select name from storage.objects where bucket_id = 'meters' order by name")).rows.map(
    (r) => r.name,
  );
assert.deepEqual(await metersOf(A), [`${ROOM_101}/2026-11-01/m101.jpg`]);
assert.deepEqual(await metersOf(B), [`${ROOM_205}/2026-11-01/m205.jpg`]);
// ผู้เช่าเก่าห้อง 101 เห็นเฉพาะงวดในสัญญาที่จบไปแล้วของตัวเอง
assert.deepEqual(await metersOf(C), [`${ROOM_101}/2026-09-01/m101-old.jpg`]);
assert.equal(
  (await asRole(db, "anon", null, "select name from storage.objects where bucket_id = 'meters'")).rows.length,
  0,
);

// maintenance/<room_id>/<request_id>/<file>
await asUser(db, ADMIN, `insert into storage.objects (bucket_id, name) values
  ('maintenance', '${ROOM_101}/${REQ_101}/p101-1.jpg'),
  ('maintenance', '${ROOM_205}/${REQ_205}/p205-1.jpg')`);
const maintFiles = async (uid) =>
  (await asUser(db, uid, "select name from storage.objects where bucket_id = 'maintenance' order by name")).rows.map(
    (r) => r.name,
  );
assert.deepEqual(await maintFiles(A), [`${ROOM_101}/${REQ_101}/p101-1.jpg`]);
assert.deepEqual(await maintFiles(B), [`${ROOM_205}/${REQ_205}/p205-1.jpg`]);
assert.deepEqual(await maintFiles(C), []);
assert.equal(await count(ADMIN, "select id from storage.objects where bucket_id = 'meters'"), 3);

// ---------- 2. อัปโหลดรูปเข้าห้องที่ไม่ได้เช่าไม่ได้ ----------
// (ก) ผู้เช่าอัปโหลดเข้าโฟลเดอร์งานของตัวเองได้
await asUser(db, A, `insert into storage.objects (bucket_id, name) values
  ('maintenance', '${ROOM_101}/${REQ_101}/own.jpg')`);
// (ข) งานเก่าของผู้เช่าเดิมในห้องเดียวกัน — ผู้เช่าปัจจุบันอัปโหลดเข้าไม่ได้
// กติกาใน 20261018000002: งานต้องเกิดในช่วงสัญญาของผู้เช่าคนนั้น
await rejects(
  asUser(db, A, `insert into storage.objects (bucket_id, name) values
    ('maintenance', '${ROOM_101}/${REQ_OLD}/sneak.jpg')`),
  /row-level security/,
);
await rejects(
  asUser(db, B, `insert into storage.objects (bucket_id, name) values
    ('maintenance', '${ROOM_101}/${REQ_101}/sneak.jpg')`),
  /row-level security/,
);
// B เห็นเฉพาะไฟล์ของงานในห้องตัวเอง (ไฟล์ที่ A เพิ่งอัปโหลดไม่ทำให้ B เห็น)
assert.equal(await count(B, "select id from storage.objects where bucket_id = 'maintenance'"), 1);
// bucket meters ไม่มี insert policy สำหรับผู้เช่าทุกคน
await rejects(
  asUser(db, A, `insert into storage.objects (bucket_id, name) values
    ('meters', '${ROOM_101}/2026-11-01/tenant.jpg')`),
  /row-level security/,
);
// ผู้เช่าเก่า (สัญญาจบแล้ว) อัปโหลดเข้าห้องเดิมไม่ได้ — policy เดิมกรอง l.status = 'active'
await rejects(
  asUser(db, C, `insert into storage.objects (bucket_id, name) values
    ('maintenance', '${ROOM_101}/${REQ_101}/old-tenant.jpg')`),
  /row-level security/,
);
// แจ้งซ่อมของห้องที่ไม่ได้เช่าไม่ได้ (RLS ตาราง maintenance_requests เดิม)
await rejects(
  asUser(db, B, `insert into maintenance_requests (room_id, category) values ('${ROOM_101}', 'ไฟฟ้า')`),
  /row-level security/,
);
// ผู้เช่าแจ้งซ่อมห้องตัวเองได้ และกำหนดสถานะเองไม่ได้ (grant insert เฉพาะ 4 คอลัมน์)
await asUser(db, A, `insert into maintenance_requests (room_id, category, priority, description)
  values ('${ROOM_101}', 'แอร์', 'normal', 'แอร์ไม่เย็น')`);
await rejects(
  asUser(db, A, `insert into maintenance_requests (room_id, category, status) values
    ('${ROOM_101}', 'แอร์', 'closed')`),
  /permission denied/,
);

// ---------- 3. จดมิเตอร์ห้อง+งวดซ้ำไม่ได้ และค่าติดลบถูกกัน ----------
// ใน seed มีแถว (ROOM_101, 2026-11-01) แล้ว → จดซ้ำต้องถูกปฏิเสธ
await rejects(
  db.exec(`insert into meter_readings (room_id, period, prev_value, curr_value)
    values ('${ROOM_101}', '2026-11-01', 392, 430)`),
  /duplicate key/,
);
// ห้องอื่นจดงวดเดียวกันได้ (unique ครอบคลุมแค่ห้อง+งวด)
await asUser(db, ADMIN, `insert into meter_readings (room_id, period, prev_value, curr_value)
  values ('${ROOM_205}', '2026-12-01', 160, 205)`);
assert.equal(await count(ADMIN, "select id from meter_readings"), 4);
// เลขติดลบถูกกันที่ระดับฐานข้อมูล
await rejects(
  db.exec(`insert into meter_readings (room_id, period, prev_value, curr_value)
    values ('${ROOM_101}', '2026-12-01', -1, 10)`),
  /meter_readings_prev_value_non_negative/,
);
await rejects(
  db.exec(`insert into meter_readings (room_id, period, prev_value, curr_value)
    values ('${ROOM_101}', '2026-12-01', 10, -5)`),
  /meter_readings_curr_value_non_negative/,
);
// ดัชนีที่เพิ่มใน migration ต้องมีจริง
const meterIndexes = (
  await db.query(
    "select indexname from pg_indexes where schemaname = 'public' and tablename = 'meter_readings'",
  )
).rows.map((r) => r.indexname);
assert.ok(meterIndexes.includes("meter_readings_room_period_idx"), meterIndexes.join(","));

// ---------- 4. ผู้เช่าปิดงานของห้องอื่นไม่ได้ ----------
// งานของห้องอื่น: RLS ไม่มี policy update ให้ผู้เช่า → อัปเดตไม่ได้และแถวไม่เปลี่ยน
await asUser(db, B, `update maintenance_requests set status = 'closed' where id = '${REQ_101}'`);
assert.equal(await statusOf(REQ_101), "pending");
// แม้งานของห้องตัวเอง ผู้เช่าก็เปลี่ยนสถานะเองไม่ได้ (ผ่าน server action ที่ตรวจลำดับเท่านั้น)
await asUser(db, B, `update maintenance_requests set status = 'done' where id = '${REQ_205}'`);
assert.equal(await statusOf(REQ_205), "pending");
await asUser(db, B, `delete from maintenance_requests where id = '${REQ_101}'`);
assert.ok((await db.query(`select 1 from maintenance_requests where id = '${REQ_101}'`)).rows.length === 1);
// ผู้เช่าอ่านงานของห้องอื่นไม่ได้ (RLS เดิมใช้ช่วงสัญญา)
assert.equal(await count(A, "select id from maintenance_requests"), 2); // งานเดิมของ 101 + งานที่เพิ่งแจ้ง
assert.equal(await count(B, "select id from maintenance_requests"), 1);
// ผู้เช่าเก่าเห็นเฉพาะงานที่เกิดในช่วงสัญญาของตัวเอง (REQ_OLD) ไม่เห็นงานหลังย้ายออก
assert.equal(await count(C, "select id from maintenance_requests"), 1);
assert.equal(
  (await asUser(db, C, "select id::text as id from maintenance_requests")).rows[0].id,
  REQ_OLD,
);

// ---------- 5. รูปงานซ่อมหลายรูป: ตารางใหม่ + RLS ----------
await db.exec(`
  insert into maintenance_photos (request_id, kind, file_path, uploaded_by) values
    ('${REQ_101}', 'reported', 'maintenance/${ROOM_101}/${REQ_101}/p1.jpg', '${A}'),
    ('${REQ_101}', 'reported', 'maintenance/${ROOM_101}/${REQ_101}/p2.jpg', '${A}'),
    ('${REQ_101}', 'result', 'maintenance/${ROOM_101}/${REQ_101}/fix1.jpg', '${ADMIN}'),
    ('${REQ_205}', 'reported', 'maintenance/${ROOM_205}/${REQ_205}/p1.jpg', '${B}');
`);
const photosOf = async (uid) =>
  (await asUser(db, uid, "select kind from maintenance_photos order by kind, file_path")).rows.map(
    (r) => r.kind,
  );
assert.deepEqual(await photosOf(A), ["reported", "reported", "result"]);
assert.deepEqual(await photosOf(B), ["reported"]);
assert.deepEqual(await photosOf(C), []);
assert.equal(await count(ADMIN, "select id from maintenance_photos"), 4);
// เขียนแถวรูปได้ฝั่ง server (service role) เท่านั้น — ผู้เช่าและ staff ที่คุยผ่าน client เขียนไม่ได้
for (const uid of [A, B, ADMIN]) {
  await rejects(
    asUser(db, uid, `insert into maintenance_photos (request_id, kind, file_path) values
      ('${REQ_101}', 'reported', 'maintenance/${ROOM_101}/${REQ_101}/x.jpg')`),
    /permission denied/,
  );
}
await rejects(
  asUser(db, ADMIN, `update maintenance_photos set kind = 'result' where request_id = '${REQ_101}'`),
  /permission denied/,
);
await rejects(asUser(db, ADMIN, "delete from maintenance_photos"), /permission denied/);
// ชนิดรูปต้องเป็น reported หรือ result
await rejects(
  db.exec(`insert into maintenance_photos (request_id, kind, file_path) values
    ('${REQ_101}', 'other', 'maintenance/${ROOM_101}/${REQ_101}/y.jpg')`),
  /maintenance_photos_kind_check|check constraint/i,
);
// path ซ้ำในตารางเดียวกันไม่ได้ (กันแถวซ้ำจากการอัปโหลดซ้ำ)
await rejects(
  db.exec(`insert into maintenance_photos (request_id, kind, file_path) values
    ('${REQ_101}', 'reported', 'maintenance/${ROOM_101}/${REQ_101}/p1.jpg')`),
  /duplicate key/,
);
// ลบงาน → รูปถูกลบตาม (on delete cascade)
await db.exec(`delete from maintenance_requests where id = '${REQ_205}'`);
assert.equal((await db.query(`select id from maintenance_photos where request_id = '${REQ_205}'`)).rows.length, 0);

// ---------- 6. ผู้เช่าจดมิเตอร์เองไม่ได้ (เขียนผ่าน server action เท่านั้น) ----------
await rejects(
  asUser(db, A, `insert into meter_readings (room_id, period, prev_value, curr_value)
    values ('${ROOM_101}', '2026-12-01', 392, 450)`),
  /row-level security/,
);
assert.equal(
  (await asRole(db, "anon", null, "select id from meter_readings")).rows.length,
  0,
);

console.log("path-a.test: all passed");