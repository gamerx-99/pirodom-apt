import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { createLeaseFolders, parseServiceAccount } from '../lib/google-drive.ts';

test('service account JSON is validated', () => {
  assert.equal(parseServiceAccount('not json'), null);
  assert.equal(parseServiceAccount('{"client_email":"a@b"}'), null);
  assert.deepEqual(parseServiceAccount('{"client_email":"a@b","private_key":"k","x":1}'), { client_email: 'a@b', private_key: 'k' });
});

test('lease folder plus slip and document subfolders are created under the root', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'sa@test.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const created = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      const [h, c, sig] = new URLSearchParams(init.body).get('assertion').split('.');
      assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url')), 'JWT signature');
      assert.equal(JSON.parse(Buffer.from(c, 'base64url')).iss, 'sa@test.iam');
      return Response.json({ access_token: 'tok' });
    }
    assert.equal(init.headers.Authorization, 'Bearer tok');
    const body = JSON.parse(init.body);
    created.push({ name: body.name, parent: body.parents[0] });
    return Response.json({ id: `id-${created.length}` });
  };
  try {
    const folders = await createLeaseFolders(sa, 'root', 'ห้อง 101 · 2026-10-19');
    assert.equal(created[0].name, 'ห้อง 101 · 2026-10-19');
    assert.equal(created[0].parent, 'root');
    assert.deepEqual(created.slice(1).map((f) => f.parent), ['id-1', 'id-1']);
    assert.deepEqual(created.slice(1).map((f) => f.name).sort(), ['สลิป', 'เอกสาร'].sort());
    assert.equal(folders.folder, 'id-1');
    assert.ok(folders.slips && folders.documents && folders.slips !== folders.documents);
  } finally {
    globalThis.fetch = realFetch;
  }
});
