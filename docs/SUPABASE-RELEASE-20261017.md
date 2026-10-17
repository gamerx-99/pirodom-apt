# Supabase Cloud migration release evidence — 17 October 2026

Project: `jxvlexoqwqynctlpgafi` (`dormitory-line`). The user approved applying the seven outstanding migrations and confirmed that LINE Login/LIFF and Messaging API channels are under one LINE Developers Provider.

## Apply command and result

The invite-code migration version `20261017132926` sorts before `20261018000000` and `20261018000001`, which were already present in Cloud history. A plain `supabase db push --linked --dry-run` refused the out-of-order migration and recommended `--include-all`.

Command run:

```text
supabase db push --linked --include-all --skip-vault --yes
```

Result: exit code 0; the CLI reported these migrations applied:

```text
20261017132926_accept_invite_code_once.sql
20261018000002_tighten_storage_policies.sql
20261018000003_billing_snapshots.sql
20261018000004_payment_workflow.sql
20261018000005_payments_server_only.sql
20261018000006_payment_logs_and_recovery.sql
20261018000007_line_payment_result.sql
```

`--skip-vault` prevented the CLI from changing Vault secrets during schema deployment.

## Post-apply verification

`supabase migration list --linked` returned matching local and remote versions for all 13 migrations in this project:

```text
20261016000000  20261016000000
20261017000000  20261017000000
20261017000001  20261017000001
20261017000002  20261017000002
20261017132926  20261017132926
20261018000000  20261018000000
20261018000001  20261018000001
20261018000002  20261018000002
20261018000003  20261018000003
20261018000004  20261018000004
20261018000005  20261018000005
20261018000006  20261018000006
20261018000007  20261018000007
```

Read-only smoke query:

```sql
select
  to_regprocedure('public.accept_invite_code(text,uuid,text,text)') is not null as invite_rpc,
  to_regprocedure('public.reject_invoice_payment(uuid,text)') is not null as reject_rpc,
  to_regprocedure('public.finalize_invoice_payment_verification(uuid,uuid)') is not null as recovery_rpc,
  exists(select 1 from pg_trigger where tgname = 'invoices_guard_snapshot' and not tgisinternal) as invoice_guard,
  exists(select 1 from pg_trigger where tgname = 'payments_log_upload' and not tgisinternal) as payment_log_trigger;
```

Result:

```text
invite_rpc=true
reject_rpc=true
recovery_rpc=true
invoice_guard=true
payment_log_trigger=true
```

Supabase advisors were checked before apply. The captured output contains existing warnings (including SECURITY DEFINER exposure and RLS/performance advisories), but was truncated, so this record does not claim a complete error-level summary. A later error-only advisor call did not return before it was stopped. These advisor warnings were not changed by this migration release.

## Release boundary

This evidence proves schema application and the listed catalog objects only. It does not prove a real LINE Bot invitation, LIFF session, payment-provider transaction, or tenant end-to-end UAT. The application code had not yet been pushed/deployed when this record was written.
