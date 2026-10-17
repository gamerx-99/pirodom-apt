import {
  ENV_KEYS,
  isCronConfigured,
  isLiffConfigured,
  isLineConfigured,
  isLineWebhookConfigured,
  isSlipokConfigured,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  missingEnv,
} from "@/lib/env";

export async function GET() {
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
      cron: !isCronConfigured(),
    },
    missing,
    note: missing.length
      ? "มี env ขาด — ระบบเข้า demo/503 ในส่วนนั้น ใส่ env แล้วจะเปิดฟังก์ชันจริง"
      : "env ครบ",
  });
}
