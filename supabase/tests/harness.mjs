// บูตสแตรอป PGlite สำหรับชุดทดสอบ — ใช้ร่วมกันทุกไฟล์ในโฟลเดอร์นี้
// จำลองส่วนของ Supabase ที่ migration ใช้: auth.users, auth.uid(), storage.*, role anon/authenticated/service_role
// และค่าเริ่มต้นสิทธิ์ของ Supabase ที่ต้องจำลองไว้ ไม่งั้นชุดทดสอบจะพลาดเคสฟังก์ชันที่ถอนสิทธิ์ไว้
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";

export async function createTestDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text,
      name text,
      owner uuid,
      created_at timestamptz default now()
    );
    -- บน Supabase โฮสต์ storage.objects เปิด RLS อยู่แล้ว (migration ห้ามสั่ง enable เอง
    -- เพราะไม่ได้เป็นเจ้าของตาราง) ชุดทดสอบต้องจำลองสภาพนั้นเอง
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema storage grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
    grant all on storage.objects to anon, authenticated;
  `);

  const dir = new URL("../migrations/", import.meta.url);
  for (const f of readdirSync(dir).sort()) {
    await db.exec(readFileSync(new URL(f, dir), "utf8"));
  }
  return db;
}

/** รันคำสั่งในฐานข้อมูลในมุมของผู้ใช้ที่เข้าสู่ระบบแล้ว (RLS มีผล) */
export async function asUser(db, uid, sql) {
  return asRole(db, "authenticated", uid, sql);
}

export async function asRole(db, role, uid, sql) {
  const claim = uid ? `select set_config('request.jwt.claim.sub', '${uid}', false);` : "";
  await db.exec(`set role ${role}; ${claim}`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role;");
  }
}