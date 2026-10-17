-- Phase 1: รับคำเชิญแบบ atomic — ลิงก์เชิญรับได้ครั้งเดียวแม้กดพร้อมกันหลายเครื่อง
--
-- ROADMAP Phase 1: "ป้องกันการรับลิงก์พร้อมกัน" เดิม route เขียน lease_tenants ก่อนแล้วค่อย
-- พลิก used_at ทีหลัง ผู้ใช้คนที่สองจึงได้ผูกสัญญาแม้ได้ 409 already_used
--
-- วิธีแก้: ทำทั้ง "ผูกผู้เช่า" + "กินคำเชิญ" ในฟังก์ชันเดียวกัน โดยล็อกแถวคำเชิญ
-- (select ... for update) ก่อนตรวจ used_at — คำขอพร้อมกันจะรอคิวกัน แล้วคนที่สอง
-- เห็น used_at ที่เพิ่งถูกเขียน จึงถูกปฏิเสธโดยไม่ได้ผูกสัญญา
-- ถ้าส่วนใดล้มเหลว ทั้งฟังก์ชัน rollback: ไม่มีทั้ง lease_tenants และ used_at ค้าง

create or replace function public.accept_invite(
  p_token_hash text,
  p_user_id uuid,
  p_display_name text,
  p_phone text
)
returns table (ok boolean, code text, out_lease_id uuid, out_room_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.room_invitations%rowtype;
  v_lease public.leases%rowtype;
  v_is_primary boolean;
begin
  -- ล็อกแถวคำเชิญก่อนอ่าน used_at: คำขอพร้อมกันจะถูกล็อกต่อคิว ไม่ใช่อ่านค่าเก่า
  select * into v_invite
  from public.room_invitations
  where token_hash = p_token_hash
  for update;

if not found then
    return query select false, 'invalid_token', null::uuid, null::uuid;
    return;
  end if;

  -- ล็อกแถวสัญญาด้วย ไม่งั้นสองคำเชิญของสัญญาเดียวกันที่รับพร้อมกันจะได้ is_primary พร้อมกันสองคน
  select * into v_lease from public.leases where id = v_invite.lease_id for update;

  -- ผู้กับสัญญานี้อยู่แล้ว → สำเร็จเสมอ (กันกดเบิ้ล และไม่ให้สิทธิ์กับผู้อื่น)
  if v_lease.id is not null and exists (
    select 1 from public.lease_tenants
    where lease_id = v_lease.id and profile_id = p_user_id
  ) then
    return query select true, 'ok', v_lease.id, v_lease.room_id;
    return;
  end if;

  if v_invite.revoked_at is not null then
    return query select false, 'revoked', null::uuid, null::uuid;
    return;
  end if;
  if v_invite.used_at is not null then
    return query select false, 'already_used', null::uuid, null::uuid;
    return;
  end if;
  if v_invite.expires_at < now() then
    return query select false, 'expired', null::uuid, null::uuid;
    return;
  end if;
  if v_lease.id is null or v_lease.status <> 'active' then
    return query select false, 'lease_closed', null::uuid, null::uuid;
    return;
  end if;

  -- อัปเดตเฉพาะชื่อ/เบอร์ ไม่แตะ role (เดิมอาจถูกลดสิทธิ์ owner/admin เป็น tenant)
  insert into public.profiles (id, display_name, phone)
  values (p_user_id, p_display_name, p_phone)
  on conflict (id) do update
    set display_name = excluded.display_name,
        phone = excluded.phone;

  select not exists (
    select 1 from public.lease_tenants where lease_id = v_lease.id
  ) into v_is_primary;

  insert into public.lease_tenants (lease_id, profile_id, is_primary)
  values (v_lease.id, p_user_id, v_is_primary)
  on conflict (lease_id, profile_id) do nothing;

  update public.room_invitations
  set used_at = now(), used_by = p_user_id
  where id = v_invite.id and used_at is null;

  return query select true, 'ok', v_lease.id, v_lease.room_id;
end;
$$;

-- ---------- ผู้เช่าหลัก / ถอนผู้เช่า: ทำเป็นฟังก์ชันเดียวจบ ไม่งั้นสถานะกลางทางจะค้าง ----------

-- 1 สัญญามีผู้เช่าหลักได้คนเดียว (กันสองคนเป็นหลักจากคำเชิญ 2 ลิงก์ที่รับพร้อมกัน)
create unique index if not exists lease_tenants_one_primary
  on public.lease_tenants (lease_id) where is_primary;

-- เปลี่ยนผู้เช่าหลัก: เคลียร์ของเดิมแล้วตั้งของใหม่ในธุรกรรมเดียว
-- (สองคำสั่งแยกจะเหลือสัญญาที่ไม่มีผู้เช่าหลัก ถ้าคำสั่งที่สองล้ม)
create or replace function public.set_primary_tenant(p_lease_id uuid, p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.leases where id = p_lease_id for update;
  if not found then return false; end if;
  if not exists (
    select 1 from public.lease_tenants where lease_id = p_lease_id and profile_id = p_profile_id
  ) then
    return false;
  end if;
  update public.lease_tenants set is_primary = false where lease_id = p_lease_id and is_primary;
  update public.lease_tenants set is_primary = true
    where lease_id = p_lease_id and profile_id = p_profile_id;
  return true;
end;
$$;

-- ถอนผู้เช่า: ถอนผู้เช่าหลักไม่ได้ เพราะสัญญาจะไม่เหลือผู้เช่าหลัก
-- ให้ตั้งผู้เช่าหลักคนใหม่ก่อน หรือปิดสัญญาทั้งฉบับถ้าเป็นคนสุดท้าย
create or replace function public.remove_lease_tenant(p_lease_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from public.leases where id = p_lease_id for update;
  if not exists (
    select 1 from public.lease_tenants where lease_id = p_lease_id and profile_id = p_profile_id
  ) then
    return 'not_found';
  end if;
  if exists (
    select 1 from public.lease_tenants
    where lease_id = p_lease_id and profile_id = p_profile_id and is_primary
  ) then
    return 'is_primary';
  end if;
  delete from public.lease_tenants where lease_id = p_lease_id and profile_id = p_profile_id;
  return 'ok';
end;
$$;

-- ---------- สิทธิ์เรียกฟังก์ชันเหล่านี้ ----------
-- Supabase โฮสต์จะ grant execute ให้ anon/authenticated เป็นค่าเริ่มต้นของฟังก์ชันใน schema public
-- ฟังก์ชันชุดนี้เชื่อ p_user_id ที่ผู้เรียกส่งมา จึงต้องถอนสิทธิ์จากทุกบทบาทที่เรียกตรงได้
-- (revoke จาก public อย่างเดียวไม่ตัด grant ที่ให้ anon/authenticated โดยตรง)
revoke all on function public.accept_invite(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.set_primary_tenant(uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_lease_tenant(uuid, uuid) from public, anon, authenticated;

grant execute on function public.accept_invite(text, uuid, text, text) to service_role;
grant execute on function public.set_primary_tenant(uuid, uuid) to service_role;
grant execute on function public.remove_lease_tenant(uuid, uuid) to service_role;