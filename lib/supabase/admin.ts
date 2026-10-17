import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

// Service Role ใช้เฉพาะฝั่ง server ถ้า env ขาดให้ route ตอบ 503
export function createAdminClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase Admin ยังไม่ตั้งค่า (ข้ามส่วนนี้ไปก่อน — ใส่ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY แล้วลองใหม่)",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

