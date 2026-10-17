import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { MOCK_ROOMS, ROOM_STATUS_LABEL } from "@/lib/mock";

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ห้องพักและร้านค้า</h1>
          <p className="text-sm text-gray-500">จัดการยูนิตและดูความพร้อมให้เช่า</p>
        </div>
        <button
          type="button"
          disabled
          title="ต้องเชื่อมฐานข้อมูลจริงก่อน (ข้ามไปก่อน)"
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
        >
          เพิ่มยูนิต (รอฐานข้อมูล)
        </button>
      </div>
      <DemoBanner text="ปุ่มเพิ่ม/แก้ไขจะเปิดเมื่อเชื่อม Supabase แล้ว" />
      <Card title={`ยูนิตทั้งหมด ${MOCK_ROOMS.length}`} desc="สถานะห้องแยกจากสถานะชำระเงิน">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_ROOMS.map((r) => (
            <div key={r.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-gray-900">{r.room_no}</p>
                <Badge tone={r.status === "occupied" ? "green" : r.status === "vacant" ? "blue" : "gray"}>
                  {ROOM_STATUS_LABEL[r.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {r.unit_type === "commercial" ? "ร้านค้า" : "ห้องพัก"}
                {r.floor ? ` · ชั้น ${r.floor}` : ""} · {r.tenant ?? "ยังไม่มีผู้เช่า"}
              </p>
              <p className="mt-2 text-xs text-gray-400">ราคา/สัญญาดูที่หน้าสัญญา — ไม่เก็บราคาค้างในข้อมูลห้อง</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

