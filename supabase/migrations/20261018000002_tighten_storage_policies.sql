-- เก็บ policy ที่แก้หลัง migration รุ่นแรกถูกลงฐานข้อมูลจริงแล้ว
-- 20261017000000_storage_rls.sql ถูก apply ไปแล้ว จึงแก้ไฟล์นั้นไม่ได้อีก
-- ไฟล์นี้ drop แล้วสร้าง policy ใหม่แบบ idempotent จึงลงซ้ำได้โดยไม่พัง

-- ---------- 1. ผู้เช่าที่ย้ายออกแล้วไม่เห็น metadata ของไฟล์เอกสารเก่า ----------
-- policy เดิมเช็กแค่ว่าเป็นสมาชิกของ lease ไม่ได้เช็กสถานะสัญญา
-- ผู้เช่าที่สัญญาจบแล้วจึงยัง select storage.objects ของ lease ตัวเองเจอได้
-- (ดาวน์โหลดไม่ได้เพราะ bucket private และไม่มีใครออก Signed URL ให้ แต่ metadata ไม่ควรรั่ว)
drop policy if exists tenant_documents_select on storage.objects;
create policy tenant_documents_select on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.lease_tenants lt
      join public.leases l on l.id = lt.lease_id
      where lt.profile_id = auth.uid()
        and l.status = 'active'
        and lt.lease_id::text = split_part(storage.objects.name, '/', 1)
    )
  );

-- ---------- 2. ผู้เช่าอัปโหลดรูปซ่อมได้เฉพาะโฟลเดอร์ของงานจริงในห้องที่เช่าอยู่ ----------
-- policy เดิมเช็กแค่ room_id ทำให้อัปโหลดเข้าโฟลเดอร์ของงานอื่นในห้องตัวเองได้
-- (ห้องเดียวกัน ไม่ข้ามห้อง แต่ก็ไม่ควรเขียนทับงานของคนอื่น)
drop policy if exists tenant_maintenance_insert on storage.objects;
create policy tenant_maintenance_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'maintenance'
    and exists (
      select 1 from public.maintenance_requests mr
      join public.leases l on l.room_id = mr.room_id and l.status = 'active'
      join public.lease_tenants lt on lt.lease_id = l.id
      where lt.profile_id = auth.uid()
        and mr.room_id::text = split_part(storage.objects.name, '/', 1)
        and mr.id::text = split_part(storage.objects.name, '/', 2)
        -- งานต้องเกิดในช่วงที่ผู้เช่าคนนี้เช่าห้องนั้นจริง
        -- ไม่เช่นนั้นผู้เช่าห้องใหม่จะเขียนทับโฟลเดอร์ของงานผู้เช่าเดิมในห้องเดียวกันได้
        and (mr.created_at at time zone 'Asia/Bangkok')::date >= l.start_date
        and (l.end_date is null or (mr.created_at at time zone 'Asia/Bangkok')::date <= l.end_date)
    )
  );