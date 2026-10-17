import { Badge, Card, DemoBanner } from "@/app/components/ui";
import LiffNav from "../components/nav";
import { MAINT_STATUS_LABEL, MOCK_MAINTENANCE } from "@/lib/mock";

export default function Page() {
  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">แจ้งซ่อม</h1>
          <p className="text-sm text-gray-500">แจ้งปัญหาและติดตามจนปิดงาน</p>
        </div>
      </div>
      <DemoBanner text="ฟอร์มแจ้งซ่อมจะส่งได้เมื่อเชื่อม Supabase แล้ว" />
      <Card title="แจ้งปัญหาใหม่">
        <label className="block text-sm">
          หมวด
          <select className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2">
            <option>ไฟฟ้า</option>
            <option>ประปา</option>
            <option>แอร์</option>
            <option>เฟอร์นิเจอร์</option>
            <option>อื่นๆ</option>
          </select>
        </label>
        <label className="mt-3 block text-sm">
          รายละเอียด
          <textarea className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" rows={3} placeholder="อธิบายอาการ..." />
        </label>
        <button type="button" disabled className="mt-3 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white opacity-50">
          ส่งเรื่อง (รอเชื่อมต่อ)
        </button>
      </Card>
      <Card title="งานของฉัน">
        <ul className="space-y-2">
          {MOCK_MAINTENANCE.slice(0, 2).map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{m.category} · {m.description}</span>
              <Badge tone={m.status === "pending" ? "amber" : "blue"}>{MAINT_STATUS_LABEL[m.status]}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <LiffNav />
    </div>
  );
}

