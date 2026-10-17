import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const BUCKETS = ["slips", "documents", "meters", "maintenance"] as const;
export type Bucket = (typeof BUCKETS)[number];

/** อายุ Signed URL สั้นพอให้สลิปลิงก์รั่วไปใช้ไม่ได้ (Phase 0: เก็บไฟล์แบบ private) */
export const SIGNED_URL_TTL_SECONDS = 300;

const ALLOWED_CONTENT: Record<Bucket, string[]> = {
  slips: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  documents: ["application/pdf", "image/jpeg", "image/png"],
  meters: ["image/jpeg", "image/png", "image/webp"],
  maintenance: ["image/jpeg", "image/png", "image/webp"],
};

const MAX_BYTES = 10 * 1024 * 1024;

/** ต่อ path ให้เป็นรูปแบบเดียวกับ policy ใน storage_rls.sql */
export function storagePath(...parts: (string | number)[]): string {
  return parts
    .map((p) => String(p).trim().replace(/^\/+|\/+$/g, ""))
    .filter((p) => p.length > 0)
    .join("/");
}

/**
 * ชื่อ object ใน storage ไม่เอาชื่อ bucket นำหน้า
 * policy อ่าน split_part(name,'/',1) เป็น lease_id / room_id ถ้าเหลือส่วนนำหน้าไว้
 * policy จะไม่มีวันตรงกับไฟล์ที่แอปเขียน (fail-closed: ผู้เช่าอ่านตรงไม่ได้เลย)
 * ส่วน file_path ในฐานข้อมูลเก็บพร้อม prefix ไว้ตามรูปแบบที่ constraint กำหนด
 */
export function objectName(bucket: Bucket, path: string): string {
  const clean = storagePath(path);
  const prefix = `${bucket}/`;
  return clean.startsWith(prefix) ? clean.slice(prefix.length) : clean;
}

/**
 * อัปโหลดเข้า private bucket ผ่าน service role
 * คืน path ที่เก็บลง DB — ห้ามเก็บ URL เต็ม เพราะ path ต้องตรงกับ policy
 */
export async function uploadPrivateFile(
  bucket: Bucket,
  path: string,
  file: File,
): Promise<string> {
  const clean = storagePath(path);
  if (!clean) throw new Error("path ไฟล์ว่าง");
  if (!ALLOWED_CONTENT[bucket].includes(file.type)) {
    throw new Error(`ชนิดไฟล์ไม่รับ: ${file.type || "ไม่ทราบชนิด"}`);
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error(`ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB`);
  }
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(objectName(bucket, clean), file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`);
  return clean;
}

/**
 * ลบไฟล์ออกจาก private bucket
 * ต้องผ่าน objectName เสมอ ถ้าส่ง path ที่ยังมี prefix ของ bucket มา Supabase จะ
 * ลบไม่ตกแต่ไม่ error แล้ว audit จะบันทึกว่าลบสำเร็จ ทั้งที่ไฟล์ยังอยู่
 */
export async function removePrivateFile(bucket: Bucket, path: string): Promise<void> {
  const clean = objectName(bucket, path);
  if (!clean) throw new Error("path ไฟล์ว่าง");
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).remove([clean]);
  if (error) throw new Error(`ลบไฟล์ไม่สำเร็จ: ${error.message}`);
}

/**
 * ออก Signed URL — ต้องตรวจสิทธิ์ของผู้ขอก่อนเรียกใช้ทุกครั้ง
 * policy ใน storage_rls.sql กันการอ่านตรงจาก client แล้ว
 */
export async function signedUrl(
  bucket: Bucket,
  path: string,
  seconds = SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const clean = storagePath(path);
  if (!clean) throw new Error("path ไฟล์ว่าง");
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(objectName(bucket, clean), seconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "ออก Signed URL ไม่ได้");
  }
  return data.signedUrl;
}