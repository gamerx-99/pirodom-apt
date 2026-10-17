-- ข้อความ LINE push ถึงผู้เช่า (ผลตรวจสลิป + ข้อความที่แอดมินส่งจาก /admin/messages)
-- เก็บสถานะการส่งแยกจากงานเงิน; ไม่มี cron: ส่งซ้ำด้วยมือจากหน้า messages
-- แถว channel = 'web' เดิมยังใช้ sent_at default now() และ status 'sent' ตามเดิม

alter table public.notifications
  alter column sent_at drop not null,
  add column status text not null default 'sent'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  add column last_error text,
  add column message text,
  add column created_at timestamptz not null default now(),
  add column created_by uuid references public.profiles (id);

-- ผลตรวจแต่ละรายการแจ้งผู้เช่าแต่ละคนได้ครั้งเดียว (กดซ้ำ/รีเฟรชไม่ส่งซ้ำ)
create unique index notifications_payment_line_idx
  on public.notifications (profile_id, payment_id, type)
  where channel = 'line';
