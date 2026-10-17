import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { MOCK_PAYMENTS, PAYMENT_STATUS_LABEL } from "@/lib/mock";
import { formatTHB } from "@/lib/format";

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">คิวตรวจสลิป</h1>
        <p className="text-sm text-gray-500">เทียบสลิปกับบิล เห็นความผิดปกติ แล้วตัดสินใจพร้อมเหตุผล</p>
      </div>
      <DemoBanner text="ยังไม่เลือกผู้ให้บริการตรวจสลิป (Okslip/SlipOK) — ผลตรวจผ่านไม่เท่ากับอนุมัติแล้ว" />
      <Card title={`รอตรวจ ${MOCK_PAYMENTS.length} รายการ`} desc="อนุมัติ/ปฏิเสธจะเปิดเมื่อมีฐานข้อมูลจริง">
        <ul className="space-y-3">
          {MOCK_PAYMENTS.map((p) => (
            <li key={p.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">ห้อง {p.room_no} · {p.tenant}</p>
                <Badge tone={p.status === "mismatch" ? "red" : "amber"}>
                  {PAYMENT_STATUS_LABEL[p.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                ยอด {formatTHB(p.amount)} · ส่ง {p.created_at} · บิล {p.invoice_id}
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white opacity-50">
                  อนุมัติ (รอฐานข้อมูล)
                </button>
                <button type="button" disabled className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 opacity-50">
                  ปฏิเสธ (รอฐานข้อมูล)
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

