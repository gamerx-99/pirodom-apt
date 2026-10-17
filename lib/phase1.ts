import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const INVITE_TTL_DAYS = 7;

/** token ดิบส่งให้ผู้เช่า 1 ครั้ง (แสดงเป็น QR/ลิงก์) — เก็บเฉพาะ hash ใน DB */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
}

export type Staff = { id: string; role: string };

/** ตรวจ session + role owner/admin — ใช้ทุก server action ของ Phase 1 */
export async function requireStaff(
  supabase: SupabaseClient,
): Promise<{ userId: string; role: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("กรุณาเข้าสู่ระบบก่อน (LINE Login)");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (profile?.role as string | undefined) ?? "";
  if (role !== "owner" && role !== "admin") {
    throw new Error("หน้านี้สำหรับเจ้าของ/แอดมินเท่านั้น");
  }
  return { userId: user.id, role };
}

/** เขียน audit แบบไม่ให้งานหลักล้มถ้าเขียนไม่สำเร็จ */
export async function audit(
  admin: SupabaseClient,
  row: {
    actor_id?: string | null;
    action: string;
    table_name: string;
    record_id?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  try {
    await admin.from("audit_logs").insert({
      actor_id: row.actor_id ?? null,
      action: row.action,
      table_name: row.table_name,
      record_id: row.record_id ?? null,
      before: (row.before as never) ?? null,
      after: (row.after as never) ?? null,
    });
  } catch {
    // งานเงิน/สัญญาต้องไม่ล้มเพราะ audit เขียนไม่ได้ — ตรวจจาก log ภายหลัง
  }
}

export function cleanRoomNo(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim().slice(0, 40);
}

export function toNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function cleanPhone(v: string): string {
  return v.replace(/[\s-]/g, "").slice(0, 20);
}

export function isValidPhone(v: string): boolean {
  return /^[0-9+]{9,15}$/.test(v);
}
