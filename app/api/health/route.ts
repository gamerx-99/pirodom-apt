import {
  ENV_KEYS,
  isLiffConfigured,
  isLineConfigured,
  isLineWebhookConfigured,
  isSlipokConfigured,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  missingEnv,
} from "@/lib/env";
import { requireStaff } from "@/lib/phase1";
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

  const missing = missingEnv(ENV_KEYS);
  return Response.json({
    ok: missing.length === 0,
    // true = ข้ามส่วนนั้นไปก่อนได้โดยไม่พัง
    skipped: {
      supabase: !isSupabaseConfigured(),
      supabase_admin: !isSupabaseAdminConfigured(),
      liff: !isLiffConfigured(),
      line: !isLineConfigured(),
      line_webhook: !isLineWebhookConfigured(),
      slipok: !isSlipokConfigured(),
    },
    missing,
    note: missing.length
      ? "มี env ขาด: ระบบเข้าสู่โหมด demo/503 ในส่วนนั้น เมื่อกำหนดค่า env ครบจะเปิดใช้งานฟังก์ชันจริง"
      : "env ครบ",
  });
}