import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nativeRequire = createRequire(import.meta.url);

function loadTs(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : nativeRequire(name), loaded, loaded.exports);
  return loaded.exports;
}

function makeAdmin({ used = false, revoked = false, profile = null, accept = true } = {}) {
  const calls = { insertedProfiles: [], audits: [], rpc: [] };
  const admin = {
    auth: { admin: {
      createUser: async ({ email }) => ({ data: { user: { id: 'tenant-auth-id', email } }, error: null }),
      listUsers: async () => ({ data: { users: [] }, error: null }),
    } },
    from(table) {
      let op = 'select';
      let values;
      const filters = {};
      const query = {
        select() { return query; },
        eq(key, value) { filters[key] = value; return query; },
        insert(value) { op = 'insert'; values = value; return query; },
        update(value) { op = 'update'; values = value; return query; },
        async maybeSingle() {
          if (table === 'room_invitations') return { data: { id: 'invite-1', expires_at: new Date(Date.now() + 60_000).toISOString(), used_at: used ? new Date().toISOString() : null, revoked_at: revoked ? new Date().toISOString() : null }, error: null };
          if (table === 'profiles' && filters.line_user_id === 'U-TENANT') return { data: profile, error: null };
          if (table === 'profiles' && filters.id === 'tenant-auth-id') return { data: null, error: null };
          if (table === 'leases') return { data: { status: 'active' }, error: null };
          if (table === 'rooms') return { data: { room_no: '101' }, error: null };
          throw new Error(`unexpected maybeSingle ${table} ${JSON.stringify(filters)}`);
        },
        then(resolve, reject) {
          if (table === 'profiles' && op === 'insert') calls.insertedProfiles.push(values);
          if (table === 'audit_logs' && op === 'insert') calls.audits.push(values);
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args });
      if (!accept) return { data: [{ ok: false, code: 'already_used' }], error: null };
      return { data: [{ ok: true, code: 'ok', out_lease_id: 'lease-1', out_room_id: 'room-1' }], error: null };
    },
  };
  return { admin, calls };
}

function loadInviteService() {
  const phase1 = loadTs('../lib/phase1.ts', { 'server-only': {} });
  return loadTs('../lib/line-invites.ts', {
    'server-only': {},
    '@/lib/supabase/admin': { createAdminClient: () => ({}) },
    '@/lib/phase1': phase1,
  });
}

test('invite code is easy to type, normalized, and rejects malformed input', () => {
  const { generateInviteCode, normalizeInviteCode } = loadTs('../lib/phase1.ts', { 'server-only': {} });
  const code = generateInviteCode();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/);
  assert.equal(normalizeInviteCode(` ${code.slice(0, 6)}-${code.slice(6).toLowerCase()} `), code);
  assert.equal(normalizeInviteCode('O0-123'), null);
});

test('valid bot code creates the LINE profile, consumes the invite atomically, and audits the binding', async () => {
  const { acceptInviteCodeFromLine } = loadInviteService();
  const { admin, calls } = makeAdmin();
  const result = await acceptInviteCodeFromLine(admin, { code: 'abcdefgh2345', lineUserId: 'U-TENANT', lineName: 'LINE Tenant' });
  assert.deepEqual(result, { ok: true, displayName: 'LINE Tenant', roomNo: '101' });
  assert.equal(calls.insertedProfiles.length, 1);
  assert.equal(calls.insertedProfiles[0].line_user_id, 'U-TENANT');
  assert.equal(calls.insertedProfiles[0].role, 'tenant');
  assert.equal(calls.rpc[0].name, 'accept_invite_code');
  assert.equal(calls.rpc[0].args.p_user_id, 'tenant-auth-id');
  assert.equal(calls.rpc[0].args.p_phone, null);
  assert.equal(calls.audits[0].action, 'invite.accept.line_bot');
});

test('used code cannot bind a different LINE account, and linked profile role/phone are preserved', async () => {
  const { acceptInviteCodeFromLine } = loadInviteService();
  const other = makeAdmin({ used: true });
  assert.deepEqual(await acceptInviteCodeFromLine(other.admin, { code: 'ABCDEFGH2345', lineUserId: 'U-TENANT', lineName: 'Tenant' }), { ok: false, code: 'already_used' });
  assert.equal(other.calls.rpc.length, 0);
  assert.equal(other.calls.insertedProfiles.length, 0);

  const linked = makeAdmin({ profile: { id: 'tenant-existing', line_user_id: 'U-TENANT', display_name: 'Saved Name', phone: '0800000000', role: 'admin' } });
  const result = await acceptInviteCodeFromLine(linked.admin, { code: 'ABCDEFGH2345', lineUserId: 'U-TENANT', lineName: 'New Name' });
  assert.equal(result.ok, true);
  assert.equal(linked.calls.rpc[0].args.p_user_id, 'tenant-existing');
  assert.equal(linked.calls.rpc[0].args.p_display_name, 'Saved Name');
  assert.equal(linked.calls.rpc[0].args.p_phone, '0800000000');
  assert.equal(linked.calls.insertedProfiles.length, 0);
});

test('webhook verifies the signature before processing, then replies to the sender of a private text', async () => {
  const accepted = [];
  const route = loadTs('../app/api/line/webhook/route.ts', {
    '@/lib/env': {
      isLineWebhookConfigured: () => true,
      isSupabaseAdminConfigured: () => true,
      getEnv: () => 'test-token',
      notConfiguredResponse: missing => Response.json({ missing }, { status: 503 }),
    },
    '@/lib/line': { verifyLineSignature: (_body, signature) => signature === 'valid' },
    '@/lib/line-invites': { acceptInviteCodeFromLine: async (_admin, input) => {
      accepted.push(input);
      return { ok: true, displayName: input.lineName, roomNo: '101' };
    } },
    '@/lib/supabase/admin': { createAdminClient: () => ({}) },
  });
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: options?.body });
    return String(url).includes('/profile/')
      ? Response.json({ displayName: 'LINE Tenant' })
      : new Response(null, { status: 200 });
  };
  try {
    const denied = await route.POST(new Request('https://local/api/line/webhook', {
      method: 'POST', headers: { 'x-line-signature': 'bad' }, body: JSON.stringify({ events: [] }),
    }));
    assert.equal(denied.status, 401);
    assert.equal(accepted.length, 0);

    const response = await route.POST(new Request('https://local/api/line/webhook', {
      method: 'POST', headers: { 'x-line-signature': 'valid' },
      body: JSON.stringify({ events: [{ type: 'message', replyToken: 'reply-1', source: { type: 'user', userId: 'U-TENANT' }, message: { type: 'text', text: 'abcdefgh2345' } }] }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(accepted, [{ code: 'abcdefgh2345', lineUserId: 'U-TENANT', lineName: 'LINE Tenant' }]);
    assert.match(calls[1].body, /ยืนยันตัวตนและผูกบัญชีสำเร็จ/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
