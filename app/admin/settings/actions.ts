"use server";

import { revalidatePath } from "next/cache";
import { audit, requireStaff } from "@/lib/phase1";
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
      if (value.length > 1000) return { ok: false, error: `${key} ยาวเกินไป` };
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
