-- Storage RLS สำหรับ storage.objects (bucket ทั้งหมดเป็น private)
-- tenant เข้าถึงตรงได้เฉพาะไฟล์ของตัวเองตาม path ส่วน staff เข้าถึงได้ทั้งหมด
-- การอ่านหลักยังผ่าน Signed URL จาก server นโยบายนี้กันการเข้าถึง storage ตรง
--
-- รูปแบบ path ที่ tenant ต้องใช้:
--   slips/<lease_id>/<invoice_id>/<file>
--   documents/<lease_id>/<file>
--   meters/<room_id>/<period YYYY-MM-DD>/<file> (period ตรงกับ meter_readings.period)
--   maintenance/<room_id>/<request_id>/<file>

-- หมายเหตุ: ไม่มี `alter table storage.objects enable row level security` ในไฟล์นี้
-- บน Supabase โฮสต์แล้ว storage.objects เปิด RLS อยู่แล้ว และตารางเป็นของ supabase_storage_admin
-- คำสั่ง enable จึงล้มเหลวด้วย "must be owner of table objects" และทำให้ทั้ง migration ล้ม
-- ชุดทดสอบ PGlite จึงเปิด RLS เองใน supabase/tests/rls.test.mjs เพื่อจำลองสภาพแวดล้อมจริง

drop policy if exists staff_slips_all on storage.objects;
drop policy if exists staff_meters_all on storage.objects;
drop policy if exists staff_maintenance_all on storage.objects;
drop policy if exists staff_documents_all on storage.objects;
drop policy if exists tenant_slips_select on storage.objects;
drop policy if exists tenant_slips_insert on storage.objects;
drop policy if exists tenant_documents_select on storage.objects;
drop policy if exists tenant_meters_select on storage.objects;
drop policy if exists tenant_maintenance_select on storage.objects;
drop policy if exists tenant_maintenance_insert on storage.objects;

-- staff จัดการได้ทุกไฟล์ใน 4 bucket
create policy staff_slips_all on storage.objects for all to authenticated
  using (bucket_id = 'slips' and public.is_staff())
  with check (bucket_id = 'slips' and public.is_staff());
create policy staff_meters_all on storage.objects for all to authenticated
  using (bucket_id = 'meters' and public.is_staff())
  with check (bucket_id = 'meters' and public.is_staff());
create policy staff_maintenance_all on storage.objects for all to authenticated
  using (bucket_id = 'maintenance' and public.is_staff())
  with check (bucket_id = 'maintenance' and public.is_staff());
create policy staff_documents_all on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_staff())
  with check (bucket_id = 'documents' and public.is_staff());

-- tenant อ่าน/อัปโหลดสลิปเฉพาะบิลของตัวเอง
create policy tenant_slips_select on storage.objects for select to authenticated
  using (
    bucket_id = 'slips'
    and exists (
      select 1 from public.invoices i
      join public.lease_tenants lt on lt.lease_id = i.lease_id
      where lt.profile_id = auth.uid()
        and i.lease_id::text = split_part(storage.objects.name, '/', 1)
        and i.id::text = split_part(storage.objects.name, '/', 2)
    )
  );
create policy tenant_slips_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'slips'
    and exists (
      select 1 from public.invoices i
      join public.lease_tenants lt on lt.lease_id = i.lease_id
      where lt.profile_id = auth.uid()
        and i.lease_id::text = split_part(storage.objects.name, '/', 1)
        and i.id::text = split_part(storage.objects.name, '/', 2)
    )
  );

-- tenant อ่านเอกสารเฉพาะสัญญาของตัวเอง (อัปโหลดโดย staff เท่านั้น)
-- หมายเหตุ: เวอร์ชันนี้ถูกลงฐานข้อมูลจริงแล้ว จึงแก้ไฟล์ให้ตรงกับที่ลงไป
-- การกรองสถานะสัญญาเพิ่มเติมอยู่ใน 20261018000002_tighten_storage_policies.sql
create policy tenant_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.lease_tenants lt
      where lt.profile_id = auth.uid()
        and lt.lease_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

-- tenant อ่านรูปมิเตอร์เฉพาะงวดที่มีแถวข้อมูลในช่วงสัญญาตัวเอง
create policy tenant_meters_select on storage.objects for select to authenticated
  using (
    bucket_id = 'meters'
    and exists (
      select 1 from public.meter_readings mr
      where mr.room_id::text = split_part(storage.objects.name, '/', 1)
        and mr.period::text = split_part(storage.objects.name, '/', 2)
        and public.in_my_lease_period(mr.room_id, mr.period)
    )
  );

-- tenant อัปโหลดรูปซ่อมเฉพาะห้องที่เช่าอยู่ และอ่านเฉพาะไฟล์ของงานในช่วงสัญญาตัวเอง
-- หมายเหตุ: เวอร์ชันนี้ถูกลงฐานข้อมูลจริงแล้ว จึงแก้ไฟล์ให้ตรงกับที่ลงไป
-- การบังคับให้เป็นโฟลเดอร์ของงานจริงอยู่ใน 20261018000002_tighten_storage_policies.sql
create policy tenant_maintenance_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'maintenance'
    and exists (
      select 1 from public.leases l
      join public.lease_tenants lt on lt.lease_id = l.id
      where lt.profile_id = auth.uid()
        and l.status = 'active'
        and l.room_id::text = split_part(storage.objects.name, '/', 1)
    )
  );
create policy tenant_maintenance_select on storage.objects for select to authenticated
  using (
    bucket_id = 'maintenance'
    and exists (
      select 1 from public.maintenance_requests mr
      where mr.id::text = split_part(storage.objects.name, '/', 2)
        and mr.room_id::text = split_part(storage.objects.name, '/', 1)
        and public.in_my_lease_period(mr.room_id, (mr.created_at at time zone 'Asia/Bangkok')::date)
    )
  );
