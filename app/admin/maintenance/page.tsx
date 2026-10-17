import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { MAINT_STATUS_LABEL, MOCK_MAINTENANCE } from "@/lib/mock";

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">งานซ่อม</h1>
        <p className="text-sm text-gray-500">คัดงานเร่งด่วน รับเรื่อง และอัปเดตความคืบหน้า</p>
      </div>
      <DemoBanner text="ปุ่มรับเรื่อง/อัปเดตสถานะจะเปิดเมื่อเชื่อม Supabase แล้ว" />
      <Card title={`งานทั้งหมด ${MOCK_MAINTENANCE.length}`} desc="รอรับเรื่องต้องมาก่อน">
        <ul className="space-y-3">
          {MOCK_MAINTENANCE.map((m) => (
            <li key={m.id} className="rounded-xl border border-gray-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">ห้อง {m.room_no} · {m.category} · {m.priority}</p>
                <Badge tone={m.status === "pending" ? "amber" : "blue"}>
                  {MAINT_STATUS_LABEL[m.status]}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-600">{m.description}</p>
              <p className="mt-1 text-xs text-gray-400">แจ้ง {m.created_at}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

