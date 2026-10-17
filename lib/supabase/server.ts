import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";

export async function createClient() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    throw new Error(
      "Supabase ยังไม่ตั้งค่า: ใส่ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY แล้วลองใหม่",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // เรียกจาก Server Component ตั้ง cookie ไม่ได้ ข้ามได้
          }
        },
      },
    });
}

