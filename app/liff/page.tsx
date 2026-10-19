 // อ่าน session/DB ทุก request — ยกเว้น static-shell validation (Cache Components)
 export const instant = false;
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Badge, Card } from "@/app/components/ui";
import LiffNav from "./components/nav";
import { INVOICE_STATUS_LABEL, MAINT_STATUS_LABEL } from "@/lib/mock";
import { formatDateTH, formatTHB, invoiceStatusForDisplay, todayTH } from "@/lib/format";
import { Icon, type IconName } from "@/app/components/icons";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    await connection(); // วันนี้ (todayTH) ต้องคิดตอน request ไม่ใช่ตอน prerender
    return (
      <TenantHome
        name="ผู้เช่าตัวอย่าง"
        rooms="101"
        outstanding={3850}
        bills={[{ id: "demo", period: "2026-09-01", total: 3850, status: "issued", due_date: "2026-09-30" }]}
        maint={{ description: "แอร์มีน้ำหยด", status: "in_progress" }}
      />
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
  return (
    <TenantHome
      name={profile?.display_name ?? "ผู้เช่า"}
      rooms={roomNos}
      outstanding={outstanding}
      bills={(bills ?? []).map((b) => ({ id: b.id, period: String(b.period), total: Number(b.total), status: b.status, due_date: b.due_date }))}
      maint={maint?.[0] ? { description: maint[0].description, status: maint[0].status } : null}
    />
  );
}

type HomeBill = { id: string; period: string; total: number; status: string; due_date: string };

// หน้าหลักผู้เช่าตาม mockup ui/line_liff_dashboard: หัวห้อง, การ์ดยอดค้าง, ทางลัด, บิล, งานซ่อม
function TenantHome({ name, rooms, outstanding, bills, maint }: {
  name: string; rooms: string; outstanding: number; bills: HomeBill[];
  maint: { description: string | null; status: string } | null;
}) {
  const today = todayTH();
  const first = bills[0];
  const overdue = first && invoiceStatusForDisplay(first.status, first.due_date, today) === "overdue";
  const quick: [string, string, IconName][] = [
    ["/liff/meters", "มิเตอร์ไฟ-น้ำ", "meter"],
    ["/liff/documents", "สัญญาเช่า", "contract"],
    ["/liff/maintenance", "แจ้งซ่อม", "wrench"],
  ];
  return (
    <div className="space-y-4 pb-20">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Icon name="building" /></span>
          <div>
            <p className="text-lg font-bold text-slate-900">ระบบผู้เช่า</p>
            <p className="text-xs text-slate-500">สวัสดี {name}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white"><Icon name="door" className="h-4 w-4" />ห้อง {rooms}</span>
      </header>

      <section className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ${overdue ? "ring-rose-200" : "ring-slate-200"}`}>
        {overdue && (
          <p className="flex items-center gap-2 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"><Icon name="alert" className="h-4 w-4" />เกินกำหนดชำระแล้ว · ครบกำหนด {formatDateTH(first.due_date)}</p>
        )}
        <div className="p-4">
          <p className="text-sm text-slate-500">ยอดค้างชำระปัจจุบัน</p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">{formatTHB(outstanding)}</p>
          {first ? (
            <>
              {!overdue && <p className="mt-1 text-sm text-slate-500">ครบกำหนด {formatDateTH(first.due_date)}</p>}
              <Link href={`/liff/bills/${first.id}`} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white hover:bg-blue-800">
                <Icon name="receipt" />ดูบิลและชำระเงิน
              </Link>
            </>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Icon name="check" className="h-4 w-4" />ชำระครบแล้ว ไม่มีบิลค้าง</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-600">ทางลัด</h2>
        <div className="grid grid-cols-4 gap-2">
          {quick.map(([href, label, icon]) => (
            <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-blue-300">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name={icon} /></span>
              {label}
            </Link>
          ))}
          <a href="tel:053276631" className="flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:ring-blue-300">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name="phone" /></span>
            ติดต่อหอพัก
          </a>
        </div>
      </section>

      <Card title="บิลที่ยังไม่ชำระ">
        {bills.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีบิลรอชำระ</p>
        ) : (
          <ul className="space-y-2">
            {bills.map((b) => {
              const st = invoiceStatusForDisplay(b.status, b.due_date, today);
              return (
                <li key={b.id}>
                  <Link href={`/liff/bills/${b.id}`} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 hover:ring-blue-300">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${st === "overdue" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}><Icon name="receipt" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-900">งวด {b.period.slice(0, 7)}</span>
                      <span className="block text-xs text-slate-500">ครบกำหนด {formatDateTH(b.due_date)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold tabular-nums text-slate-900">{formatTHB(b.total)}</span>
                      <Badge tone={st === "overdue" ? "red" : "amber"}>{INVOICE_STATUS_LABEL[st as keyof typeof INVOICE_STATUS_LABEL] ?? b.status}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="งานแจ้งซ่อมล่าสุด" action={<Link href="/liff/maintenance" className="text-sm font-semibold text-blue-700">ดูทั้งหมด</Link>}>
        {!maint ? (
          <p className="text-sm text-slate-500">ยังไม่มีงานซ่อม</p>
        ) : (
          <p className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-slate-800"><Icon name="wrench" className="h-4 w-4 text-blue-700" />{maint.description ?? "งานซ่อม"}</span>
            <Badge tone="amber">{MAINT_STATUS_LABEL[maint.status as keyof typeof MAINT_STATUS_LABEL] ?? maint.status}</Badge>
          </p>
        )}
      </Card>
      <LiffNav />
    </div>
  );
}
