import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { INVOICE_STATUS_LABEL, MOCK_INVOICES } from "@/lib/mock";
import { formatTHB } from "@/lib/format";

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">บิล</h1>
          <p className="text-sm text-gray-500">ตรวจยอดก่อนออก ติดตามหนี้ และดูประวัติ ประจำงวด ต.ค. 2569</p>
        </div>
        <button
          type="button"
          disabled
          title="ต้องเชื่อมฐานข้อมูลจริงก่อน (ข้ามไปก่อน)"
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
        >
          สร้างบิล (รอฐานข้อมูล)
        </button>
      </div>
      <DemoBanner text="ยอดจริงและการออกบิลคำนวณจากระบบ: เงื่อนไขค่าปรับยังไม่ได้เปิดใช้งาน" />
      <Card title={`บิลทั้งหมด ${MOCK_INVOICES.length}`} desc="ไม่รวมร่าง/ยกเลิกในยอดเรียกเก็บ">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">ห้อง</th>
                <th className="py-2 pr-3">ผู้เช่า</th>
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
                  <td className="py-2 pr-3">{i.tenant}</td>
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
    </div>
  );
}

