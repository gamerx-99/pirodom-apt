import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);

function loadRoute(mocks) {
  const code = ts.transpileModule(
    readFileSync(new URL("../app/api/admin/maintenance-notifications/route.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => (name in mocks ? mocks[name] : nativeRequire(name)),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

function fixture({ user = { id: "admin-1" }, role = "admin", profileError = null, queryError = null } = {}) {
  const observed = { table: null, filters: [], order: null, limit: null, select: null };
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      observed.table = table;
      const query = {
        select(columns, options) { observed.select = { columns, options }; return query; },
        eq(column, value) { observed.filters.push([column, value]); return query; },
        order(column, options) { observed.order = { column, options }; return query; },
        limit(value) { observed.limit = value; return query; },
        maybeSingle: async () => ({ data: role ? { role } : null, error: profileError }),
        then(resolve, reject) {
          return Promise.resolve({
            data: queryError ? null : [
              { id: "request-1", category: "ไฟฟ้า", rooms: { room_no: "101" } },
            ],
            count: 4,
            error: queryError,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { route: loadRoute({ "@/lib/supabase/server": { createClient: async () => client } }), observed };
}

test("maintenance alert requires an authenticated admin or owner", async () => {
  const signedOut = fixture({ user: null });
  const signedOutResponse = await signedOut.route.GET();
  assert.equal(signedOutResponse.status, 401);
  assert.equal(signedOutResponse.headers.get("cache-control"), "private, no-store");

  const tenant = fixture({ role: "tenant" });
  assert.equal((await tenant.route.GET()).status, 403);
  assert.equal(tenant.observed.table, "profiles");
});

test("maintenance alert only reports pending requests and limits preview rows", async () => {
  const { route, observed } = fixture({ role: "owner" });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    count: 4,
    items: [{ id: "request-1", category: "ไฟฟ้า", room: "101" }],
  });
  assert.equal(observed.table, "maintenance_requests");
  assert.deepEqual(observed.select, {
    columns: "id,category,rooms(room_no)",
    options: { count: "exact" },
  });
  assert.deepEqual(observed.filters, [["id", "admin-1"], ["status", "pending"]]);
  assert.deepEqual(observed.order, { column: "created_at", options: { ascending: false } });
  assert.equal(observed.limit, 3);
});

test("maintenance alert returns a generic error when profile or queue reads fail", async () => {
  const profileFailure = fixture({ profileError: new Error("private profile details") });
  const profileResponse = await profileFailure.route.GET();
  assert.equal(profileResponse.status, 500);
  assert.deepEqual(await profileResponse.json(), { error: "ตรวจสิทธิ์ไม่สำเร็จ" });

  const queueFailure = fixture({ queryError: new Error("private database details") });
  const queueResponse = await queueFailure.route.GET();
  assert.equal(queueResponse.status, 500);
  assert.deepEqual(await queueResponse.json(), { error: "โหลดแจ้งเตือนงานซ่อมไม่สำเร็จ" });
});
