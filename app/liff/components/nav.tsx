"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/app/components/icons";

const ITEMS: [string, string, IconName][] = [
  ["/liff", "หน้าหลัก", "home"],
  ["/liff/meters", "มิเตอร์", "meter"],
  ["/liff/documents", "เอกสาร", "folder"],
  ["/liff/maintenance", "แจ้งซ่อม", "wrench"],
];

// แถบเมนูล่างตาม mockup ui/line_liff_dashboard: ไอคอน + ป้าย รายการที่เปิดอยู่เป็นแคปซูลน้ำเงิน
export default function LiffNav() {
  const path = usePathname();
  return (
    <nav aria-label="เมนูผู้เช่า" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 py-1.5">
        {ITEMS.map(([href, label, icon]) => {
          const active = href === "/liff" ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-xs font-medium ${
                active ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-blue-700"
              }`}
            >
              <Icon name={icon} className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
