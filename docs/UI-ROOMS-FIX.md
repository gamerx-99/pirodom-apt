# Readability, responsive layouts and room management

Prepared 2026-10-17 in the existing working tree, based on `d5e1cac`. Status: **implemented and locally verified; not deployed**.

## Changes

- Removed OS dark-mode foreground switching from the light application. Root background/text, form controls and placeholders now have explicit light-theme colors. Secondary gray text is darker. Body and page wrappers fill at least the viewport height.
- Admin navigation becomes a horizontally scrollable top menu below the desktop breakpoint; desktop sidebar uses a consistent width. Main content has consistent responsive spacing and a maximum width. Tenant pages and bottom navigation share a wider 768px container; bottom navigation accounts for device safe areas.
- Room forms use one/two/five columns depending on available width. Room cards use one/two/three columns, allowing space for editing controls.
- Added room editing for room number, unit type, floor and status. Updates keep the room UUID and existing relationships intact, check owner/admin server-side, validate input, handle duplicate numbers and record an audit entry.
- Added deletion for unused rooms with explicit typed room-number confirmation, checked again on the server. PostgreSQL foreign keys prevent deleting rooms referenced by a lease (including ended leases), a meter reading or a maintenance request. No cascading history deletion is introduced. A concurrent rename prevents deletion with stale confirmation. Errors are displayed inline.
- Added shared room input validation and integrated room regression tests into `npm test`.

No cloud data was edited/deleted, no schema migration added/applied, and no commit/push/deployment performed. Existing unrelated working-tree changes were preserved.

## Verification

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run build`: exit 0; all 24 pages generated.
- `npm test`: exit 0; existing RLS/path-a/path-b suites passed, plus two room tests containing validation, owner editing/deletion, duplicate room-number rejection, tenant denial, retained lease references and FK protection for all three history types.
- `git diff --check`: passed.
- Calculated text/background contrast: body 17.16:1, input text 17.74:1, secondary text on white 4.76:1, secondary text on page background 4.55:1.
- React review: authorization remains server-side; client props contain only room fields; hooks run unconditionally; native details/labels, pending states and status/alert feedback are present.

**Limits:** PGlite verifies database behavior locally; this is not an authenticated HTTP test of the new Server Actions. Browser runtime exposes only MCP Apps and cannot navigate the app, so no browser screenshots or real device layout verification were completed. No mobile automation test was authored.

## Release and acceptance

Target for a separately approved release: `maehongson/pirodom-apt`, project `prj_2KregU8SsA4YPVFOBYvT7advLaJN`. This needs a deployment of the changed source, not a redeploy of the old cloud source. Keep existing Production env and database unchanged.

After release, use the existing owner LINE session to verify a readable invitation form under OS dark mode, tenant/mobile and desktop widths, editing a room and seeing the new values after reload, deleting a disposable unused room, and rejection of deletion for a room with history. Do not delete existing user data as an automated acceptance step.

Full Phase 1 closure is still separate from these fixes.
