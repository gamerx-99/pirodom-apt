-- Live PostgreSQL authorization checks. Requires privileged SQL access.
-- Run only on the approved target. All fixtures are rolled back, including on error.
-- Does not test LINE/LIFF login, JWT signatures, Storage upload HTTP, or signed URLs.
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  former uuid := gen_random_uuid(); staff uuid := gen_random_uuid();
  ra uuid := gen_random_uuid(); rb uuid := gen_random_uuid();
  la uuid := gen_random_uuid(); lb uuid := gen_random_uuid(); oldlease uuid := gen_random_uuid();
  ia uuid := gen_random_uuid(); ib uuid := gen_random_uuid();
  da uuid := gen_random_uuid(); db uuid := gen_random_uuid(); dc uuid := gen_random_uuid();
  checks integer := 0; changed integer; sig text; r text;
begin
  -- This inner block is a PostgreSQL subtransaction. Its deliberate exception
  -- rolls back every fixture even when the outer DO statement succeeds.
  begin
  -- Match actual Supabase auth schema without provisioning persistent login accounts.
  insert into auth.users(id) values(a),(b),(former),(staff);
  insert into public.profiles(id,role) values(a,'tenant'),(b,'tenant'),(former,'tenant'),(staff,'admin');
  insert into public.rooms(id,room_no,unit_type) values
    (ra,'RLS-'||ra::text,'residential'),(rb,'RLS-'||rb::text,'residential');
  insert into public.leases(id,room_id,start_date,rent_amount,due_day) values
    (la,ra,'2026-10-01',3500,31),(lb,rb,'2026-10-01',3500,31);
  insert into public.leases(id,room_id,start_date,end_date,status,rent_amount,due_day)
    values(oldlease,ra,'2026-01-01','2026-09-30','ended',3500,31);
  insert into public.lease_tenants(lease_id,profile_id,is_primary)
    values(la,a,true),(lb,b,true),(oldlease,former,true);
  insert into public.invoices(id,lease_id,period,due_date,total,status)
    values(ia,la,'2026-11-01','2026-10-31',3500,'issued'),
          (ib,lb,'2026-11-01','2026-10-31',3500,'issued');
  insert into public.documents(id,lease_id,type,file_path) values
    (da,la,'rls-test','documents/'||la::text||'/test.pdf'),
    (db,lb,'rls-test','documents/'||lb::text||'/test.pdf'),
    (dc,oldlease,'rls-test','documents/'||oldlease::text||'/test.pdf');
  insert into storage.objects(bucket_id,name) values
    ('documents',la::text||'/test.pdf'),('documents',lb::text||'/test.pdf'),
    ('documents',oldlease::text||'/test.pdf');

  foreach sig in array array['public.accept_invite(text,uuid,text,text)',
    'public.set_primary_tenant(uuid,uuid)','public.remove_lease_tenant(uuid,uuid)'] loop
    foreach r in array array['anon','authenticated'] loop
      if has_function_privilege(r,sig,'EXECUTE') then raise exception 'RPC grant leaked: % / %',r,sig; end if;
      checks := checks + 1;
    end loop;
    if not has_function_privilege('service_role',sig,'EXECUTE') then raise exception 'Missing service RPC grant: %',sig; end if;
    checks := checks + 1;
  end loop;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  if auth.uid() is distinct from a then raise exception 'auth.uid mismatch'; end if;
  if (select count(*) from public.rooms where id in (ra,rb)) <> 1 then raise exception 'A room isolation'; end if;
  if (select count(*) from public.invoices where id in (ia,ib)) <> 1 then raise exception 'A invoice isolation'; end if;
  if not exists(select 1 from public.invoices where id=ia) then raise exception 'A cannot read own invoice'; end if;
  if (select count(*) from public.documents where id in (da,db,dc)) <> 1 then raise exception 'A document isolation'; end if;
  if (select count(*) from storage.objects where bucket_id='documents' and name in
      (la::text||'/test.pdf',lb::text||'/test.pdf',oldlease::text||'/test.pdf')) <> 1 then raise exception 'A storage isolation'; end if;
  checks := checks + 6;
  begin
    update public.invoices set total=1 where id=ia;
    raise exception 'Tenant changed invoice';
  exception when insufficient_privilege then checks := checks + 1; end;
  update public.profiles set role='admin' where id=a;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Tenant promoted own role'; end if;
  checks := checks + 1;
  begin
    insert into public.payments(invoice_id,slip_path,status) values(ia,'test','verified');
    raise exception 'Tenant set payment verification status';
  exception when insufficient_privilege then checks := checks + 1; end;
  begin
    perform * from public.accept_invite('rls-test',a,'test','000');
    raise exception 'Tenant called restricted RPC';
  exception when insufficient_privilege then checks := checks + 1; end;

  perform set_config('request.jwt.claim.sub',b::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',b,'role','authenticated')::text,true);
  if exists(select 1 from public.invoices where id=ia) or not exists(select 1 from public.invoices where id=ib)
    then raise exception 'B invoice isolation'; end if;
  if exists(select 1 from public.documents where id=da) then raise exception 'B document leak'; end if;
  checks := checks + 2;

  perform set_config('request.jwt.claim.sub',former::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',former,'role','authenticated')::text,true);
  if exists(select 1 from public.rooms where id=ra) then raise exception 'Former tenant active room leak'; end if;
  if exists(select 1 from public.documents where id in (da,dc)) then raise exception 'Former tenant document leak'; end if;
  if exists(select 1 from storage.objects where bucket_id='documents' and name in
    (la::text||'/test.pdf',oldlease::text||'/test.pdf')) then raise exception 'Former tenant Storage leak'; end if;
  checks := checks + 3;

  perform set_config('request.jwt.claim.sub',staff::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',staff,'role','authenticated')::text,true);
  if (select count(*) from public.rooms where id in (ra,rb)) <> 2 then raise exception 'Staff room access'; end if;
  if (select count(*) from public.documents where id in (da,db,dc)) <> 3 then raise exception 'Staff document access'; end if;
  if (select count(*) from storage.objects where bucket_id='documents' and name in
    (la::text||'/test.pdf',lb::text||'/test.pdf',oldlease::text||'/test.pdf')) <> 3 then raise exception 'Staff Storage access'; end if;
  checks := checks + 3;

  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  if exists(select 1 from public.rooms where id in (ra,rb)) then raise exception 'Anon room leak'; end if;
  if exists(select 1 from public.invoices where id in (ia,ib)) then raise exception 'Anon invoice leak'; end if;
  if exists(select 1 from storage.objects where bucket_id='documents' and name in
    (la::text||'/test.pdf',lb::text||'/test.pdf',oldlease::text||'/test.pdf')) then raise exception 'Anon Storage leak'; end if;
  checks := checks + 3;
  execute 'reset role';
  if checks <> 30 then raise exception 'Unexpected assertion count: %', checks; end if;
  raise exception using errcode='ZX001',message='ROLLBACK_VERIFIED_FIXTURES';
  exception when sqlstate 'ZX001' then
    raise notice 'LIVE_RLS_PASS: 30 assertions; all fixtures rolled back';
  end;
end;
$test$;
