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
  const { error } = await admin.storage.from(bucket).upload(clean, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`);
  return clean;
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
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(clean, seconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "ออก Signed URL ไม่ได้");
  }
  return data.signedUrl;
}