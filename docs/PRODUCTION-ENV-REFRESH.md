# pirodom-apt Production env refresh — 2026-10-17

User explicitly requested replacing old env values and redeploying. Confirmed target with Vercel CLI: `maehongson/pirodom-apt`, project `prj_2KregU8SsA4YPVFOBYvT7advLaJN`, team `team_kALNj7LZswF1BM18OJwHg24n`.

- Authoritative supplied values came from `.env.local`. The pulled `.env.development.local` contained only a Vercel OIDC token, not application credentials.
- Replaced Production values for all ten application variables used by `lib/env.ts`. This added the previously missing `LINE_CHANNEL_SECRET`.
- Stored `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `SLIPOK_API_KEY`, `CRON_SECRET` as Secret. Public IDs/URLs, anon key and SlipOK branch ID are Config.
- Added `NEXT_PUBLIC_APP_URL=https://pirodom-apt.vercel.app`.
- Removed the Production target from the mistakenly uploaded `VERCEL_OIDC_TOKEN` app variable. Preview/Development settings were not changed.
- Values passed to CLI through stdin in memory, not command arguments or temporary secret files. No plaintext values recorded here.

Redeployed existing Production source `dpl_E3Nhh1Pkz5A8SLwt7yjFoSaBYjbr` with the new Production env. Local code/dirty files were not uploaded or edited. No Git commit/push or DB migration.

Result: `dpl_9bQbbms8GDDp3dB7cDa2P6WYMJnd`, Production, **Ready**. Unique URL `https://pirodom-ovcubq5ic-maehongson.vercel.app`; active alias `https://pirodom-apt.vercel.app`. CLI reported build Ready in 42 seconds; final inspect confirmed alias and status.

## Live checks

- Signed empty webhook request using supplied secret: HTTP 200, body `ok`.
- Unsigned webhook: HTTP 401.
- GET `/liff`: HTTP 200.
- Invalid LINE ID token sent to auth bridge: HTTP 401.
- Actual LINE Platform webhook test API with explicit endpoint: API HTTP 200, `success=true`, `statusCode=200`, `reason=OK`.
- Read-only LINE registered endpoint check: matches `https://pirodom-apt.vercel.app/api/line/webhook`; `active=true`.

Only empty webhook verification events were sent; no messages sent to users and no LINE webhook setting was changed. This validates deployed webhook configuration and signature agreement with the actual Messaging API channel. It does not prove real user LINE Login or the complete Phase 1 invite-to-dashboard flow.
