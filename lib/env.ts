/**
 * จุดรวมเช็ค env ที่เดียว — ส่วนไหนขาดให้ข้าม ไม่ throw ตอน build
 * ถ้าไม่พร้อมให้ UI เข้า demo mode / API ตอบ 503 not_configured
 */

export const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_LIFF_ID",
  "LINE_LOGIN_CHANNEL_ID",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "SLIPOK_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_DRIVE_FOLDER_ID",
  "SLIPOK_BRANCH_ID",
  "PROMPTPAY_ID",
  "PROMPTPAY_ACCOUNT_NAME",
] as const;

export type EnvKey = (typeof ENV_KEYS)[number];

export function getEnv(key: EnvKey): string | undefined {
  const v = process.env[key];
  if (v && v.trim() !== "") return v;
  if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
    const pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (pub && pub.trim() !== "") return pub;
  }
  if (key === "SUPABASE_SERVICE_ROLE_KEY") {
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (secret && secret.trim() !== "") return secret;
  }
  return undefined;
}

export function missingEnv(keys: readonly EnvKey[]): EnvKey[] {
  return keys.filter((k) => !getEnv(k));
}

export function isSupabaseConfigured(): boolean {
  return (
    !!getEnv("NEXT_PUBLIC_SUPABASE_URL") &&
    !!getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return isSupabaseConfigured() && !!getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function isLiffConfigured(): boolean {
  return !!getEnv("NEXT_PUBLIC_LIFF_ID");
}

/** ตอบ 503 มาตรฐานเมื่อ service ยังไม่ตั้งค่า */
export function notConfiguredResponse(missing: readonly string[]) {
  return Response.json(
    { error: "not_configured", missing },
    { status: 503 },
  );
}
