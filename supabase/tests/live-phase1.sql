-- Phase 1 database verification on the explicitly approved Supabase target.
-- All fixtures roll back. No real LINE identities, email delivery or object uploads.
-- This verifies DB behavior, not browser/LIFF end-to-end completion.
do $test$
declare
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
  ra uuid:=gen_random_uuid(); rb uuid:=gen_random_uuid();
  la uuid:=gen_random_uuid(); lb uuid:=gen_random_uuid(); ended uuid:=gen_random_uuid();
  invite_hash text:=encode(sha256(gen_random_uuid()::text::bytea),'hex');
  second_hash text:=encode(sha256(gen_random_uuid()::text::bytea),'hex');
  marker text:=gen_random_uuid()::text; result record; count_rows integer;
begin
  begin
    insert into auth.users(id) values(a),(b),(admin_id);
    insert into public.profiles(id,role) values(a,'tenant'),(b,'tenant'),(admin_id,'admin');
    insert into public.rooms(id,room_no,unit_type) values
      (ra,'P1-'||ra::text,'residential'),(rb,'P1-'||rb::text,'commercial');
    insert into public.leases(id,room_id,start_date,rent_amount,due_day) values
      (la,ra,'2026-10-01',3500,31),(lb,rb,'2026-10-01',5000,10);
    insert into public.leases(id,room_id,start_date,end_date,status,rent_amount,due_day)
      values(ended,ra,'2026-01-01','2026-09-30','ended',3500,31);
    begin
      insert into public.leases(room_id,start_date,rent_amount,due_day) values(ra,'2026-10-02',3500,31);
      raise exception 'Duplicate active lease was accepted';
    exception when unique_violation then null; end;

    insert into public.room_invitations(lease_id,token_hash,expires_at) values
      (la,invite_hash,now()+interval '7 days'),(la,second_hash,now()+interval '7 days'),
      (lb,marker||'-expired',now()-interval '1 second'),
      (lb,marker||'-revoked',now()+interval '7 days'),
      (ended,marker||'-closed',now()+interval '7 days'),
      (lb,marker||'-rollback',now()+interval '7 days'),
      (lb,marker||'-admin',now()+interval '7 days');
    update public.room_invitations set revoked_at=now() where token_hash=marker||'-revoked';

    select * into result from public.accept_invite(invite_hash,a,'Phase1 A','0800000001');
    if not result.ok or result.out_lease_id<>la or result.out_room_id<>ra then raise exception 'Accept mapping failed'; end if;
    if not exists(select 1 from public.lease_tenants where lease_id=la and profile_id=a and is_primary)
      then raise exception 'First member is not primary'; end if;
    if not exists(select 1 from public.room_invitations i where i.token_hash=invite_hash and used_by=a and used_at is not null)
      then raise exception 'Invite not consumed'; end if;
    select * into result from public.accept_invite(invite_hash,a,'Phase1 A','0800000001');
    if not result.ok then raise exception 'Same-user retry not idempotent'; end if;
    select count(*) into count_rows from public.lease_tenants where lease_id=la;
    if count_rows<>1 then raise exception 'Duplicate membership'; end if;
    select * into result from public.accept_invite(invite_hash,b,'Phase1 B','0800000002');
    if result.ok or result.code<>'already_used' then raise exception 'Reused invite accepted by B'; end if;
    select * into result from public.accept_invite(marker||'-expired',b,'Phase1 B','0800000002');
    if result.ok or result.code<>'expired' then raise exception 'Expired invite accepted'; end if;
    select * into result from public.accept_invite(marker||'-revoked',b,'Phase1 B','0800000002');
    if result.ok or result.code<>'revoked' then raise exception 'Revoked invite accepted'; end if;
    select * into result from public.accept_invite(marker||'-closed',b,'Phase1 B','0800000002');
    if result.ok or result.code<>'lease_closed' then raise exception 'Closed lease accepted'; end if;
    select * into result from public.accept_invite(marker||'-missing',b,'Phase1 B','0800000002');
    if result.ok or result.code<>'invalid_token' then raise exception 'Unknown invite accepted'; end if;

    select * into result from public.accept_invite(second_hash,b,'Phase1 B','0800000002');
    if not result.ok then raise exception 'Co-tenant invite failed'; end if;
    if not exists(select 1 from public.lease_tenants where lease_id=la and profile_id=b and not is_primary)
      then raise exception 'Co-tenant unexpectedly primary'; end if;
    if public.remove_lease_tenant(la,a)<>'is_primary' then raise exception 'Primary removal allowed'; end if;
    if not public.set_primary_tenant(la,b) then raise exception 'Primary reassignment failed'; end if;
    if (select count(*) from public.lease_tenants where lease_id=la and is_primary)<>1 then raise exception 'Primary not unique'; end if;
    if public.remove_lease_tenant(la,a)<>'ok' then raise exception 'Tenant removal failed'; end if;
    if public.remove_lease_tenant(la,a)<>'not_found' then raise exception 'Repeated removal wrong status'; end if;

    begin
      perform * from public.accept_invite(marker||'-rollback',gen_random_uuid(),'Missing auth','0800000003');
      raise exception 'Missing auth user unexpectedly accepted';
    exception when foreign_key_violation then null; end;
    if exists(select 1 from public.room_invitations where token_hash=marker||'-rollback' and used_at is not null)
      then raise exception 'Failed acceptance consumed invite'; end if;
    select * into result from public.accept_invite(marker||'-admin',admin_id,'Phase1 Admin','0800000004');
    if not result.ok or (select role from public.profiles where id=admin_id)<>'admin'
      then raise exception 'Accept changed existing staff role'; end if;

    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub',a::text,true);
    perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
    if exists(select 1 from public.leases where id=la) then raise exception 'Removed member retained lease access'; end if;
    execute 'reset role';
    raise exception using errcode='ZX002',message='ROLLBACK_PHASE1_FIXTURES';
  exception when sqlstate 'ZX002' then
    raise notice 'LIVE_PHASE1_DB_PASS; all fixtures rolled back';
  end;
end;
$test$;
