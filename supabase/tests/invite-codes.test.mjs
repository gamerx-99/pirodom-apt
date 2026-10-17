import assert from "node:assert/strict";
import { createTestDb } from "./harness.mjs";

const db = await createTestDb();
const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000b1";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
const ROOM = "10000000-0000-0000-0000-0000000000a1";
const LEASE = "20000000-0000-0000-0000-0000000000a1";

await db.exec(`
  insert into auth.users (id) values ('${A}'), ('${B}'), ('${ADMIN}');
  insert into public.profiles (id, role) values ('${A}', 'tenant'), ('${B}', 'tenant'), ('${ADMIN}', 'admin');
  insert into public.rooms (id, room_no, unit_type) values ('${ROOM}', 'IC-101', 'residential');
  insert into public.leases (id, room_id, start_date, rent_amount, due_day) values ('${LEASE}', '${ROOM}', '2026-01-01', 1000, 31);
  insert into public.lease_tenants (lease_id, profile_id, is_primary) values ('${LEASE}', '${A}', true);
  insert into public.room_invitations (lease_id, token_hash, expires_at) values
    ('${LEASE}', 'code-first', now() + interval '7 days'),
    ('${LEASE}', 'code-existing-member', now() + interval '7 days'),
    ('${LEASE}', 'code-rollback', now() + interval '7 days'),
    ('${LEASE}', 'code-expired', now() - interval '1 second'),
    ('${LEASE}', 'code-revoked', now() + interval '7 days');
  update public.room_invitations set revoked_at = now() where token_hash = 'code-revoked';
`);

const accept = async (hash, uid) => db.query(
  "select * from public.accept_invite_code($1, $2, $3, $4)",
  [hash, uid, "LINE Tenant", null],
);

let result = (await accept("code-first", B)).rows[0];
assert.equal(result.ok, true);
assert.equal(result.out_lease_id, LEASE);
assert.equal((await db.query("select used_by from public.room_invitations where token_hash = 'code-first'")).rows[0].used_by, B);
assert.equal((await db.query("select is_primary from public.lease_tenants where lease_id = $1 and profile_id = $2", [LEASE, B])).rows[0].is_primary, false);

// LINE redelivery is idempotent only for the profile that consumed the code.
result = (await accept("code-first", B)).rows[0];
assert.equal(result.ok, true);
result = (await accept("code-first", A)).rows[0];
assert.equal(result.ok, false);
assert.equal(result.code, "already_used");

// A member who already belongs to this lease still consumes a newly issued code.
result = (await accept("code-existing-member", A)).rows[0];
assert.equal(result.ok, true);
assert.equal((await db.query("select used_by from public.room_invitations where token_hash = 'code-existing-member'")).rows[0].used_by, A);

for (const [hash, expected] of [["code-expired", "expired"], ["code-revoked", "revoked"], ["missing", "invalid_code"]]) {
  result = (await accept(hash, B)).rows[0];
  assert.equal(result.ok, false);
  assert.equal(result.code, expected);
}

await assert.rejects(accept("code-rollback", "00000000-0000-0000-0000-0000000000ff"));
assert.equal((await db.query("select used_at from public.room_invitations where token_hash = 'code-rollback'")).rows[0].used_at, null);

const grants = (await db.query(`
  select has_function_privilege('anon', 'public.accept_invite_code(text,uuid,text,text)', 'execute') as anon_exec,
         has_function_privilege('authenticated', 'public.accept_invite_code(text,uuid,text,text)', 'execute') as auth_exec,
         has_function_privilege('service_role', 'public.accept_invite_code(text,uuid,text,text)', 'execute') as service_exec
`)).rows[0];
assert.deepEqual(grants, { anon_exec: false, auth_exec: false, service_exec: true });

console.log("invite-codes.test: all passed");
