import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { MOCK_ROOMS } from "@/lib/mock";

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">บันทึกมิเตอร์</h1>
          <p className="text-sm text-gray-500">จดเลขเป็นชุด ตรวจเลขผิดก่อนส่งออกบิล — งวด ต.ค. 2569</p>
        </div>
        <button
          type="button"
          disabled
          title="ต้องเชื่อมฐานข้อมูลจริงก่อน (ข้ามไปก่อน)"
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
        >
          บันทึกข้อมูล (รอฐานข้อมูล)
        </button>
      </div>
      <DemoBanner text="ฟอร์มกรอกเลขจะบันทึกได้เมื่อเชื่อม Supabase แล้ว — เลขใหม่ต่ำกว่าเลขเดิมต้องหยุดตรวจ" />
      <Card title="สรุปงวดนี้" desc="บันทึกแล้ว 3 · ยังไม่บันทึก 2 · ต้องตรวจ 1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MOCK_ROOMS.map((r) => (
            <div key={r.id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
              <div className="flex items-center justify-between">
                <p className="font-semibold">ห้อง {r.room_no}</p>
                <Badge tone={r.room_no === "205" ? "amber" : "green"}>
                  {r.room_no === "205" ? "ต้องตรวจ" : "บันทึกแล้ว"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500">เลขเดิม [เลขเดิม] → เลขใหม่ [กรอก] · หน่วย [คำนวณ]</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

