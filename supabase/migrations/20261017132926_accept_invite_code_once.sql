-- Bot invite code acceptance: bind the LINE identity and consume the code atomically.
-- Existing accept_invite remains available for historical tests/rollback compatibility;
-- webhooks use this RPC, whose duplicate delivery only succeeds for the same user.
create or replace function public.accept_invite_code(
  p_code_hash text,
  p_user_id uuid,
  p_display_name text,
  p_phone text default null
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
  select * into v_invite
  from public.room_invitations
  where token_hash = p_code_hash
  for update;

  if not found then
    return query select false, 'invalid_code', null::uuid, null::uuid;
    return;
  end if;

  select * into v_lease from public.leases where id = v_invite.lease_id for update;

  -- A webhook redelivery is idempotent only for the LINE identity that consumed the code.
  if v_invite.used_at is not null then
    if v_invite.used_by = p_user_id and exists (
      select 1 from public.lease_tenants where lease_id = v_lease.id and profile_id = p_user_id
    ) then
      return query select true, 'ok', v_lease.id, v_lease.room_id;
    else
      return query select false, 'already_used', null::uuid, null::uuid;
    end if;
    return;
  end if;

  if v_invite.revoked_at is not null then
    return query select false, 'revoked', null::uuid, null::uuid;
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

  insert into public.profiles as current_profile (id, display_name, phone)
  values (p_user_id, p_display_name, p_phone)
  on conflict (id) do update
    set display_name = excluded.display_name,
        phone = coalesce(excluded.phone, current_profile.phone);

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

revoke all on function public.accept_invite_code(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.accept_invite_code(text, uuid, text, text) to service_role;
