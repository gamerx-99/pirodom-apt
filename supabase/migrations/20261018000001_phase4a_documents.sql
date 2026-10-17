-- Phase 4a: เอกสารสัญญา (เส้นทาง B)
-- ขอบเขต: เพิ่มกลไกอัปโหลด/เปิดไฟล์เท่านั้น ยังไม่ฝังกติกาชนิดเอกสารห้องพัก/ร้านค้า (รอ Q-07)
-- ค่า documents.type คงเป็นข้อความอิสระตามที่ ROADMAP-PARALLEL ข้อ 4.1 กำหนด
--
-- path ของไฟล์ต้องเป็น documents/<lease_id>/<file> ให้ตรงกับ
--   1) policy tenant_documents_select ใน 20261017000000_storage_rls.sql
--   2) สัญญาของ lib/storage.ts (storagePath(bucket, ...parts))
-- ถ้า path ไม่ตรง ผู้เช่าจะเห็นรายการในตารางแต่เปิดไฟล์ไม่ได้ (หรือกลับกัน) จึงกันไว้ที่ชั้นฐานข้อมูล

-- ผู้อัปโหลด: server action ทุกตัวเรียก requireStaff() ก่อนเขียน จึงบันทึกผู้อัปโหลดไว้ทุกแถวใหม่
-- on delete set null เพราะ profile ที่ลบทิ้งไม่ควรลบเอกสารที่ยังใช้อ้างอิงอยู่
alter table public.documents
  add column if not exists uploaded_by uuid references public.profiles (id) on delete set null;

-- หน้าแอดมินและหน้าผู้เช่าดึงตาม lease_id เรียงใหม่สุดก่อนเสมอ
create index if not exists documents_lease_created_idx
  on public.documents (lease_id, created_at desc);

-- กันบันทึก path ที่ไม่ตรง lease_id ของแถวนั้น
-- NOT VALID: บังคับกับแถวใหม่/แถวที่แก้ทันที แต่ไม่ทำให้ migration ล้มกับข้อมูลเดิมที่อาจมีรูปแบบอื่น
-- (ถ้าต้องการตรวจข้อมูลเดิมด้วย ให้รัน alter table public.documents validate constraint documents_path_matches_lease;)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_path_matches_lease'
  ) then
    alter table public.documents
      add constraint documents_path_matches_lease
      check (file_path like 'documents/' || lease_id::text || '/%' and length(split_part(file_path, '/', 3)) > 0) not valid;
  end if;
end $$;

-- ---------- policy เดิมที่ยืนยันจากการตรวจ (ไม่แก้ไฟล์อื่น) ----------
-- 1. ผู้เช่าอ่าน documents ได้เฉพาะ lease_id ที่ตัวเองอยู่ (init.sql: tenant_read + my_lease_ids())
-- 2. ผู้เช่าอัปโหลดเอกสารเองไม่ได้ — ไม่มี insert/update/delete policy สำหรับ authenticated ที่ไม่ใช่ staff
--    (init.sql มีแต่ staff_all) ทั้งบนตาราง documents และบน storage.objects
--    มีแต่ tenant_documents_select ที่อ่านได้ อัปโหลดไม่ได้ (20261017000000_storage_rls.sql:37,66)
-- ไม่เพิ่มสิทธิ์ใด ๆ ในไฟล์นี้

-- ---------- เก็บสิทธิ์เดิม: ผู้เช่าที่ย้ายออกแล้วเปิดเอกสารเดิมไม่ได้ ----------
-- policy เดิมใช้ my_lease_ids() ซึ่งคืน lease_id ทุกสัญญาที่ผูกอยู่โดยไม่กรองสถานะสัญญา
-- (ต่างจาก my_room_ids() ที่กรอง l.status = 'active') ผู้เช่าที่ปิดสัญญาแล้วจึงยังเห็น
-- เอกสารของสัญญาเดิม ขัดกับเกณฑ์จบ ROADMAP-PARALLEL ข้อ 4.4 จึงจำกัดเฉพาะตาราง documents
-- นี่คือการลดสิทธิ์ ไม่ใช่การเปิดสิทธิ์ใหม่: staff_all ยังทำงานเหมือนเดิม และผู้เช่ายังอัปโหลดเองไม่ได้
drop policy if exists tenant_read on public.documents;
create policy tenant_read on public.documents for select to authenticated
  using (
    exists (
      select 1
      from public.lease_tenants lt
      join public.leases l on l.id = lt.lease_id
      where lt.profile_id = auth.uid()
        and lt.lease_id = public.documents.lease_id
        and l.status = 'active'
    )
  );
