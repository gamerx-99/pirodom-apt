import Link from "next/link";
import { Badge, Card, DemoBanner, EmptyState, StatCard } from "@/app/components/ui";
import {
  INVOICE_STATUS_LABEL,
  MAINT_STATUS_LABEL,
  MOCK_INVOICES,
  MOCK_MAINTENANCE,
  MOCK_PAYMENTS,
  MOCK_ROOMS,
  ROOM_STATUS_LABEL,
} from "@/lib/mock";
import { formatDateTH, formatTHB, invoiceStatusForDisplay, todayTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { OPEN_PAYMENT_STATUSES } from "@/lib/payment-status";

const DEMO_TASKS: Array<[string, string, string]> = [
  ["สลิปรอตรวจ", "2", "/admin/payments"],
  ["บิลเกินกำหนด", "1", "/admin/billing"],
  ["งานซ่อมรอรับเรื่อง", "1", "/admin/maintenance"],
  ["มิเตอร์ยังไม่บันทึก", "2", "/admin/meters"],
  ["บิลใกล้ครบกำหนด", "1", "/admin/billing"],
  ["สัญญาใกล้หมดอายุ", "0", "/admin/leases"],
];

type InvoiceRow = {
  id: string;
  period: string;
  due_date: string;
  total: number;
  status: string;
  leases: { rooms: { room_no: string } | null } | null;
};

type MaintenanceRow = {
  id: string;
  category: string;
  status: string;
  created_at: string;
  rooms: { room_no: string } | null;
};

export default async function Page() {
  if (isSupabaseConfigured()) return <LiveDashboard />;
  return <DemoDashboard />;
}

async function LiveDashboard() {
  const supabase = await createClient();
  const [
    { data: rooms, error: roomsError },
    { data: invoicesRaw, error: invoicesError },
    { count: issuedCount, error: issuedError },
    { count: paidCount, error: paidError },
    { count: overdueStored, error: overdueStoredError },
    { count: overdueByDate, error: overdueByDateError },
    { count: openPayments, error: paymentsError },
    { count: openMaintenance, error: maintenanceCountError },
    { data: maintenanceRaw, error: maintenanceError },
  ] = await Promise.all([
    supabase.from("rooms").select("id,room_no,unit_type,floor,status").order("room_no"),
    supabase
      .from("invoices")
      .select("id,period,due_date,total,status,leases(rooms(room_no))")
      .neq("status", "draft")
      .neq("status", "void")
      .order("due_date", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .neq("status", "draft")
      .neq("status", "void"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "issued")
      .lt("due_date", todayTH()),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_PAYMENT_STATUSES]),
    supabase
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed"),
    supabase
      .from("maintenance_requests")
      .select("id,category,status,created_at,rooms(room_no)")
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (
    roomsError || invoicesError || issuedError || paidError || overdueStoredError || overdueByDateError ||
    paymentsError || maintenanceCountError || maintenanceError
  ) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ภาพรวม</h1>
        <Card title="โหลดภาพรวมไม่สำเร็จ">
          <p className="text-sm text-red-700">ข้อมูลบางส่วนอ่านไม่ได้ กรุณารีเฟรชหน้านี้หรือตรวจสิทธิ์ฐานข้อมูล</p>
        </Card>
      </div>
    );
  }

  const liveRooms = rooms ?? [];
  const invoices = (invoicesRaw ?? []) as unknown as InvoiceRow[];
  const maintenance = (maintenanceRaw ?? []) as unknown as MaintenanceRow[];
  const occupied = liveRooms.filter((room) => room.status === "occupied").length;
  const overdueCount = (overdueStored ?? 0) + (overdueByDate ?? 0);
  const tasks: Array<[string, string, string]> = [
    ["สลิปรอตรวจ", String(openPayments ?? 0), "/admin/payments"],
    ["บิลค้างชำระ", String(overdueCount), "/admin/billing"],
    ["งานซ่อมที่ยังเปิด", String(openMaintenance ?? 0), "/admin/maintenance"],
    ["ยูนิตทั้งหมด", String(liveRooms.length), "/admin/rooms"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ภาพรวม</h1>
          <p className="text-sm text-gray-500">ตัวเลขจากฐานข้อมูลปัจจุบัน</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/billing" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">ดูบิล</Link>
          <Link href="/admin/meters" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">บันทึกมิเตอร์</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="บิลที่ออกแล้ว" value={`${issuedCount ?? 0} รายการ`} sub="ไม่รวมร่าง/ยกเลิก" icon="receipt" />
        <StatCard label="ชำระแล้ว" value={`${paidCount ?? 0} บิล`} sub="สถานะอนุมัติแล้ว" icon="check" tone="green" />
        <StatCard label="บิลค้างชำระ" value={`${overdueCount} บิล`} sub="เลยวันครบกำหนดหรือมีสถานะค้างชำระ" icon="alert" tone={overdueCount > 0 ? "red" : "default"} />
        <StatCard label="ห้องมีผู้เช่า" value={`${occupied}/${liveRooms.length}`} sub="ตามสถานะยูนิตในระบบ" icon="building" tone="blue" />
      </div>
      <Card title="งานที่ต้องจัดการ" desc="จำนวนจากข้อมูลจริงในฐานข้อมูล">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tasks.map(([label, count, href]) => (
            <Link key={label} href={href} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-blue-300">
              <span className="text-sm font-semibold text-slate-800">{label}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${count === "0" ? "bg-slate-100 text-slate-500" : "bg-blue-600 text-white"}`}>{count}</span>
            </Link>
          ))}
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="บิลล่าสุด" desc="แสดงไม่เกิน 5 บิลล่าสุดที่ออกแล้ว">
          {invoices.length === 0 ? <EmptyState title="ยังไม่มีบิลที่ออกแล้ว" desc="บิลร่างและบิลยกเลิกไม่แสดงในภาพรวมนี้" /> : (
            <ul className="space-y-2">
              {invoices.map((invoice) => {
                const status = invoiceStatusForDisplay(invoice.status, invoice.due_date, todayTH());
                return (
                  <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-semibold">ห้อง {invoice.leases?.rooms?.room_no ?? "—"} · งวด {invoice.period.slice(0, 7)}</p>
                      <p className="text-xs text-gray-500">ครบกำหนด {formatDateTH(invoice.due_date)} · {formatTHB(Number(invoice.total))}</p>
                    </div>
                    <Badge tone={status === "paid" ? "green" : status === "overdue" ? "red" : "amber"}>
                      {INVOICE_STATUS_LABEL[status as keyof typeof INVOICE_STATUS_LABEL] ?? status}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="งานซ่อมที่ยังเปิด" desc="รายการล่าสุดที่ยังไม่ปิด">
          {maintenance.length === 0 ? <EmptyState title="ไม่มีงานซ่อมค้าง" /> : (
            <ul className="space-y-2">
              {maintenance.map((request) => (
                <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-semibold">ห้อง {request.rooms?.room_no ?? "—"} · {request.category}</p>
                    <p className="text-xs text-gray-500">แจ้ง {formatDateTH(request.created_at)}</p>
                  </div>
                  <Badge tone={request.status === "pending" ? "amber" : "blue"}>
                    {MAINT_STATUS_LABEL[request.status as keyof typeof MAINT_STATUS_LABEL] ?? request.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/maintenance" className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline">ไปหน้างานซ่อม →</Link>
        </Card>
      </div>
    </div>
  );
}

function DemoDashboard() {
  const occupied = MOCK_ROOMS.filter((room) => room.status === "occupied").length;
  const billed = MOCK_INVOICES.filter((invoice) => invoice.status !== "draft" && invoice.status !== "void").reduce(
    (sum, invoice) => sum + invoice.total,
    0,
  );
  const paid = MOCK_INVOICES.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.total, 0);
  const overdueCount = MOCK_INVOICES.filter((invoice) => invoice.status === "overdue").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ภาพรวม</h1>
          <p className="text-sm text-gray-500">สถานะห้อง ยอดเงิน และงานที่ต้องจัดการ · ข้อมูลตัวอย่าง</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/billing" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">สร้างบิล</Link>
          <Link href="/admin/meters" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50">บันทึกมิเตอร์</Link>
        </div>
      </div>
      <DemoBanner />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ยอดเรียกเก็บ" value={formatTHB(billed)} sub="ไม่รวมร่าง/ยกเลิก" icon="receipt" />
        <StatCard label="รับชำระแล้ว" value={formatTHB(paid)} sub="เฉพาะที่อนุมัติแล้ว" icon="check" tone="green" />
        <StatCard label="ค้างชำระ" value={formatTHB(billed - paid)} sub={`เกินกำหนด ${overdueCount} บิล`} icon="clock" tone="amber" />
        <StatCard label="ห้องมีผู้เช่า" value={`${occupied}/${MOCK_ROOMS.length}`} sub="ยูนิตตัวอย่าง" icon="building" tone="blue" />
      </div>
      <Card title="งานที่ต้องจัดการ" desc="ข้อมูลตัวอย่าง">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {DEMO_TASKS.map(([label, count, href]) => (
            <Link key={label} href={href} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 hover:ring-blue-300">
              <span className="text-sm font-semibold text-slate-800">{label}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${count === "0" ? "bg-slate-100 text-slate-500" : "bg-blue-600 text-white"}`}>{count}</span>
            </Link>
          ))}
        </div>
      </Card>
      <Card title="สถานะยูนิต" desc="ข้อมูลตัวอย่าง">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_ROOMS.map((room) => (
            <Link key={room.id} href="/admin/rooms" className="rounded-xl border border-gray-100 p-3 hover:border-blue-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{room.room_no}</p>
                <Badge tone={room.status === "occupied" ? "green" : room.status === "vacant" ? "blue" : "gray"}>{ROOM_STATUS_LABEL[room.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">{room.unit_type === "commercial" ? "ร้านค้า" : "ห้องพัก"}{room.floor ? ` · ชั้น ${room.floor}` : ""} · {room.tenant ?? "ยังไม่มีผู้เช่า"}</p>
            </Link>
          ))}
        </div>
      </Card>
      <Card title="งานซ่อมล่าสุด" action={<Link href="/admin/maintenance" className="text-sm font-semibold text-blue-700">ดูทั้งหมด</Link>}>
        <ul className="space-y-2">
          {MOCK_MAINTENANCE.map((request) => (
            <li key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm">
              <span>ห้อง {request.room_no} · {request.category} · {request.description}</span>
              <Badge tone={request.status === "pending" ? "amber" : "blue"}>{MAINT_STATUS_LABEL[request.status]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-gray-400">คิวสลิปตัวอย่าง {MOCK_PAYMENTS.length} รายการ (ตรวจสอบได้ที่หน้าตรวจสลิป)</p>
    </div>
  );
}
