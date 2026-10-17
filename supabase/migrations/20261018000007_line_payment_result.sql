-- แจ้งผลตรวจสลิปให้ผู้เช่าทาง LINE push: เก็บสถานะการส่งแยกจากงานเงิน
-- แถว channel = 'web' เดิมยังใช้ sent_at default now() และ status 'sent' ตามเดิม

alter table public.notifications
  alter column sent_at drop not null,
  add column status text not null default 'sent'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  add column last_error text;

-- ผลตรวจแต่ละรายการแจ้งผู้เช่าแต่ละคนได้ครั้งเดียว (กดซ้ำ/รีเฟรชไม่ส่งซ้ำ)
create unique index notifications_payment_line_idx
  on public.notifications (profile_id, payment_id, type)
  where channel = 'line';
