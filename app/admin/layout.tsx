 // หน้านี้อ่าน session ทุก request — ยกเว้น static-shell validation (Cache Components)
 export const instant = false;
import Link from "next/link";
import { redirect } from "next/navigation";
import PaymentNotifications from "./payment-notifications";
import MaintenanceNotifications from "./maintenance-notifications";
import { AdminNav } from "./admin-nav";


// กันหน้า admin ฝั่ง server: ไม่มี session ส่งไป /liff (ทางเข้า LINE Login)
// role ไม่ใช่ owner/admin ตอบ 403 ไม่ render เนื้อหาให้
// ยังไม่มี Supabase env คง demo mode ไว้เพื่อให้ดู UI ต่อได้
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div className="flex min-h-dvh flex-col bg-[#f8f9ff] text-slate-900 lg:flex-row">
        <AdminNav demo />
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
          <p className="mb-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span className="font-semibold">โหมดตัวอย่าง</span>: ยังไม่ได้เชื่อมต่อฐานข้อมูล
            จึงข้ามการตรวจสอบสิทธิ์
          </p>
          {children}
        </main>
      </div>
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/liff");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-6 text-gray-900">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
          <p className="text-lg font-bold text-gray-900">403: ไม่มีสิทธิ์เข้าถึงส่วนนี้</p>
          <p className="mt-1 text-sm text-gray-500">
            หน้านี้สำหรับเจ้าของและแอดมินเท่านั้น บัญชีนี้มี role: {profile?.role ?? "ยังไม่ผูก role"}
          </p>
          <Link
            href="/liff"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            กลับหน้าผู้เช่า
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f9ff] text-slate-900 lg:flex-row">
      <AdminNav />
      <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">
        <PaymentNotifications />
        <MaintenanceNotifications />
        {children}
      </main>
    </div>
  );
}
