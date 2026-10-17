-- Phase 2a (จดมิเตอร์) + Phase 4b (งานซ่อมหลายรูป) — เส้นทาง A
--
-- ขอบเขต: โครงสร้างที่จำเป็นต่อการจดมิเตอร์และงานซ่อมเท่านั้น
-- ไม่แตะสูตรเงิน รอบบิล หรือกติกาการคิดค่าใช้จ่ายใด ๆ (รอ Q-03 ถึง Q-05)
-- ไม่แก้โครงสร้าง maintenance_updates เดิม (ใช้เป็น timeline ต่อไป)
--
-- path ไฟล์ที่ใช้ต้องตรงกับ policy ใน 20261017000000_storage_rls.sql:
--   meters/<room_id>/<YYYY-MM-DD>/<file>
--   maintenance/<room_id>/<request_id>/<file>

-- ---------- meter_readings ----------

-- เลขมิเตอร์ไม่มีค่าติดลบ: กันทั้งค่าที่กรอกมาและค่าที่คำนวณได้ย้อนหลัง
alter table public.meter_readings
  add constraint meter_readings_prev_value_non_negative check (prev_value >= 0);
alter table public.meter_readings
  add constraint meter_readings_curr_value_non_negative check (curr_value >= 0);

-- หน้าจดมิเตอร์หลายห้องต้องดึง "งวดล่าสุดของห้อง" และ policy ฝั่งผู้เช่ากรองด้วย
-- (room_id, period) — unique (room_id, period) เดิมเป็น ascending จึงต้องมีดัชนี desc แยก
create index if not exists meter_readings_room_period_idx
  on public.meter_readings (room_id, period desc);

-- ---------- งานซ่อมหลายรูป ----------
-- maintenance_requests ไม่มีที่เก็บรูป (ดู BLUEPRINT 5) — เพิ่มตารางแยกแทนการแก้ตารางเดิม
create table if not exists public.maintenance_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  kind text not null default 'reported' check (kind in ('reported', 'result')),
  file_path text not null unique,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists maintenance_photos_request_idx
  on public.maintenance_photos (request_id, created_at);

-- คิวงานซ่อมฝั่งแอดมิน (สถานะ → เก่าสุด) และ timeline รายห้อง
create index if not exists maintenance_requests_status_created_idx
  on public.maintenance_requests (status, created_at desc);
create index if not exists maintenance_requests_room_created_idx
  on public.maintenance_requests (room_id, created_at desc);

-- ---------- RLS ของตารางใหม่ ----------
-- อ่านอย่างเดียวสำหรับทุกบทบาท: staff เห็นทั้งหมด ผู้เช่าเห็นเฉพาะรูปของงาน
-- ที่ policy ของ maintenance_requests บอกว่าเป็นของตัวเอง (ผ่านช่วงสัญญาเหมือนกัน)
alter table public.maintenance_photos enable row level security;

create policy staff_all on public.maintenance_photos for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy tenant_read on public.maintenance_photos for select to authenticated
  using (request_id in (select id from public.maintenance_requests));

-- เขียนรูปจากฝั่ง server (service role) เท่านั้น — ผู้เช่าไม่ผูกแถวเอง
revoke insert, update, delete on public.maintenance_photos from anon, authenticated;