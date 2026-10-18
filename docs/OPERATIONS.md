# Environment, secrets, deployment, and recovery

This runbook documents the current release boundary and the safe path for future tests and incidents. It does not provision a test environment or change Vercel, Supabase, LINE, or SlipOK settings.

## Current environment status

| Environment | Application | Database / external services | Status |
| --- | --- | --- | --- |
| Local | Next.js local development | `.env.local` (ignored by Git) | Available when the operator supplies the correct project credentials locally |
| Preview / test | Vercel Preview | A dedicated non-production Supabase project, LINE test channel/account, and non-payment SlipOK test path | Not verified or provisioned; do not assume Preview is isolated from Production |
| Production | Vercel project `pirodom-apt`, production alias `https://pirodom-apt.vercel.app` | Live Supabase project, LINE Messaging API, SlipOK, PromptPay | Active; latest verified deployment is `1fa2f1c` (`READY`) |

Before running a test that writes data or sends a LINE message, confirm the deployment target, database project, LINE recipient, and whether the action is a real external send. Do not use a live payment or tenant record as a test fixture. Supabase recommends separate staging and production projects for migration validation; see [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments) and [Deployment & Branching](https://supabase.com/docs/guides/deployment).

## Secrets and environment variables

- Use `.env.example` as the variable-name checklist. Keep real values only in the approved local environment file or the provider's environment-variable store; never commit them or paste them into chat, logs, issue descriptions, or screenshots.
- Variables prefixed `NEXT_PUBLIC_` are delivered to browser code. Only public identifiers and public client keys belong there. Never put a service-role key, LINE channel secret/access token, or SlipOK API key in a `NEXT_PUBLIC_` variable.
- In Vercel, keep `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, and `SLIPOK_API_KEY` in Secret storage. Limit each variable to the environment that needs it. The production values were refreshed as recorded in [PRODUCTION-ENV-REFRESH.md](PRODUCTION-ENV-REFRESH.md); do not copy them into Preview.
- Local development, Preview, and Production must point to separate Supabase projects before Preview is used for authenticated or write-path UAT. Do not connect Preview to the live tenant database as a shortcut.
- Use separate LINE test credentials and a test recipient for Preview. Keep PromptPay and SlipOK production payment settings out of Preview. If no safe provider sandbox is available, mark payment-provider UAT as blocked instead of making a real payment.
- After a secret is exposed, rotate it at the owning provider, update only the intended environment, redeploy that environment, and run a non-sensitive health check. Never record the secret value in this runbook.

## Release checks

Before a code release:

1. Confirm the repository, branch, commit, and clean tracked diff. Preserve any intentional untracked user assets.
2. Run the project checks requested for the change: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` when code has changed.
3. If database changes are involved, confirm the target project reference from an authoritative dashboard, inspect the applied migration ledger with `supabase migration list --linked`, and review the exact migration before applying it. Never infer a target from a leftover local `.env` file.
4. Verify the Vercel deployment is `READY` and its source commit matches the intended release. Check deployment/build logs for failed routes or functions.
5. Run read-only smoke checks first. For authentication, verify expected unauthenticated behavior; do not claim successful LINE login, tenant isolation, payment, or Storage UAT from a public HTTP status alone.
6. Record the deployment identifier, commit, smoke-check result, and any UAT still outstanding in `docs/TODO.md`.

Production migrations are separate from application deployments. A Vercel rollback does not undo a Supabase migration or restore database rows. Prefer backward-compatible migrations and a reviewed forward-fix plan. Take and verify an appropriate database backup before any risky production data/schema change.

## Monitor and respond to an incident

1. Capture the incident time, affected route, deployment ID/commit, and sanitized error details. Do not include access tokens, cookies, tenant identifiers, uploaded slips, or payment details in reports.
2. Check the Vercel deployment/build and runtime logs for the affected deployment. For database/auth/Storage errors, inspect the matching Supabase logs and migration ledger. For LINE/SlipOK failures, record only the HTTP status, provider request ID when safe, and the application event/payment ID needed by an authorized operator.
3. Determine whether the issue is limited to the new code or involves data/schema changes. Preserve payment, invite, audit, and notification records; do not delete or replay financial actions to make a dashboard look healthy.
4. If the previous production deployment is known good and compatible with the current database schema, the project owner may roll back to that deployment using the Vercel deployment controls or `vercel rollback <known-good-deployment>`. Confirm the exact deployment and production project immediately before the action.
5. Verify the production alias, health/auth response, and affected read-only route after recovery. Review logs again for new failures.
6. Vercel rollback changes the production deployment only. It does not revert database migrations or environment-variable changes. Vercel documents that instant rollback disables production-domain auto-assignment; after a reviewed fix, explicitly promote the intended deployment to restore normal auto-assignment. See [Rollback a Production Deployment](https://vercel.com/docs/deployments/rollback-production-deployment) and [Vercel rollback](https://vercel.com/docs/cli/rollback).

Do not rehearse rollback against Production. A rehearsal is still outstanding and should use a dedicated Preview/Staging app and database after those resources exist and the project owner approves the exact test deployment. Verify both recovery and restoration of normal deployment flow.

## Remaining operational work

- Provision and verify an isolated Preview/Staging Supabase project and separate Vercel/LINE test configuration.
- Exercise the runbook using a disposable staging deployment; record the rollback and restore evidence.
- Complete authenticated LINE, file-access, payment, and tenant UAT separately. This runbook does not count as that evidence.
