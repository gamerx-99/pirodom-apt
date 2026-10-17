import { Badge, Card, DemoBanner } from "@/app/components/ui";

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่า</h1>
        <p className="text-sm text-gray-500">ข้อมูลหอ บัญชีรับเงิน และการเชื่อมต่อ</p>
      </div>
      <DemoBanner text="หน้านี้ไม่แสดงคีย์ลับ: การตั้งค่าระบบจะตรวจสอบผ่านสถานะการเชื่อมต่อจริง" />
      <Card title="ข้อมูลหอ" desc="ชื่อหอพักและช่องทางติดต่อ: บันทึกได้เมื่อเชื่อมต่อฐานข้อมูล">
        <p className="text-sm text-gray-500">[ชื่อหอ] · [เบอร์ติดต่อ] · [ที่อยู่]</p>
      </Card>
      <Card title="ข้อมูลรับเงิน" desc="บัญชี/PromptPay ที่ลูกค้ายืนยัน">
        <p className="text-sm text-gray-500">[ชื่อบัญชี] · [ธนาคาร/พร้อมเพย์] (การแก้ไขต้องตรวจสอบก่อนยืนยัน)</p>
      </Card>
      <Card title="สถานะการเชื่อมต่อ" desc="ตรวจสอบจากระบบ /api/health: รายการที่ยังไม่ตั้งค่าจะแสดงสถานะปิดใช้งาน">
        <div className="flex flex-wrap gap-2">
          <Badge tone="gray">Supabase: ยังไม่ได้เชื่อมต่อ</Badge>
          <Badge tone="gray">LINE: ยังไม่ได้เชื่อมต่อ</Badge>
          <Badge tone="gray">ตรวจสลิป: ยังไม่ได้เปิดใช้งาน</Badge>
        </div>
      </Card>
    </div>
  );
}

