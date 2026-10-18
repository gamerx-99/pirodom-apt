-- Serialize staff role changes and preserve the owner invariant across every admin action.
create function public.set_staff_role(
  p_target_id uuid,
  p_target_role text,
  p_actor_id uuid,
  p_display_name text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  target_display_name text;
  owner_count bigint;
begin
  if p_target_role not in ('owner', 'admin', 'tenant') then
    raise exception using errcode = '22023', message = 'invalid_target_role';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(19382746, 1);

  select p.role
    into actor_role
    from public.profiles p
    where p.id = p_actor_id
    for update;

  if not found or actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'actor_not_staff';
  end if;

  select p.role, p.display_name
    into target_role, target_display_name
    from public.profiles p
    where p.id = p_target_id
    for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'staff_not_found';
  end if;

  if p_target_role = 'owner' and actor_role <> 'owner' then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;

  if target_role = 'owner' and p_target_role <> 'owner' then
    if actor_role <> 'owner' then
      raise exception using errcode = '42501', message = 'owner_required';
    end if;

    select count(*)
      into owner_count
      from public.profiles p
      where p.role = 'owner';

    if owner_count <= 1 then
      raise exception using errcode = 'P0001', message = 'last_owner';
    end if;
  end if;

  if p_target_id = p_actor_id and p_target_role <> actor_role then
    raise exception using errcode = '42501', message = 'self_role_change';
  end if;

  update public.profiles
    set role = p_target_role,
        display_name = coalesce(p_display_name, display_name),
        phone = coalesce(nullif(p_phone, ''), phone)
    where id = p_target_id;

  return jsonb_build_object('role', target_role, 'display_name', target_display_name);
end;
$$;

revoke all on function public.set_staff_role(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.set_staff_role(uuid, text, uuid, text, text) to service_role;
