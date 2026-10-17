import Link from "next/link";
import { Badge, Card } from "@/app/components/ui";
import LiffNav from "./components/nav";
import { INVOICE_STATUS_LABEL, MAINT_STATUS_LABEL } from "@/lib/mock";
import { formatTHB } from "@/lib/format";

export default function Page() {
  return (
    <div className="space-y-4 pb-20">
      <div>
        <p className="text-sm text-gray-500">[ชื่อหอ]</p>
        <h1 className="text-xl font-bold text-gray-900">สวัสดี [ชื่อผู้เช่า] · ห้อง 101</h1>
      </div>
      <Card title="ยอดค้างชำระ" desc="ครบกำหนด 30 ก.ย. 2569 · เหลือ 0 วัน">
        <p className="text-3xl font-bold text-gray-900">{formatTHB(3850)}</p>
        <Link
          href="/liff/bills/inv-2"
          className="mt-3 block rounded-xl bg-teal-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-700"
        >
          ดูบิลและชำระเงิน
        </Link>
      </Card>
      <Card title="บิลของฉัน" desc="แยกบิลรอตรวจกับบิลรอชำระ">
        <ul className="space-y-2 text-sm">
          <li className="flex items-center justify-between gap-2">
            <span>ต.ค. 2569 · {formatTHB(3720)}</span>
            <Badge tone="amber">{INVOICE_STATUS_LABEL.issued}</Badge>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>ก.ย. 2569 · {formatTHB(3680)}</span>
            <Badge tone="amber">{INVOICE_STATUS_LABEL.verifying}</Badge>
          </li>
        </ul>
      </Card>
      <Card title="ทางลัด">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link href="/liff/meters" className="rounded-xl bg-gray-50 p-3 text-center">ประวัติมิเตอร์</Link>
          <Link href="/liff/documents" className="rounded-xl bg-gray-50 p-3 text-center">เอกสาร</Link>
          <Link href="/liff/maintenance" className="rounded-xl bg-gray-50 p-3 text-center">แจ้งซ่อม</Link>
          <Link href="/liff/bills/inv-2" className="rounded-xl bg-gray-50 p-3 text-center">บิลล่าสุด</Link>
        </div>
      </Card>
      <Card title="การใช้ไฟ" desc="87 หน่วย · ก.ย. → ต.ค.">
        <div className="flex h-24 items-end gap-2">
          {[80, 75, 87].map((v, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-teal-200" style={{ height: `${(v / 87) * 100}%` }} />
          ))}
        </div>
        <Link href="/liff/meters" className="mt-2 block text-sm font-semibold text-teal-700">ดูรายละเอียด</Link>
      </Card>
      <Card title="งานซ่อมล่าสุด">
        <p className="flex items-center justify-between text-sm">
          <span>ปลั๊กไฟห้องนอนไม่ติด</span>
          <Badge tone="amber">{MAINT_STATUS_LABEL.pending}</Badge>
        </p>
      </Card>
      <LiffNav />
    </div>
  );
}

