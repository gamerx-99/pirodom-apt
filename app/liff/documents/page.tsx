import { Card, DemoBanner } from "@/app/components/ui";
import LiffNav from "../components/nav";

export default function Page() {
  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">เอกสารของฉัน</h1>
        <p className="text-sm text-gray-500">ห้อง 101 · เปิดผ่านสิทธิ์สัญญาเท่านั้น</p>
      </div>
      <DemoBanner text="ไฟล์จริงจะเปิดผ่าน Signed URL เมื่อเชื่อม Supabase แล้ว" />
      <Card title="สัญญาเช่า">
        <p className="text-sm">[สัญญา ต.ค. 2569] · PDF — ปุ่มเปิดจะใช้งานได้เมื่อมีไฟล์จริง</p>
        <button type="button" disabled className="mt-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 opacity-50">
          เปิดดู (รอไฟล์จริง)
        </button>
      </Card>
      <Card title="สลิปชำระเงิน">
        <p className="text-sm">ก.ย. 2569 · รอเจ้าหน้าที่ตรวจ — เปิดรูปได้เมื่ออัปโหลดจริง</p>
      </Card>
      <LiffNav />
    </div>
  );
}

