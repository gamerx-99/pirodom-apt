import Link from "next/link";
import { Card } from "@/app/components/ui";

export default function RetiredInviteLinkPage() {
  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold text-gray-900">เปลี่ยนวิธียืนยันตัวตนแล้ว</h1>
      <Card title="คำเชิญแบบลิงก์ใช้ไม่ได้แล้ว" desc="ขอรหัสยืนยันจากผู้ดูแลหอพัก">
        <p className="text-sm text-gray-600">ส่งรหัสที่ได้รับให้ LINE Bot ของหอพักในแชทส่วนตัว เพื่อยืนยันตัวตนและผูกบัญชี</p>
        <Link href="/liff" className="mt-3 block text-sm font-semibold text-teal-700">ไปหน้าหลักผู้เช่า</Link>
      </Card>
    </div>
  );
}
