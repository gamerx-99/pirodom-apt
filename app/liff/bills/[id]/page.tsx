import Link from "next/link";
import { Badge, Card } from "@/app/components/ui";
import { formatTHB } from "@/lib/format";

export default async function Page({ params }: PageProps<"/liff/bills/[id]">) {
  const { id } = await params;
  return (
    <div className="space-y-4 pb-20">
      <Link href="/liff" className="text-sm font-semibold text-teal-700">← กลับหน้าหลัก</Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">บิลห้อง 101 · ต.ค. 2569</h1>
        <p className="text-sm text-gray-500">รหัส {id} · ออก 25 ก.ย. · ครบ 30 ก.ย. 2569</p>
      </div>
      <Card title="ยอดที่ต้องชำระ">
        <div className="flex items-center justify-between">
          <p className="text-3xl font-bold">{formatTHB(3720)}</p>
          <Badge tone="amber">รอชำระ</Badge>
        </div>
      </Card>
      <Card title="รายการคิดเงิน">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>ค่าเช่า</span><span>{formatTHB(3500)}</span></li>
          <li className="flex justify-between"><span>ค่าน้ำเหมาจ่าย</span><span>{formatTHB(100)}</span></li>
          <li className="flex justify-between"><span>ค่าไฟ 87 หน่วย × 8 บาท (305→392)</span><span>{formatTHB(696)}</span></li>
          <li className="flex justify-between text-gray-500"><span>ส่วนลด</span><span>-{formatTHB(576)}</span></li>
          <li className="flex justify-between border-t border-gray-100 pt-2 font-bold"><span>รวม</span><span>{formatTHB(3720)}</span></li>
        </ul>
      </Card>
      <Card title="ชำระเงิน" desc="โอนตามบัญชีที่ยืนยัน แล้วส่งสลิป">
        <p className="text-sm">[ชื่อบัญชี] · [พร้อมเพย์] (QR Code จะแสดงเมื่อตั้งค่าบัญชีรับเงิน)</p>
        <label className="mt-3 block text-sm">
          แนบสลิป
            <input type="file" accept="image/*" className="mt-1 w-full text-sm" />
        </label>
        <button
          type="button"
          disabled
          title="ต้องเชื่อม Supabase + บริการตรวจสลิปก่อน"
          className="mt-3 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white opacity-50"
        >
          ส่งสลิปเพื่อตรวจสอบ (รอเชื่อมต่อ)
        </button>
        <p className="mt-2 text-xs text-gray-400">การส่งสลิปยังไม่ใช่การชำระเสร็จสมบูรณ์: อยู่ระหว่างรอเจ้าหน้าที่ตรวจสอบยอดเงิน</p>
      </Card>
    </div>
  );
}

