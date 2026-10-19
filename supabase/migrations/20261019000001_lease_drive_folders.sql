-- รหัสโฟลเดอร์ Google Drive ของสัญญา: { folder, slips, documents } สร้างตอนเปิดสัญญา
alter table public.leases add column drive_folders jsonb;
