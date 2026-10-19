"use server";

import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/phase1";
import { parseServiceAccount } from "@/lib/google-drive";
import { promptPayPayload } from "@/lib/promptpay";
import { SECRET_KEYS, SETTING_KEYS, type SettingKey } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

// คีย์ลับเว้นว่าง = คงค่าเดิม, ค่าทั่วไปเว้นว่าง = ล้างค่า (กลับไปใช้ env ถ้ามี)
export async function saveSettings(_prev: Result | null, form: FormData): Promise<Result> {
  try {
    const { userId } = await requireStaff(await createClient());
    const upserts: { key: SettingKey; value: string; updated_by: string; updated_at: string }[] = [];
    const clears: SettingKey[] = [];
    for (const key of SETTING_KEYS) {
      const raw = form.get(key);
      if (typeof raw !== "string") continue;
      const value = raw.trim();
      // ไฟล์ JSON ของ service account ยาวราว 2–3 พันตัวอักษร
      if (value.length > (key === "GOOGLE_SERVICE_ACCOUNT_JSON" ? 10000 : 1000)) return { ok: false, error: `${key} ยาวเกินไป` };
      if (key === "GOOGLE_SERVICE_ACCOUNT_JSON" && !parseServiceAccount(value)) {
        return { ok: false, error: "Service Account ต้องเป็นไฟล์ JSON ที่มี client_email และ private_key" };
      }
      if (!value) {
        if (!SECRET_KEYS.includes(key)) clears.push(key);
        continue;
      }
      if (key === "PROMPTPAY_ID" && !promptPayPayload(value, 1)) {
        return { ok: false, error: "PromptPay ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก" };
      }
      upserts.push({ key, value, updated_by: userId, updated_at: new Date().toISOString() });
    }
    const admin = createAdminClient();
    if (upserts.length) {
      const { error } = await admin.from("app_settings").upsert(upserts);
      if (error) return { ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
    }
    if (clears.length) {
      const { error } = await admin.from("app_settings").delete().in("key", clears);
      if (error) return { ok: false, error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
    }
    // บันทึกแค่ชื่อคีย์ที่เปลี่ยน ไม่เก็บค่าลับลง audit log
    await audit(admin, { actor_id: userId, action: "settings.update", table_name: "app_settings", after: { changed: upserts.map((u) => u.key), cleared: clears } });
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" };
  }
}

export type AdminActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

export async function createAdmin(
  _prev: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  try {
    const { userId, role } = await requireStaff(await createClient());

    const lineUserId = (form.get("line_user_id") as string | null)?.trim() ?? "";
    const displayName = (form.get("display_name") as string | null)?.trim() ?? "";
    const phone = (form.get("phone") as string | null)?.trim() ?? "";
    const targetRole = (form.get("role") as string | null)?.trim() ?? "admin";

    if (!lineUserId || !/^U[0-9a-fA-F]{32}$/i.test(lineUserId)) {
      return {
        ok: false,
        error: "LINE User ID ไม่ถูกต้อง (ต้องขึ้นต้นด้วยตัว U และมีความยาว 33 ตัวอักษร เช่น U0123456789abcdef0123456789abcdef)",
      };
    }
    if (!displayName) {
      return { ok: false, error: "กรุณาระบุชื่อผู้ดูแล" };
    }
    if (targetRole !== "admin" && targetRole !== "owner") {
      return { ok: false, error: "บทบาทไม่ถูกต้อง" };
    }
    if (targetRole === "owner" && role !== "owner") {
      return { ok: false, error: "เฉพาะเจ้าของหอพักเท่านั้นที่สามารถแต่งตั้ง Owner เพิ่มได้" };
    }

    const admin = createAdminClient();

    // 1. ตรวจสอบว่ามี profile ที่ผูกกับ line_user_id นี้อยู่แล้วหรือไม่
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, role, display_name")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

    if (existingProfile) {
      const { data, error: roleError } = await admin.rpc("set_staff_role", {
        p_target_id: existingProfile.id,
        p_target_role: targetRole,
        p_actor_id: userId,
        p_display_name: displayName || existingProfile.display_name,
        p_phone: phone || null,
      });

      if (roleError) {
        if (roleError.message.includes("last_owner")) {
          return { ok: false, error: "ไม่สามารถถอดสิทธิ์เจ้าของ (Owner) คนสุดท้ายของระบบได้" };
        }
        if (roleError.message.includes("owner_required")) {
          return { ok: false, error: "เฉพาะเจ้าของหอพักเท่านั้นที่สามารถจัดการบัญชีเจ้าของได้" };
        }
        if (roleError.message.includes("self_role_change")) {
          return { ok: false, error: "ไม่สามารถเปลี่ยนบทบาทบัญชีของตนเองได้" };
        }
        return { ok: false, error: roleError.message };
      }
      const previous = data as { role: string; display_name: string | null };

      await audit(admin, {
        actor_id: userId,
        action: "admin.promote",
        table_name: "profiles",
        record_id: existingProfile.id,
        before: { role: previous.role },
        after: { role: targetRole, line_user_id: lineUserId, display_name: displayName },
      });

      revalidatePath("/admin/settings");
      return {
        ok: true,
        message: `แต่งตั้ง "${displayName}" เป็น ${targetRole === "owner" ? "เจ้าของหอพัก" : "แอดมิน"} สำเร็จ`,
      };
    }

    // 2. ถ้ายังไม่เคยล็อกอิน: สร้าง Auth user สังเคราะห์ตามมาตรฐาน LINE Login ของระบบ
    const email = `line_${lineUserId.toLowerCase()}@line.local`;
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId, display_name: displayName },
    });

    if (created.error && !/already|exists|registered/i.test(created.error.message)) {
      return { ok: false, error: created.error.message };
    }

    let authUserId = created.data.user?.id;
    if (!authUserId) {
      const { data: listData } = await admin.auth.admin.listUsers();
      authUserId = listData?.users?.find((u) => u.email?.toLowerCase() === email)?.id;
    }

    if (!authUserId) {
      return { ok: false, error: "ไม่สามารถสร้างบัญชีผู้ใช้ได้" };
    }

    const { error: insertError } = await admin.from("profiles").upsert({
      id: authUserId,
      line_user_id: lineUserId,
      display_name: displayName,
      phone: phone || null,
      role: targetRole,
    });

    if (insertError) return { ok: false, error: insertError.message };

    await audit(admin, {
      actor_id: userId,
      action: "admin.create",
      table_name: "profiles",
      record_id: authUserId,
      after: { role: targetRole, line_user_id: lineUserId, display_name: displayName },
    });

    revalidatePath("/admin/settings");
    return {
      ok: true,
      message: `เพิ่มผู้ดูแล LINE: "${displayName}" (${targetRole === "owner" ? "เจ้าของหอพัก" : "แอดมิน"}) สำเร็จ`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการเพิ่มผู้ดูแล" };
  }
}

export async function removeAdmin(
  _prev: AdminActionResult | null,
  form: FormData,
): Promise<AdminActionResult> {
  try {
    const { userId } = await requireStaff(await createClient());
    const targetId = (form.get("target_id") as string | null) ?? "";

    if (!targetId) return { ok: false, error: "ไม่พบรหัสผู้ใช้" };

    if (targetId === userId) {
      return { ok: false, error: "ไม่สามารถถอดสิทธิ์บัญชีของตนเองได้" };
    }

    const admin = createAdminClient();

    // Serialize owner demotions and check the last-owner invariant in one DB transaction.
    const { data, error: demoteError } = await admin.rpc("set_staff_role", {
      p_target_id: targetId,
      p_target_role: "tenant",
      p_actor_id: userId,
    });

    if (demoteError) {
      if (demoteError.message.includes("last_owner")) {
        return { ok: false, error: "ไม่สามารถถอดสิทธิ์เจ้าของ (Owner) คนสุดท้ายของระบบได้" };
      }
      if (demoteError.message.includes("owner_required")) {
        return { ok: false, error: "เฉพาะเจ้าของหอพักเท่านั้นที่สามารถจัดการบัญชีเจ้าของได้" };
      }
      if (demoteError.message.includes("staff_not_found")) {
        return { ok: false, error: "ไม่พบข้อมูลผู้ดูแลในระบบ" };
      }
      if (demoteError.message.includes("not_staff")) {
        return { ok: false, error: "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลที่ถอดได้" };
      }
      if (demoteError.message.includes("self_role_change")) {
        return { ok: false, error: "ไม่สามารถเปลี่ยนบทบาทบัญชีของตนเองได้" };
      }
      return { ok: false, error: demoteError.message };
    }

    const previous = data as { role: string; display_name: string | null };

    await audit(admin, {
      actor_id: userId,
      action: "admin.remove",
      table_name: "profiles",
      record_id: targetId,
      before: { role: previous.role },
      after: { role: "tenant" },
    });

    revalidatePath("/admin/settings");
    return { ok: true, message: `ถอดสิทธิ์ผู้ดูแล "${previous.display_name ?? targetId}" เรียบร้อยแล้ว` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการถอดสิทธิ์ผู้ดูแล" };
  }
}
