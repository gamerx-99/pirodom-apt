-- Read-only audit. Run against the confirmed test project only.
-- No customer rows, secrets, or auth.users are selected.
begin transaction read only;

select current_database() as database_name, current_user, version();
select to_regclass('supabase_migrations.schema_migrations') as ledger_table;
-- If ledger_table above is NULL, skip this statement and record missing ledger.
select version, name from supabase_migrations.schema_migrations order by version;

select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and
      (n.nspname = 'public' or (n.nspname = 'storage' and c.relname = 'objects'))
order by 1, 2;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select grantee, table_schema, table_name, privilege_type
from information_schema.table_privileges
where table_schema in ('public', 'storage')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;

select grantee, table_schema, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by table_name, column_name, grantee, privilege_type;

select id, name, public from storage.buckets order by id;

select p.oid::regprocedure::text as function_signature, p.prosecdef as security_definer,
       p.proconfig as function_settings, p.proacl as explicit_acl,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in
 ('is_staff', 'my_lease_ids', 'my_room_ids', 'in_my_lease_period',
  'accept_invite', 'set_primary_tenant', 'remove_lease_tenant')
order by 1;

rollback;
