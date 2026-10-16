import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service Role: ใช้เฉพาะ API Route / Cron ห้าม import ฝั่ง client
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
