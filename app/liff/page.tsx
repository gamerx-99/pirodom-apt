 // อ่าน session/DB ทุก request — ยกเว้น static-shell validation (Cache Components)
 export const instant = false;
import Link from "next/link";
import { Badge, Card, EmptyState } from "@/app/components/ui";
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
          <p className="mt-1 text-sm text-gray-500">เข้าสู่ระบบด้วย LINE แล้วผูกห้องจากลิงก์เชิญเพื่อดูข้อมูลจริง</p>
        </Card>
        <LiffNav />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">เข้าสู่ระบบด้วย LINE</h1>
        <Card title="ยังไม่ได้ผูกบัญชี" desc="เปิดลิงก์นี้ผ่าน LINE เพื่อยืนยันตัวตน">
          <p className="text-sm text-gray-500">ถ้ามีลิงก์เชิญจากผู้ดูแล ให้กดลิงก์นั้นเพื่อผูกห้องก่อน</p>
        </Card>
        <LiffNav />
      </div>
    );
  }

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
   const { data: myLeasesRaw } = await supabase
     .from("lease_tenants")
     .select("is_primary, leases(id,status,rooms(room_no,unit_type))")
     .eq("profile_id", user.id);
   const myLeases = (myLeasesRaw ?? []) as unknown as {
     is_primary: boolean;
     leases: { id: string; status: string; rooms: { room_no: string; unit_type: string } | null } | null;
   }[];
   const active = myLeases.filter((t) => t.leases?.status === "active");
   if (active.length === 0) {
     return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">สวัสดี {profile?.display_name ?? ""}</h1>
        <EmptyState
          title="ยังไม่มีห้องที่ผูกอยู่"
          desc="ถ้าเพิ่งย้ายเข้าหรือเปลี่ยนเครื่อง ให้ขอ/กดลิงก์เชิญจากผู้ดูแลอีกครั้ง (ลิงก์ใช้ได้ครั้งเดียว 7 วัน)"
        />
        <LiffNav />
      </div>
    );
  }

  const leaseIds = active.map((t) => t.leases!.id);
  const roomNos = active.map((t) => t.leases!.rooms?.room_no ?? "?").join(", ");
  const { data: bills } = await supabase
    .from("invoices")
    .select("id,period,total,status,due_date")
    .in("lease_id", leaseIds)
    .in("status", ["issued", "verifying", "pending_review", "overdue"])
    .order("due_date", { ascending: true })
    .limit(5);
  const outstanding = (bills ?? []).reduce((s, b) => s + Number(b.total ?? 0), 0);
  const nextDue = bills?.[0]?.due_date ?? null;

  const roomIds = (await supabase.from("leases").select("room_id").in("id", leaseIds)).data?.map((l) => l.room_id) ?? [];
  const { data: maint } = roomIds.length
    ? await supabase.from("maintenance_requests").select("id,description,status").in("room_id", roomIds).order("created_at", { ascending: false }).limit(1)
    : { data: [] as { id: string; description: string | null; status: string }[] };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">สวัสดี {profile?.display_name ?? "ผู้เช่า"} · ห้อง {roomNos}</h1>
      </div>
      <Card title="ยอดค้างชำระ" desc={nextDue ? `ครบกำหนด ${nextDue}` : "ไม่มียอดค้าง"}>
        <p className="text-3xl font-bold text-gray-900">{formatTHB(outstanding)}</p>
        {bills && bills.length > 0 ? (
          <Link href={`/liff/bills/${bills[0].id}`} className="mt-3 block rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-700">
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
