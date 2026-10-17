import Link from "next/link";
import { Badge, Card, DemoBanner, StatCard } from "@/app/components/ui";
import {
  INVOICE_STATUS_LABEL,
  MAINT_STATUS_LABEL,
  MOCK_INVOICES,
  MOCK_MAINTENANCE,
  MOCK_PAYMENTS,
  MOCK_ROOMS,
  ROOM_STATUS_LABEL,
} from "@/lib/mock";
import { formatTHB } from "@/lib/format";

const TASKS: Array<[string, string, string]> = [
  ["สลิปรอตรวจ", "2", "/admin/payments"],
  ["บิลเกินกำหนด", "1", "/admin/billing"],
  ["งานซ่อมรอรับเรื่อง", "1", "/admin/maintenance"],
  ["มิเตอร์ยังไม่บันทึก", "2", "/admin/meters"],
  ["บิลใกล้ครบกำหนด", "1", "/admin/billing"],
  ["สัญญาใกล้หมดอายุ", "0", "/admin/leases"],
];

export default function Page() {
  const occupied = MOCK_ROOMS.filter((r) => r.status === "occupied").length;
  const billed = MOCK_INVOICES.filter((i) => i.status !== "draft" && i.status !== "void").reduce(
    (s, i) => s + i.total,
    0,
  );
  const paid = MOCK_INVOICES.filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);
  const overdueCount = MOCK_INVOICES.filter((i) => i.status === "overdue").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ภาพรวม</h1>
          <p className="text-sm text-gray-500">สถานะห้อง ยอดเงิน และงานที่ต้องจัดการ ประจำเดือน ต.ค. 2569</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/billing"
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            สร้างบิล
          </Link>
          <Link
            href="/admin/meters"
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50"
          >
            บันทึกมิเตอร์
          </Link>
        </div>
      </div>
      <DemoBanner />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ยอดเรียกเก็บ" value={formatTHB(billed)} sub="ไม่รวมร่าง/ยกเลิก" />
        <StatCard label="รับชำระแล้ว" value={formatTHB(paid)} sub="เฉพาะที่อนุมัติแล้ว" />
        <StatCard label="ค้างชำระ" value={formatTHB(billed - paid)} sub={`เกินกำหนด ${overdueCount} บิล`} />
        <StatCard label="ห้องมีผู้เช่า" value={`${occupied}/${MOCK_ROOMS.length}`} sub="ยูนิตตัวอย่าง" />
      </div>
      <Card title="งานที่ต้องจัดการ" desc="แตะเพื่อไปหน้าปลายทาง">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {TASKS.map(([label, count, href]) => (
            <Link key={label} href={href} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100 hover:bg-teal-50">
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-sm text-gray-600">{label}</p>
            </Link>
          ))}
        </div>
      </Card>
      <Card title="สถานะยูนิต" desc="ข้อมูลตัวอย่าง">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_ROOMS.map((r) => (
            <Link key={r.id} href="/admin/rooms" className="rounded-xl border border-gray-100 p-3 hover:border-teal-200">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{r.room_no}</p>
                <Badge tone={r.status === "occupied" ? "green" : r.status === "vacant" ? "blue" : "gray"}>
                  {ROOM_STATUS_LABEL[r.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">{r.tenant ?? "ยังไม่มีผู้เช่า"}</p>
            </Link>
          ))}
        </div>
      </Card>
      <Card title="บิลที่ต้องติดตาม" desc="เกินกำหนดและใกล้ครบกำหนดก่อน">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">ห้อง</th>
                <th className="py-2 pr-3">งวด</th>
                <th className="py-2 pr-3">ครบกำหนด</th>
                <th className="py-2 pr-3 text-right">ยอด</th>
                <th className="py-2 pr-3">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_INVOICES.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="py-2 pr-3 font-medium">{i.room_no}</td>
                  <td className="py-2 pr-3">{i.period}</td>
                  <td className="py-2 pr-3">{i.due_date}</td>
                  <td className="py-2 pr-3 text-right">{formatTHB(i.total)}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={i.status === "paid" ? "green" : i.status === "overdue" ? "red" : "amber"}>
                      {INVOICE_STATUS_LABEL[i.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="งานซ่อมล่าสุด" action={<Link href="/admin/maintenance" className="text-sm font-semibold text-teal-700">ดูทั้งหมด</Link>}>
        <ul className="space-y-2">
          {MOCK_MAINTENANCE.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm">
              <span>ห้อง {m.room_no} · {m.category} · {m.description}</span>
              <Badge tone={m.status === "pending" ? "amber" : "blue"}>{MAINT_STATUS_LABEL[m.status]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-gray-400">คิวสลิปตัวอย่าง {MOCK_PAYMENTS.length} รายการ (ตรวจสอบได้ที่หน้าตรวจสลิป)</p>
    </div>
  );
}

