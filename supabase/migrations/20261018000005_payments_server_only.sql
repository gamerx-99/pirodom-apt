-- ผู้เช่าสร้าง payment ตรงจาก client ไม่ได้อีกต่อไป: ทุกสลิปต้องผ่าน /api/slipok/verify
-- (service role) ที่ตรวจ SlipOK + reference ซ้ำ ไม่เช่นนั้นผู้เช่า insert slip_path เดิม
-- เข้าคิวตรวจได้เอง และกิน unique "หนึ่งรายการเปิดต่อบิล" จนส่งสลิปจริงไม่ได้

drop policy tenant_insert on public.payments;
revoke insert (invoice_id, slip_path) on public.payments from authenticated;
revoke insert on public.payments from anon, authenticated;
