-- อัปโหลดทุกชนิดทำฝั่ง server ผ่าน service role (lib/storage.ts uploadPrivateFile)
-- ผู้เช่าจึงไม่ต้องเขียน Storage / ตาราง payments ตรงจาก client: ถอน policy ที่ไม่ได้ใช้
-- เพื่อไม่ให้อัปโหลดไฟล์เกินขนาด/ผิดชนิดโดยเลี่ยง API ที่ตรวจไว้

drop policy if exists tenant_slips_insert on storage.objects;
drop policy if exists tenant_maintenance_insert on storage.objects;
drop policy if exists tenant_insert on public.payments;

-- ขีดจำกัดระดับ bucket ให้ตรงกับ ALLOWED_CONTENT / MAX_BYTES ใน lib/storage.ts
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  where id = 'slips';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
  where id = 'documents';
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id in ('meters', 'maintenance');
