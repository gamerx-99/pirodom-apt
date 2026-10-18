-- ราคาตั้งต้นรายห้อง: สร้างสัญญาจะดึงค่าเหล่านี้ไปเป็นราคาของสัญญา
-- ระหว่างมีสัญญา active ห้ามแก้ราคาห้อง (ราคาสัญญาล็อกอยู่ที่ leases อยู่แล้ว) ผู้เช่าออกแล้วจึงแก้ได้

alter table public.rooms
  add column rent_amount numeric(12, 2) not null default 0 check (rent_amount >= 0),
  add column deposit numeric(12, 2) not null default 0 check (deposit >= 0),
  add column water_fee numeric(12, 2) not null default 0 check (water_fee >= 0),
  add column electric_rate numeric(12, 2) not null default 0 check (electric_rate >= 0),
  add column due_day smallint not null default 31 check (due_day between 1 and 31);

create function public.lock_room_prices() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.rent_amount, new.deposit, new.water_fee, new.electric_rate, new.due_day)
       is distinct from (old.rent_amount, old.deposit, old.water_fee, old.electric_rate, old.due_day)
     and exists (select 1 from public.leases where room_id = old.id and status = 'active') then
    raise exception 'room_price_locked' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger rooms_lock_prices before update on public.rooms
  for each row execute function public.lock_room_prices();

-- ค่าเชื่อมต่อที่เจ้าของกรอกเองจากหน้า /admin/settings (SlipOK, PromptPay, LINE)
-- มีคีย์ลับ: เปิด RLS ไม่มี policy และถอนสิทธิ์ client ทั้งหมด อ่าน/เขียนผ่าน service role ฝั่ง server เท่านั้น
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
