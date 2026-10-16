-- Phase 0: schema ตามบรีฟ 1.3 / 1.4 / 1.7
-- เงินเก็บเป็น numeric(12,2) บาท

-- ---------- ตาราง ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  line_user_id text unique,
  display_name text,
  phone text,
  role text not null default 'tenant' check (role in ('owner', 'admin', 'tenant')),
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_no text not null unique,
  unit_type text not null check (unit_type in ('residential', 'commercial')),
  floor int,
  status text not null default 'vacant'
    check (status in ('vacant', 'reserved', 'occupied', 'moving_out', 'maintenance'))
);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  start_date date not null,
  end_date date,
  rent_amount numeric(12, 2) not null,
  water_fee numeric(12, 2) not null default 0,
  electric_rate numeric(12, 2) not null default 0,
  -- จ่ายก่อนอยู่: วันครบกำหนดของแต่ละรอบ 31 = วันสุดท้ายของเดือน (ห้อง 205 = 10)
  due_day smallint not null check (due_day between 1 and 31),
  deposit numeric(12, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

create table public.lease_tenants (
  lease_id uuid not null references public.leases (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (lease_id, profile_id)
);

create table public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id)
);

create table public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  period date not null, -- วันที่ 1 ของเดือนที่จด
  prev_value numeric(12, 2) not null,
  curr_value numeric(12, 2) not null,
  units numeric(12, 2) generated always as (curr_value - prev_value) stored,
  photo_path text,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (room_id, period)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id),
  period date not null, -- วันที่ 1 ของเดือนค่าเช่า
  issue_date date,
  due_date date not null,
  total numeric(12, 2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'verifying', 'pending_review', 'paid', 'overdue', 'void')),
  created_at timestamptz not null default now(),
  unique (lease_id, period) -- กันสร้างบิลซ้ำ
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  type text not null, -- rent / water / electric / extra / discount / penalty
  description text,
  qty numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null, -- เก็บค่าไฟต่อหน่วยของเดือนนั้นไว้เลย
  amount numeric(12, 2) not null
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id),
  amount numeric(12, 2),
  slip_path text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'slipok_passed', 'slipok_failed', 'mismatch', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  review_reason text,
  created_at timestamptz not null default now()
);

create table public.payment_verifications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  provider text not null default 'slipok',
  result text not null,
  provider_reference text unique, -- กันใช้สลิปเดิมซ้ำ
  raw_response jsonb,
  checked_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases (id) on delete cascade,
  type text not null,
  file_path text not null,
  created_at timestamptz not null default now()
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  category text not null,
  priority text not null default 'normal',
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'in_progress', 'waiting', 'done', 'closed')),
  created_at timestamptz not null default now()
);

create table public.maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.maintenance_requests (id) on delete cascade,
  status text not null,
  note text,
  photo_path text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  channel text not null default 'line',
  sent_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  table_name text not null,
  record_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ---------- RLS helpers ----------

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create function public.my_lease_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select lease_id from public.lease_tenants where profile_id = auth.uid();
$$;

-- ห้องของสัญญาที่ยัง active (ผู้เช่าที่ย้ายออกแล้วไม่ได้ห้องคืน)
create function public.my_room_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select l.room_id from public.leases l
  join public.lease_tenants lt on lt.lease_id = l.id
  where lt.profile_id = auth.uid() and l.status = 'active';
$$;

-- ข้อมูลรายห้อง (มิเตอร์/งานซ่อม) เห็นได้เฉพาะช่วงสัญญาของตัวเอง ไม่เห็นของผู้เช่าคนก่อน/คนถัดไป
create function public.in_my_lease_period(p_room_id uuid, p_at date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leases l
    join public.lease_tenants lt on lt.lease_id = l.id
    where lt.profile_id = auth.uid()
      and l.room_id = p_room_id
      and p_at >= l.start_date
      and (p_at <= l.end_date or (l.end_date is null and l.status = 'active'))
  );
$$;

-- ---------- RLS: เปิดทุกตาราง, owner/admin เข้าถึงทั้งหมด ----------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'rooms', 'leases', 'lease_tenants', 'room_invitations', 'meter_readings',
    'invoices', 'invoice_items', 'payments', 'payment_verifications', 'documents',
    'maintenance_requests', 'maintenance_updates', 'notifications', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      t
    );
  end loop;
end $$;

-- ---------- RLS: ผู้เช่าเห็นเฉพาะข้อมูลที่ผูกกับ lease_tenants ของตัวเอง ----------

create policy tenant_read on public.profiles for select to authenticated
  using (id = auth.uid());
create policy tenant_read on public.rooms for select to authenticated
  using (id in (select public.my_room_ids()));
create policy tenant_read on public.leases for select to authenticated
  using (id in (select public.my_lease_ids()));
create policy tenant_read on public.lease_tenants for select to authenticated
  using (lease_id in (select public.my_lease_ids()));
create policy tenant_read on public.meter_readings for select to authenticated
  using (public.in_my_lease_period(room_id, period));
create policy tenant_read on public.invoices for select to authenticated
  using (lease_id in (select public.my_lease_ids()));
create policy tenant_read on public.invoice_items for select to authenticated
  using (invoice_id in (select id from public.invoices where lease_id in (select public.my_lease_ids())));
create policy tenant_read on public.payments for select to authenticated
  using (invoice_id in (select id from public.invoices where lease_id in (select public.my_lease_ids())));
create policy tenant_read on public.documents for select to authenticated
  using (lease_id in (select public.my_lease_ids()));
create policy tenant_read on public.maintenance_requests for select to authenticated
  using (public.in_my_lease_period(room_id, (created_at at time zone 'Asia/Bangkok')::date));
-- ผ่าน RLS ของ maintenance_requests อีกชั้น
create policy tenant_read on public.maintenance_updates for select to authenticated
  using (request_id in (select id from public.maintenance_requests));
create policy tenant_read on public.notifications for select to authenticated
  using (profile_id = auth.uid());

-- ผู้เช่าสร้าง payment ได้เฉพาะบิลของตัวเอง, แจ้งซ่อมได้เฉพาะห้องของตัวเอง
create policy tenant_insert on public.payments for insert to authenticated
  with check (invoice_id in (select id from public.invoices where lease_id in (select public.my_lease_ids())));
create policy tenant_insert on public.maintenance_requests for insert to authenticated
  with check (room_id in (select public.my_room_ids()));

-- ---------- สิทธิ์ระดับคอลัมน์: ผู้เช่าแก้ยอดเงินหรือสถานะไม่ได้ ----------
-- งานที่มีผลกับเงินทำฝั่ง server (service role) เท่านั้น จึงปิดการเขียนตารางเงินจาก client ทั้งหมด

revoke insert, update, delete on public.invoices, public.invoice_items, public.payment_verifications
  from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;
grant insert (invoice_id, slip_path) on public.payments to authenticated;
revoke insert on public.maintenance_requests from anon, authenticated;
grant insert (room_id, category, priority, description) on public.maintenance_requests to authenticated;

-- audit log แก้/ลบจาก client ไม่ได้ (เขียนจาก server เท่านั้น)
revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- ---------- Storage: Private Bucket ทั้งหมด (เปิดดูผ่าน Signed URL) ----------

insert into storage.buckets (id, name, public) values
  ('slips', 'slips', false),
  ('meters', 'meters', false),
  ('maintenance', 'maintenance', false),
  ('documents', 'documents', false);
