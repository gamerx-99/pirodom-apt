import {
  ENV_KEYS,
  isLiffConfigured,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  missingEnv,
} from "@/lib/env";
import { requireStaff } from "@/lib/phase1";
import { SETTING_KEYS, getSettings, isLineConfigured, isSlipokConfigured } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

// รายงานว่า env ขาดอะไร — เปิดสาธารณะไม่ได้ เพราะชื่อ key บอกโครงสร้างระบบไปให้ผู้อื่น
export async function GET() {
  let authorized = false;
  try {
    await requireStaff(await createClient());
    authorized = true;
  } catch {
    authorized = false;
  }
  if (!authorized) return Response.json({ error: "unauthorized" }, { status: 401 });

  const settings = await getSettings();
  const missing = [
    ...missingEnv(ENV_KEYS.filter((k) => !(SETTING_KEYS as readonly string[]).includes(k))),
    ...SETTING_KEYS.filter((k) => !settings[k]),
  ];
  return Response.json({
    ok: missing.length === 0,
    // true = ข้ามส่วนนั้นไปก่อนได้โดยไม่พัง
    skipped: {
      supabase: !isSupabaseConfigured(),
      supabase_admin: !isSupabaseAdminConfigured(),
      liff: !isLiffConfigured(),
      line: !(await isLineConfigured()),
      line_webhook: !settings.LINE_CHANNEL_SECRET,
      slipok: !(await isSlipokConfigured()),
    },
    missing,
    note: missing.length
      ? "มี env ขาด: ระบบเข้าสู่โหมด demo/503 ในส่วนนั้น เมื่อกำหนดค่า env ครบจะเปิดใช้งานฟังก์ชันจริง"
      : "env ครบ",
  });
}