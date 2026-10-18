"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/app/components/icons";

const NAV: [string, string, IconName][] = [
  ["/admin", "ภาพรวม", "dashboard"],
  ["/admin/rooms", "ห้องพัก", "building"],
  ["/admin/leases", "สัญญา", "contract"],
  ["/admin/meters", "จดมิเตอร์", "meter"],
  ["/admin/billing", "บิลและใบแจ้งหนี้", "receipt"],
  ["/admin/payments", "ตรวจสลิป LINE", "check"],
  ["/admin/maintenance", "งานซ่อมบำรุง", "wrench"],
  ["/admin/messages", "ส่งข้อความ", "message"],
  ["/admin/documents", "เอกสาร", "folder"],
  ["/admin/settings", "ตั้งค่าระบบ", "settings"],
];

// เมนูข้างตาม mockup ui/: พื้นดำ ตัวอักษรขาว รายการที่เปิดอยู่ไฮไลต์น้ำเงิน
export function AdminNav({ demo = false }: { demo?: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="เมนูผู้ดูแล" className="flex w-full shrink-0 flex-col gap-4 bg-slate-950 p-3 text-slate-300 lg:sticky lg:top-0 lg:h-dvh lg:w-[260px] lg:gap-6 lg:p-4">
      <div className="flex items-center gap-3 px-2 lg:pt-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Icon name="building" />
        </span>
        <span className="flex flex-col">
          <span className="text-base font-bold text-white">ระบบจัดการหอพัก</span>
          <span className="text-xs text-slate-400">เจ้าของ / แอดมิน</span>
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
        {NAV.map(([href, label, icon]) => {
          const active = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-l-4 border-blue-500 bg-blue-600/20 font-semibold text-white"
                  : "font-medium hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={icon} className={`h-5 w-5 ${active ? "text-blue-400" : ""}`} />
              {label}
            </Link>
          );
        })}
        <form action="/api/auth/logout" method="POST" className="shrink-0 lg:hidden">
          <button
            type="submit"
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <Icon name="logout" className="h-5 w-5" />
            <span>ออก</span>
          </button>
        </form>
      </div>
      <div className="hidden border-t border-white/10 pt-4 lg:mt-auto lg:block">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Icon name="logout" className="h-5 w-5" />
            ออกจากระบบ
          </button>
        </form>
        <Link href="/api/health" className="mt-2 block px-3 text-xs text-slate-500 hover:text-white">
          {demo ? "สถานะระบบ (demo)" : "สถานะระบบ"}
        </Link>
      </div>
    </nav>
  );
}
