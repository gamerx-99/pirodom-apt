import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { MOCK_ROOMS } from "@/lib/mock";

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">สัญญาเช่า</h1>
          <p className="text-sm text-gray-500">เงื่อนไขรายสัญญา ผู้เช่าร่วม และลิงก์เชิญ</p>
        </div>
        <button
          type="button"
          disabled
          title="ต้องเชื่อมฐานข้อมูลจริงก่อน (ข้ามไปก่อน)"
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white opacity-50"
        >
          สร้างสัญญา (รอฐานข้อมูล)
        </button>
      </div>
      <DemoBanner text="ฟอร์มสัญญาและลิงก์เชิญ QR จะใช้งานได้เมื่อเชื่อม Supabase แล้ว" />
      <Card title="สัญญาตัวอย่าง" desc="due_day 31 = วันสุดท้ายของเดือน">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-2 pr-3">ห้อง</th>
                <th className="py-2 pr-3">ผู้เช่าหลัก</th>
                <th className="py-2 pr-3">วันเริ่ม</th>
                <th className="py-2 pr-3">ครบกำหนด</th>
                <th className="py-2 pr-3">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="py-2 pr-3 font-medium">101</td>
                <td className="py-2 pr-3">คุณสมชาย</td>
                <td className="py-2 pr-3">1 ต.ค. 2569</td>
                <td className="py-2 pr-3">วันสุดท้ายของเดือน</td>
                <td className="py-2 pr-3"><Badge tone="green">active</Badge></td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-2 pr-3 font-medium">205</td>
                <td className="py-2 pr-3">คุณมานะ</td>
                <td className="py-2 pr-3">10 ต.ค. 2569</td>
                <td className="py-2 pr-3">วันที่ 10</td>
                <td className="py-2 pr-3"><Badge tone="green">active</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="เชิญผู้เช่า" desc="ลิงก์มีอายุ 7 วัน ใช้ครั้งเดียว — เปิดเมื่อมีฐานข้อมูลจริง">
        <p className="text-sm text-gray-500">
          ยูนิตพร้อมเชิญ {MOCK_ROOMS.length} ยูนิต · ระบบจะเก็บเฉพาะ hash ไม่แสดง token
        </p>
      </Card>
    </div>
  );
}

