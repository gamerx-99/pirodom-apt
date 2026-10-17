import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

export function createClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    throw new Error(
      "Supabase ยังไม่ตั้งค่า: ใส่ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY แล้วลองใหม่",
    );
  }
  return createBrowserClient(url, anon);
}

export function isBrowserSupabaseReady(): boolean {
  return !!getEnv("NEXT_PUBLIC_SUPABASE_URL") && !!getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

