-- Phase 1: กันสัญญา active ซ้อนห้อง + เพิกถอนคำเชิญ (Blueprint 5 / TODO Phase 1)
-- ไม่ฝังกติกาเงิน (Q-03..Q-05): เก็บเฉพาะ constraint โครงสร้าง

-- 1 ห้องมีสัญญา active ได้ 1 ฉบับ (กันเปิดเช่าซ้ำขณะมีสัญญาขัดกัน)
create unique index if not exists leases_one_active_per_room
  on public.leases (room_id) where status = 'active';

-- เพิกถอนคำเชิญโดยตรง (เดิมมีแค่หมดอายุ/ใช้แล้ว)
alter table public.room_invitations
  add column if not exists revoked_at timestamptz;

create index if not exists room_invitations_lease_idx
  on public.room_invitations (lease_id);
