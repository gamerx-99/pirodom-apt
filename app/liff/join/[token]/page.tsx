import Link from "next/link";
import { Card } from "@/app/components/ui";

// TODO Phase 1: ยืนยันชื่อ/เบอร์โทร แล้วส่ง token ไปผูก lease_tenants ฝั่ง server
export default function Page() {
  return (
    <div className="space-y-4 pb-20">
      <div>
        <p className="text-sm text-gray-500">[ชื่อหอ]</p>
        <h1 className="text-xl font-bold text-gray-900">ยืนยันการผูกบัญชี</h1>
        <p className="text-sm text-gray-500">ตรวจลิงก์เชิญโดย Server — อายุ 7 วัน ใช้ครั้งเดียว</p>
      </div>
      <Card title="ห้องที่เชิญ" desc="แสดงหลัง Server ยืนยันว่ามีสิทธิ์ดูคำเชิญ">
        <p className="text-sm">ห้อง [เลขห้อง] · [ประเภท] · เริ่ม [วันที่]</p>
      </Card>
      <Card title="ยืนยันตัวตน">
        <label className="block text-sm">
          ชื่อ-นามสกุล
          <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="[ชื่อ]" />
        </label>
        <label className="mt-3 block text-sm">
          เบอร์โทร
          <input className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" placeholder="08x-xxx-xxxx" />
        </label>
        <button
          type="button"
          disabled
          title="ต้องเชื่อม Supabase + LINE ก่อน"
          className="mt-4 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white opacity-50"
        >
          ยืนยันผูกบัญชี (รอเชื่อมต่อ)
        </button>
      </Card>
      <Card title="ลิงก์มีปัญหา?">
        <p className="text-sm text-gray-500">ลิงก์ผิด หมดอายุ ใช้แล้ว หรือถูกเพิกถอน — ขอลิงก์ใหม่จากผู้ดูแล</p>
        <Link href="/liff" className="mt-2 block text-sm font-semibold text-teal-700">ไปหน้าหลัก</Link>
      </Card>
    </div>
  );
}

