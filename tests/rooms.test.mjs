import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRoomInput } from '../lib/rooms.ts';
import { createTestDb, asUser } from '../supabase/tests/harness.mjs';

function form(values) {
  const f = new FormData();
  for (const [key, value] of Object.entries(values)) f.set(key, value);
  return f;
}

test('room editing accepts complete fields and rejects malformed input', () => {
  const values = { room_no: ' 101 ', unit_type: 'commercial', floor: '', status: 'maintenance' };
  assert.deepEqual(parseRoomInput(form(values)), {
    ok: true, value: { room_no: '101', unit_type: 'commercial', floor: null, status: 'maintenance' },
  });
  for (const change of [
    { room_no: ' ' }, { room_no: 'x'.repeat(41) }, { unit_type: 'admin' },
    { floor: '1.5' }, { floor: 'NaN' }, { floor: '2147483648' }, { status: 'deleted' },
  ]) assert.equal(parseRoomInput(form({ ...values, ...change })).ok, false);
});

test('room edits retain references; deletion protects history and denies tenants', async () => {
  const db = await createTestDb();
  try {
    const owner = '00000000-0000-0000-0000-000000000001';
    const tenant = '00000000-0000-0000-0000-000000000002';
    const ids = [1, 2, 3, 4].map(n => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`);
    await db.exec(`
      insert into auth.users(id) values('${owner}'),('${tenant}');
      insert into profiles(id,role) values('${owner}','owner'),('${tenant}','tenant');
      insert into rooms(id,room_no,unit_type) values
        ('${ids[0]}','101','residential'),('${ids[1]}','102','residential'),
        ('${ids[2]}','103','residential'),('${ids[3]}','104','commercial');
      insert into leases(room_id,start_date,end_date,status,rent_amount,due_day)
        values('${ids[0]}','2026-01-01','2026-09-30','ended',3500,31);
      insert into meter_readings(room_id,period,prev_value,curr_value)
        values('${ids[1]}','2026-10-01',100,150);
      insert into maintenance_requests(room_id,category) values('${ids[2]}','test');
    `);
    const edited = await asUser(db, owner, `update rooms set room_no='A101',unit_type='commercial',floor=2,status='maintenance'
      where id='${ids[0]}' returning id,room_no,unit_type,floor,status`);
    assert.deepEqual(edited.rows, [{ id: ids[0], room_no: 'A101', unit_type: 'commercial', floor: 2, status: 'maintenance' }]);
    assert.equal((await db.query('select room_id from leases')).rows[0].room_id, ids[0]);
    await assert.rejects(asUser(db, owner, `update rooms set room_no='102' where id='${ids[0]}'`), /duplicate key/);

    // Even an ended contract must prevent deletion. Meter/maintenance references do too.
    for (const id of ids.slice(0, 3)) {
      await assert.rejects(asUser(db, owner, `delete from rooms where id='${id}' returning id`), /foreign key/);
      assert.equal((await db.query(`select count(*)::int as n from rooms where id='${id}'`)).rows[0].n, 1);
    }
    assert.equal((await asUser(db, tenant, `update rooms set room_no='BAD' where id='${ids[0]}' returning id`)).rows.length, 0);
    assert.equal((await asUser(db, tenant, `delete from rooms where id='${ids[3]}' returning id`)).rows.length, 0);
    assert.equal((await asUser(db, owner, `delete from rooms where id='${ids[3]}' returning id`)).rows.length, 1);
    for (const table of ['leases', 'meter_readings', 'maintenance_requests']) {
      assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n, 1);
    }
  } finally {
    await db.close();
  }
});
