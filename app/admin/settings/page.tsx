import { Badge, Card, DemoBanner } from "@/app/components/ui";

export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่า</h1>
        <p className="text-sm text-gray-500">ข้อมูลหอ บัญชีรับเงิน และการเชื่อมต่อ</p>
      </div>
      <DemoBanner text="หน้านี้ไม่แสดง secret — การมี env ไม่เท่ากับเชื่อมต่อสำเร็จ" />
      <Card title="ข้อมูลหอ" desc="ชื่อหอ/ช่องทางติดต่อ — บันทึกได้เมื่อมี backend">
        <p className="text-sm text-gray-500">[ชื่อหอ] · [เบอร์ติดต่อ] · [ที่อยู่]</p>
      </Card>
      <Card title="ข้อมูลรับเงิน" desc="บัญชี/PromptPay ที่ลูกค้ายืนยัน">
        <p className="text-sm text-gray-500">[ชื่อบัญชี] · [ธนาคาร/พร้อมเพย์] — เปลี่ยนต้อง preview ก่อนยืนยัน</p>
      </Card>
      <Card title="สถานะการเชื่อมต่อ" desc="อ่านจาก /api/health — ยังไม่ตั้งค่า = ข้ามไปก่อน">
        <div className="flex flex-wrap gap-2">
          <Badge tone="gray">Supabase: ยังไม่ตั้งค่า</Badge>
          <Badge tone="gray">LINE: ยังไม่ตั้งค่า</Badge>
          <Badge tone="gray">ตรวจสลิป: ยังไม่ได้ยืนยันผู้ให้บริการ</Badge>
          <Badge tone="gray">Cron: ยังไม่ตั้งค่า</Badge>
        </div>
      </Card>
    </div>
  );
}

