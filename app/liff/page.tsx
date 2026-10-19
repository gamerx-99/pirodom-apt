 // อ่าน session/DB ทุก request — ยกเว้น static-shell validation (Cache Components)
 export const instant = false;
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/app/components/ui";
import LiffNav from "./components/nav";
import { INVOICE_STATUS_LABEL, MAINT_STATUS_LABEL } from "@/lib/mock";
import { formatTHB, invoiceStatusForDisplay, todayTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 pb-20">
        <div>
          <p className="text-sm text-gray-500">โหมดตัวอย่าง: ยังไม่ได้เชื่อมต่อระบบฐานข้อมูล</p>
          <h1 className="text-xl font-bold text-gray-900">สวัสดี · ห้อง 101</h1>
        </div>
        <Card title="ยอดค้างชำระ" desc="ครบกำหนด 30 ก.ย. 2569">
          <p className="text-3xl font-bold text-gray-900">{formatTHB(3850)}</p>
          <p className="mt-1 text-sm text-gray-500">ขอรหัสยืนยันจากผู้ดูแล แล้วส่งรหัสหา LINE Bot เพื่อผูกห้องก่อนเข้าสู่ระบบ</p>
        </Card>
        <LiffNav />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4 pb-20">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ระบบหอพัก</h1>
        </div>
        <Card title="ไม่สามารถตรวจสอบห้องพักของคุณได้กรุณาติดต่อ 053-276631">
          <p className="text-sm font-medium text-rose-700">
            ไม่สามารถตรวจสอบห้องพักของคุณได้กรุณาติดต่อ 053-276631
          </p>
          <div className="mt-4">
            <a
              href="tel:053276631"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              โทร 053-276631
            </a>
          </div>
        </Card>
      </div>
    );
  }

  // Both reads are scoped to the authenticated user and do not depend on each other.
  const [{ data: profile }, { data: myLeasesRaw }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("lease_tenants")
      .select("is_primary, leases(id,status,rooms(id,room_no,unit_type))")
      .eq("profile_id", user.id),
  ]);

  // เงื่อนไข 1: User > Admin -> พาไปหน้า Admin
  if (profile?.role === "owner" || profile?.role === "admin") {
    redirect("/admin");
  }

  const myLeases = (myLeasesRaw ?? []) as unknown as {
    is_primary: boolean;
    leases: { id: string; status: string; rooms: { id: string; room_no: string; unit_type: string } | null } | null;
  }[];

  const active = myLeases.filter((t) => t.leases?.status === "active");

  // เงื่อนไข 3: User อื่นๆ -> ให้แจ้งว่า ไม่สามารถตรวจสอบห้องพักของคุณได้กรุณาติดต่อ 053-276631
  if (active.length === 0) {
    return (
      <div className="space-y-4 pb-20">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            สวัสดี {profile?.display_name ?? ""}
          </h1>
        </div>
        <Card
          title="ไม่สามารถตรวจสอบห้องพักของคุณได้กรุณาติดต่อ 053-276631"
          desc="ระบบไม่พบข้อมูลห้องพักที่ผูกกับบัญชี LINE นี้"
        >
          <p className="text-base font-semibold text-rose-700">
            ไม่สามารถตรวจสอบห้องพักของคุณได้กรุณาติดต่อ 053-276631
          </p>
          <p className="mt-2 text-sm text-gray-600">
            หากท่านเป็นผู้พักอาศัย กรุณาติดต่อสำนักงานหอพักเพื่อตรวจสอบข้อมูลการเข้าพัก หรือขอรหัสเชื่อมต่อห้องพัก
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href="tel:053276631"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              โทร 053-276631
            </a>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                สลับบัญชี LINE
              </button>
            </form>
          </div>
        </Card>
      </div>
    );
  }

  const leaseIds = active.map((t) => t.leases!.id);
  const roomNos = active.map((t) => t.leases!.rooms?.room_no ?? "?").join(", ");
  const roomIds = [
    ...new Set(
      active
        .map((tenant) => tenant.leases?.rooms?.id)
        .filter((roomId): roomId is string => Boolean(roomId)),
    ),
  ];
  const [{ data: bills }, { data: maint }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,period,total,status,due_date")
      .in("lease_id", leaseIds)
      .in("status", ["issued", "verifying", "pending_review", "overdue"])
      .order("due_date", { ascending: true })
      .limit(5),
    roomIds.length
      ? supabase
          .from("maintenance_requests")
          .select("id,description,status")
          .in("room_id", roomIds)
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] as { id: string; description: string | null; status: string }[] }),
  ]);
  const outstanding = (bills ?? []).reduce((s, b) => s + Number(b.total ?? 0), 0);
  const nextDue = bills?.[0]?.due_date ?? null;

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">สวัสดี {profile?.display_name ?? "ผู้เช่า"} · ห้อง {roomNos}</h1>
      </div>
      <Card title="ยอดค้างชำระ" desc={nextDue ? `ครบกำหนด ${nextDue}` : "ไม่มียอดค้าง"}>
        <p className="text-3xl font-bold text-gray-900">{formatTHB(outstanding)}</p>
        {bills && bills.length > 0 ? (
          <Link href={`/liff/bills/${bills[0].id}`} className="mt-3 block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700">
            ดูบิลและชำระเงิน
          </Link>
        ) : (
          <p className="mt-1 text-sm text-emerald-700">ไม่มีบิลค้าง (ชำระครบถ้วนแล้ว)</p>
        )}
      </Card>
      <Card title="บิลของฉัน" desc="เฉพาะบิลที่ยังไม่ชำระ">
        {(bills ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีบิลรอชำระ</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bills!.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2">
                <Link href={`/liff/bills/${b.id}`} className="hover:underline">
                  {String(b.period).slice(0, 7)} · {formatTHB(Number(b.total))}
                </Link>
                <Badge tone={invoiceStatusForDisplay(b.status, b.due_date, todayTH()) === "overdue" ? "red" : "amber"}>
                  {INVOICE_STATUS_LABEL[invoiceStatusForDisplay(b.status, b.due_date, todayTH()) as keyof typeof INVOICE_STATUS_LABEL] ?? b.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="ทางลัด">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link href="/liff/meters" className="rounded-xl bg-gray-50 p-3 text-center">ประวัติมิเตอร์</Link>
          <Link href="/liff/documents" className="rounded-xl bg-gray-50 p-3 text-center">เอกสาร</Link>
          <Link href="/liff/maintenance" className="rounded-xl bg-gray-50 p-3 text-center">แจ้งซ่อม</Link>
          {bills?.[0] ? (
            <Link href={`/liff/bills/${bills[0].id}`} className="rounded-xl bg-gray-50 p-3 text-center">บิลล่าสุด</Link>
          ) : (
            <span className="rounded-xl bg-gray-50 p-3 text-center text-gray-400">ยังไม่มีบิล</span>
          )}
        </div>
      </Card>
      <Card title="งานซ่อมล่าสุด">
        {!maint || maint.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีงานซ่อม</p>
        ) : (
          <p className="flex items-center justify-between text-sm">
            <span>{maint[0].description ?? "งานซ่อม"}</span>
            <Badge tone="amber">{MAINT_STATUS_LABEL[maint[0].status as keyof typeof MAINT_STATUS_LABEL] ?? maint[0].status}</Badge>
          </p>
        )}
      </Card>
      <LiffNav />
    </div>
  );
}
