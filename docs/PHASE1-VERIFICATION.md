# Phase 1 verification — 2026-10-17

**Verdict: Phase 1 CLOSED / accepted on 2026-10-17.**

## Closure record: real tenant acceptance plus existing live database evidence

The user requested closure and push after reporting this actual acceptance path:

1. Generated an invitation from the deployed application's `/admin/leases` page.
2. A friend opened the invitation using the friend's own LINE account, separate from the owner's account (user explicitly confirmed this).
3. The user supplied the resulting room/lease information: room 101, active lease starting 2026-10-17, due day 31/end of month, rent 1,500/month, water 0, electricity 7/unit, deposit 1,500, and one primary tenant. Personal name, phone number and invitation identifier are intentionally omitted from this public record.
4. The invitation list displayed “ใช้แล้ว” (used).

This is **user-reported real-account acceptance evidence**, not a browser session independently observed by Codex. “Used” alone is not proof that a second attempt was rejected.

| Phase 1 exit criterion | Evidence accepted for closure |
| --- | --- |
| Create room/lease, invite an actual tenant, and show correct data | User-reported deployed flow above, using a different real LINE account |
| Expired and reused invitations rejected | Previously executed real Supabase `supabase/tests/live-phase1.sql`: expired/revoked/unknown rejection, another user's reuse rejected, same-user retry idempotent without duplicate membership; all fixtures rolled back |
| Isolation across rooms and lease periods | Previously executed real Supabase `supabase/tests/live-rls.sql`: tenant A/B and former-tenant allow/deny checks, 30 assertions, fixtures rolled back; see [Phase 0 audit](SUPABASE-PHASE0-AUDIT.md) |
| Owner/admin entry | Earlier user screenshot of the real owner admin screen; tenant account for this invitation was different |

Closure combines the user-reported live application flow with recorded real PostgreSQL negative-case/RLS checks. No new live tests or database writes were performed to produce this closure record. Local test/typecheck/lint/build and independent Claude review passed for code commit `479686c` before its push.

**Evidence limits / follow-up, not represented as completed:** negative cases have not been replayed through an independently observed authenticated browser/HTTP session; simultaneous invitation acceptance is not independently verified; new room edit/delete UI still needs browser/device acceptance. These remain recorded verification limits, not new customer steps. Phase 1 acceptance does not close Phase 0, later-phase UAT, pending storage migration or full production security review.

The previous OPEN verdict and requests below are retained as historical observations. The closure record above supersedes the missing real-login/invitation evidence and the earlier requirement to collect every negative case again through a browser before recording acceptance.

## Historical verification record (before user acceptance)

## Update: authorized Preview deployment is READY

2026-10-17: user approved deploying the test version and configuring required env. Existing target confirmed by CLI: `maehongson/dormitory-line`, project `prj_D7M08SKjVrvK4og8nz9y2QVAFuPL`, team `team_kALNj7LZswF1BM18OJwHg24n`.

- Deployed local source based on HEAD `a70c39c` plus working-tree changes; no Git commit/push performed.
- Successful deployment: `dpl_4mmd9ZVLsCwmn6kBoZpUeE2qr8na`, READY.
- URL: https://dormitory-line-pdf99kshg-maehongson.vercel.app
- Proposed LIFF Endpoint URL: https://dormitory-line-pdf99kshg-maehongson.vercel.app/liff
- Environment: Preview only; no production promotion. Configured `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_LIFF_ID`, `LINE_LOGIN_CHANNEL_ID` as Config; `SUPABASE_SERVICE_ROLE_KEY` as Secret. Values were passed through child-process stdin, never printed or supplied in CLI arguments. No other provider keys were uploaded.
- Local Vercel link created Git-ignored `.vercel/project.json`; CLI also refreshed local OIDC credentials in ignored `.env.local`. Existing app credentials remain available.
- Added `.vercelignore` to exclude env files and root docs/UI/SQL/test folders. First preview failed because an unanchored `supabase/` exclusion also removed `lib/supabase`; fixed it to `/supabase/` and rechecked dry-run: runtime files included, no excluded regular files in upload. Failed first deployment was `dpl_HVq8suFGVSEyJL15crCR4PTkdfjE`; second deployment succeeded.
- `createInvite` now uses explicit `NEXT_PUBLIC_APP_URL`, or `https://${VERCEL_URL}` on Vercel. This avoids relative invitation URLs when the app origin was not configured. ESLint for the edited action passed; remote build compiled, typechecked, generated all 24 pages, and deployed successfully.

### Preview HTTP verification

Preview has **Vercel Authentication** enabled. Unauthenticated public `/liff` returned 302 to protection. Protection was not disabled. Same-project local Vercel OIDC header enabled these checks (tokens never printed):

| Request | Result |
|---|---|
| GET `/liff` | 200, LIFF loading shell rendered |
| GET `/admin` without Supabase session | 200 streamed Next.js redirect to `/liff`, no demo marker; no admin-auth success claimed |
| GET `/api/health` without Supabase session | 401 unauthorized |
| POST `/api/invites/accept` with valid-shaped body but no Supabase session | 401 unauthorized |
| POST `/api/auth/line` without ID token | 400 missing_id_token |
| POST `/api/auth/line` with invalid ID token | 401 invalid_id_token |

The server service key was absent from the inspected `/admin` HTML. This is not a full bundle/security audit.

**Next user action:** update the actual LIFF app's Endpoint URL to the `/liff` URL above, then open it in a browser signed into the authorized Vercel account and complete real LINE login. Do not replace it with the Supabase `/callback` URL. This protected Preview is for authorized testing; ordinary tenant access requires a separately approved public deployment strategy. LINE Developers settings have not been changed by the agent. Real LINE login/invite/dashboard evidence is still missing, so Phase 1 remains OPEN.

Earlier findings below describe the state before this successful Preview and are superseded where applicable.

Scope: `docs/ROADMAP.md` Phase 1 requires creating rooms/leases, inviting a tenant through the actual application until their data is visible, rejecting expired/reused invitations, and preventing access across tenants and lease periods. SQL checks cannot replace real LINE/LIFF-to-dashboard evidence.

## Verified in this run

- Source HEAD `14b8b69`, with existing working-tree changes preserved. `npm run typecheck`, `npm run lint`, `npm run build` all exited 0. Production build generated all 24 pages successfully.
- Corrected only `LINE_LOGIN_CHANNEL_ID` in `.env.local` to the public ID explicitly supplied by the user (`2012057926`). Other lines were preserved; keys were not printed. It now matches the prefix of the configured LIFF ID. Matching IDs is a configuration check, not proof of login.
- Supabase `jxvlexoqwqynctlpgafi`: migration list confirms the six previously approved versions applied. New local `20261018000002_tighten_storage_policies.sql` is pending; it was not applied by this Phase 1 check.
- Executed `supabase/tests/live-phase1.sql` against real PostgreSQL, exit 0. Fixtures were isolated in a subtransaction and rolled back. Follow-up SQL counted zero `P1-` rooms and zero `Phase1 ` fixture profiles.
- Database scenarios passed: residential/commercial rooms; duplicate active lease rejected; accept invite maps room/lease correctly; first member becomes primary; invitation consumed; same-user retry idempotent without duplicate membership; another user cannot reuse; expired/revoked/unknown invitations rejected; ended lease rejected; co-tenant remains non-primary; primary cannot be removed before reassignment; reassignment/removal work; failure during acceptance does not consume invitation; existing admin role preserved; removed member loses lease access.
- Local HTTP checks using real Supabase configuration: unauthenticated `/admin` => 307 `/liff`; valid-shaped unauthenticated invite acceptance => 401 `unauthorized`; absent LINE ID token => 400 `missing_id_token`; invalid LINE ID token => 401 `invalid_id_token`. These checks do not include a successful real LINE token.

Runnable database check:

```powershell
supabase db query --linked --project-ref jxvlexoqwqynctlpgafi --file supabase/tests/live-phase1.sql --output-format json
```

## Historical end-to-end blockers

1. User supplied `https://jxvlexoqwqynctlpgafi.supabase.co/callback` as the possible LIFF Endpoint URL. Read-only request returned HTTP 404, JSON. This is not the frontend `/liff` endpoint. No LINE console setting was changed.
2. Vercel CLI verified project `dormitory-line`, team `maehongson` (`team_kALNj7LZswF1BM18OJwHg24n`), project ID `prj_D7M08SKjVrvK4og8nz9y2QVAFuPL`. Only listed deployment: `https://dormitory-line-7a5qa5whc-maehongson.vercel.app`, Production, Error. Build logs show source `71082f0` and uncached/runtime data outside Suspense on `/liff/bills/[id]`. Current local source has the route handling changes and builds successfully. It has not been redeployed by this task.
3. `NEXT_PUBLIC_APP_URL` is missing locally. `createInvite` currently falls back to a relative `/liff/join/<token>` URL. A real frontend origin must be configured before sending invitations externally.
4. The browser runtime exposes only MCP Apps, which cannot navigate to the local web app. No in-app/extension browser capable of testing LINE login was available. No standalone browser fallback, cookie extraction, synthetic LINE identity, or auth bypass was used.

Vercel connector could list the project but returned 403/404 for deployment/domain reads. CLI fallback using the exact same team/project succeeded in reading deployment/build logs; this is not a reason to assume another target.

## Historical completion checklist

- Deploy a testable HTTPS frontend with the required Supabase/LINE public ID configuration and server key kept server-side. Deployment/environment writes need explicit approval under `Z:\knowledge\AGENTS.md` section 3.2.
- Configure LINE LIFF Endpoint URL to that frontend's `/liff` URL and the app's `NEXT_PUBLIC_APP_URL` to its origin; verify redirect behavior with invite token preserved.
- Use an actual LINE test account to complete login, receive a Supabase session, accept a generated invitation, and see the correct room/lease/dashboard. Verify owner/admin access with an authorized account.
- Verify invitation errors and access isolation through real authenticated HTTP/browser requests. Actual simultaneous invite acceptance is not established by the sequential SQL test.

This was the checklist before the closure record above; remaining unobserved browser cases are explicitly listed in its evidence limits.
# ขอบเขตหลักฐานปัจจุบัน

วิธีเชิญแบบลิงก์ที่ตรวจในเอกสารนี้ถูกแทนด้วยรหัสยืนยันผ่าน LINE Bot ในวันที่ 17 ตุลาคม 2569 หลักฐานด้านล่างเป็นประวัติของ flow เดิมเท่านั้น และไม่ใช้ยืนยัน Phase 1 ปัจจุบันจนกว่าจะผ่าน UAT ของ code → Bot → LIFF ใหม่ โดย LINE Login/LIFF กับ Messaging API ต้องใช้ Provider เดียวกัน
