-- Serialize staff demotions so concurrent requests cannot remove the last owner.
create function public.demote_admin(p_target_id uuid, p_actor_role text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_role text;
  target_display_name text;
  owner_count bigint;
begin
  if p_actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'not_staff';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(19382746, 1);

  select p.role, p.display_name
    into target_role, target_display_name
    from public.profiles p
    where p.id = p_target_id
    for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'staff_not_found';
  end if;

  if target_role not in ('owner', 'admin') then
    raise exception using errcode = 'P0001', message = 'not_staff';
  end if;

  if target_role = 'owner' then
    if p_actor_role <> 'owner' then
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

  update public.profiles
    set role = 'tenant'
    where id = p_target_id;

  return jsonb_build_object('role', target_role, 'display_name', target_display_name);
end;
$$;

revoke all on function public.demote_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.demote_admin(uuid, text) to service_role;
