# Phase 0 — Supabase live verification

## Current result: six migrations applied; live database RLS checks passed

2026-10-17. Explicit authorization: user said "ลง migration บน Supabase และตรวจ RLS เลยคับ". Target: `jxvlexoqwqynctlpgafi`.

### Application and catalog evidence

- Rechecked remote migration list before application: all six versions pending.
- Rechecked file hashes. Storage migration had changed since preflight: active-lease check for document Storage reads, and maintenance request/path checks. Reviewed its diff and reran `npm run test:all`; all three local suites passed with exit 0.
- Executed `supabase db push --linked --project-ref jxvlexoqwqynctlpgafi --skip-vault --yes`: exit 0, all six files applied. No seeds, custom roles, vault changes, or deployment included.
- Live SQL after application: **6 applied migration entries; 16 public tables; all 16 have RLS enabled; 10 Storage object policies**.
- `storage.objects` RLS enabled. API/SDK returned the four buckets `slips`, `meters`, `maintenance`, `documents`, each `public=false`.
- Actual REST anon reads of `profiles`, `rooms`, `invoices`, `documents`, `maintenance_photos`: no error and zero rows. These empty-database HTTP reads are smoke checks; they do not alone prove row isolation.
- REST anon calls to `accept_invite` and `set_primary_tenant`: denied with `42501`.
- SQL privileges for `accept_invite`, `set_primary_tenant`, `remove_lease_tenant`: anon=false, authenticated=false, service_role=true.

Applied Storage migration SHA256: `8A55159D9B13C29CD2A20220D9388189E91DB80F671365553F16EF916066A9C3`. Other five hashes match the earlier preflight table below. That table preserves the older Storage hash for history only.

### Live behavioral RLS verification

Runnable test: `supabase/tests/live-rls.sql`.

```powershell
supabase db query --linked --project-ref jxvlexoqwqynctlpgafi --file supabase/tests/live-rls.sql --output-format json
```

The final, single-DO version exited 0 after **30 assertions** on real PostgreSQL, using actual Supabase `auth.uid()`, role switching and JWT claim settings. Its inner subtransaction deliberately raises/catches a private SQLSTATE to roll back every fixture on success; other exceptions fail the run and roll back as well. It checks:

- Tenant A sees own room/invoice/document/Storage metadata and cannot see tenant B's rows.
- Tenant B cannot see tenant A's invoice/document.
- A former tenant cannot see the current room or old/current documents and their Storage metadata.
- Staff can read both fixture rooms and all three fixture documents/Storage objects.
- Anon cannot see fixture rooms/invoices/Storage objects.
- Tenant cannot alter invoice total, promote own profile role, set payment verification status, or invoke restricted invitation RPC.
- All three privileged RPCs have the intended execute grants.

Post-test SQL verified fixture rooms=0, fixture documents=0, fixture Storage objects=0. No persistent test accounts/records/files were provisioned. No object bytes were uploaded.

Two parallel CLI SQL runs failed temporary-role password authentication; sequential retries succeeded. Run future CLI database checks sequentially to avoid possible temporary-login credential races. No password/config change was needed.

### Advisor findings and limits

Security advisor completed: **8 WARN findings**, covering the four helpers `is_staff`, `my_lease_ids`, `my_room_ids`, `in_my_lease_period`, each executable as `SECURITY DEFINER` by anon and authenticated. No ERROR findings returned. The helper definitions bind authorization to `auth.uid()` and use an empty search_path; authenticated policies depend on them. Findings are recorded, not treated as a clean security report or silently revoked.

Remediation references: [anon helper execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated helper execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

**Completed:** cloud schema application, RLS flags, private buckets, selected grants and live SQL allow/deny behavior. **Remaining:** advisor hardening decision; real LINE/LIFF login and invite-to-dashboard flow; real authenticated HTTP requests, Storage upload/signed URL behavior and wider operation coverage. SQL role simulation is real database evidence, not proof of a working LINE login. Phase 0/1 overall exit remains incomplete.

All sections below are earlier snapshots and are superseded by this current result where they conflict.

## Latest: CLI linked; empty application schema confirmed by SQL

2026-10-17, after the user completed `supabase login`:

- `supabase link --project-ref jxvlexoqwqynctlpgafi` succeeded. The local Git-ignored `supabase/.temp/project-ref` matches the configured API target. Supabase config was not changed.
- Live SQL: `to_regclass('supabase_migrations.schema_migrations')` and `to_regclass('public.profiles')` both returned NULL.
- A separate combined SQL catalog query returned `public_tables: []`, `buckets: []`, `policies: []` (policies limited to public/storage). This confirms the application schema is absent, rather than relying on API cache evidence.
- `supabase migration list --linked --project-ref jxvlexoqwqynctlpgafi` succeeded: six local versions, every remote version empty.
- `supabase db push --linked --project-ref jxvlexoqwqynctlpgafi --dry-run --skip-vault` succeeded and listed the six files below; no migrations/seeds/roles were applied.
- `npm run test:all` exited 0: `rls.test`, `path-a.test`, and `path-b.test` all passed on PGlite. These are local results, not live RLS tests.

Pending cloud application scope: 16 application tables with RLS, four private buckets with Storage policies, helper/invitation RPCs and their grants, indexes and constraints. No customer seed data, role seed, vault update, or deployment is included. Expected command after explicit approval:

```powershell
supabase db push --linked --project-ref jxvlexoqwqynctlpgafi --skip-vault
```

| Pending file | SHA256 at validation |
|---|---|
| `20261016000000_init.sql` | `8729E8B083D45D4BAAFE9696FBF05EE37B24904C133FDDC25AAA820865BEBFFA` |
| `20261017000000_storage_rls.sql` | `3EA6BA4536AC2F03BD2A5CDB03A2C0D4F1688083E22C83BCB5FBED2D678E66A1` |
| `20261017000001_phase1.sql` | `5CB002253312E5E79BAD29F6620FB0F2519166C1F5B2A422B253D959F2477193` |
| `20261017000002_accept_invite.sql` | `C447918E9C1D3F4BE01596A3438F85A39CDE84606FF40EC5B8B9F874EB57362F` |
| `20261018000000_phase2a_phase4b_meters_maintenance.sql` | `82373A76434164964469AAA5C69B30AACE67AB47C7C75064D48E74B8DD1FC725` |
| `20261018000001_phase4a_documents.sql` | `AB50A0F41DF9EDCAC3A612EEF6076CBA0272A6D8F8C3AF659910C8518B1010A5` |

Recheck hashes and remote ledger before application if files or target change. Cloud DDL requires separate explicit approval under `Z:\knowledge\AGENTS.md` section 3.2. This latest result supersedes earlier management-access blockers for the CLI; MCP access has not been retested after CLI login. Phase 0 remains incomplete until cloud migrations and live authorization behavior are verified.

## Latest repair attempt: management account lacks target access

2026-10-17, after the user requested fixing the connection/schema blocker:

- Installed Supabase CLI v2.118.0 is available. Its logged-in account lists two projects, neither `jxvlexoqwqynctlpgafi`; this is a different project set from MCP.
- `.env.local` contains the URL/anon/service-role variables, but no PostgreSQL connection URL or Supabase management access token variable.
- Read-only CLI SQL attempt could not connect (`DbConfigIpv6Error`, recommending link for IPv4 setup).
- Following that recommendation, `supabase link --project-ref jxvlexoqwqynctlpgafi` failed with `LinkProjectStatusError`: `Your account does not have the necessary privileges to access this endpoint`.

**Confirmed repair blocker:** the current CLI and MCP identities do not have management access to the configured target. Working application API keys do not fix this access failure. Do not change the target to a different project from the available lists. No migrations have been run by this task.

**Required user action:** sign the CLI into the Supabase account that owns/can manage `jxvlexoqwqynctlpgafi` (`supabase login`), or have that project's organization owner grant the current account appropriate access. MCP authentication is separate if that route is used. Keep credentials out of chat. After access is fixed, retry linking, read the actual ledger/catalog, and prepare the exact pending migration set for approval before any cloud schema write.

## Latest: connection verified after user requested checking `.env.local`

2026-10-17: The user explicitly requested checking `.env.local` and connecting to its project. Read-only connection checks were therefore authorized for the configured target `jxvlexoqwqynctlpgafi`. Loaded configuration through the project's installed `@next/env`, and tested with its installed `@supabase/supabase-js`.

- URL, anon key and server service-role key are populated. No env changes were needed.
- Public-key request to `/auth/v1/settings`: HTTP 200.
- Server-key request to `/rest/v1/`: HTTP 200, no table or RPC paths returned.
- Server SDK `storage.listBuckets()`: success, empty bucket list.
- `.env.local` is Git-ignored and untracked. No service-role JWT or `sb_secret_` key was detected in loaded `NEXT_PUBLIC_*` variables. Key values were not printed.
- MCP `get_project` and `list_migrations` were retried for this exact target: both still permission denied. API credentials do not establish management/MCP access.

**Current status:** application configuration can connect to the configured Supabase API; migrations/RLS remain unverified and Phase 0 stays blocked. Test/production classification is still unconfirmed. No cloud changes were made. Six local migration files now exist, including the two `20261018...` files added since the earlier audit; these have not been applied or verified by this connection check.

The sections below preserve the earlier observations and user clarification; this latest result supersedes the connection/setup blocker for the configured API target.

Checked: 2026-10-17, approximately 11:01 Asia/Bangkok. Source HEAD: `71082f0`; existing working-tree changes were preserved. Verdict: **BLOCKED — live migration/RLS exit criterion remains unchecked.**

## User clarification after audit

The user confirmed: "ยังไม่เคยเชื่อมต่อกับ Supabase" (this project has never been connected to Supabase). Therefore `jxvlexoqwqynctlpgafi`, found in local configuration, is **not a confirmed project/test target**. The API observations below describe that configured URL only and must not be presented as the migration status of this project's database. The current blocker is initial Supabase project selection/setup and connection, followed by migration and real RLS verification. Do not reuse the configured URL or credentials for further access until the intended target is confirmed.

## Target and access

- Project ref from `.env.local`: `jxvlexoqwqynctlpgafi`. Test versus production classification is not yet confirmed.
- Supabase MCP `list_projects` returned three other projects; this target was absent.
- `get_project` and `list_migrations` for this exact ref both returned `You do not have permission to perform this action`.
- Existing local credentials were used in memory for read-only REST/Storage requests. No key values or customer rows were printed or saved. No cloud writes, migration application, auth-user creation, or storage uploads were performed.

## Live evidence

| Check | Actual result | Implication |
|---|---|---|
| `GET /rest/v1/` with configured service-role credentials | HTTP 200; none of the 15 expected table paths; no RPC paths | Target is reachable; expected schema is not visible through this API |
| `GET /rest/v1/<table>?select=id&limit=0` for every expected table | All 15 returned HTTP 404, `PGRST205`, `Could not find the table 'public.<table>' in the schema cache` | Expected tables cannot currently be queried through Data API |
| `GET /storage/v1/bucket` | HTTP 200, `[]` | No buckets were returned; expected private buckets are missing from this result |
| Remote migration ledger | MCP permission denied | Applied versions and migration contents remain unknown |
| Live RLS / column grants / function grants / Storage policies | Not verified | Do not interpret service-role API access as an RLS test |

Expected tables: `profiles`, `rooms`, `leases`, `lease_tenants`, `room_invitations`, `meter_readings`, `invoices`, `invoice_items`, `payments`, `payment_verifications`, `documents`, `maintenance_requests`, `maintenance_updates`, `notifications`, `audit_logs`.

Expected private buckets from init migration: `slips`, `meters`, `maintenance`, `documents`.

Local migration files at inspection:

1. `20261016000000_init.sql`
2. `20261017000000_storage_rls.sql`
3. `20261017000001_phase1.sql`
4. `20261017000002_accept_invite.sql`

**Limits:** PGRST205 is evidence about the API schema cache, not proof that a table is absent from PostgreSQL. No successful SQL catalog query or ledger query was possible in this run. This evidence cannot establish that zero migrations have been applied. The existing PGlite suite simulates Auth/Storage and does not close this live gate; it was not rerun for this read-only audit.

## Required next steps

1. Select or create the intended Supabase test project with the user, confirm ownership and project ref, and configure the connection through secret management. Do not assume the previously configured ref belongs to this project. Creating cloud resources or applying migrations requires explicit approval.
2. Run `supabase/verify-phase0.sql` against that target and retain the results. It contains only read-only queries for ledger, catalogs, policies, grants, buckets, and RPC privileges.
3. Compare applied migration versions and definitions with the four local files before deciding what to apply. Any cloud migration/write needs separate explicit approval under `Z:\knowledge\AGENTS.md` section 3.2.
4. Once schema is ready, verify real authenticated allow/deny behavior for anon, tenant A/B, former tenants, and staff, plus column/RPC restrictions and private Storage access. Any creation of cloud fixtures/users/files also needs explicit approval. Include real LINE-to-Supabase identity/session evidence for the full Phase 0 exit.

Reference: [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) explains why grants and policies must both be checked and why service-role access cannot prove tenant isolation.
