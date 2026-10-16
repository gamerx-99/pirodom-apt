import Link from "next/link";

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/rooms", "ห้องพัก"],
  ["/admin/leases", "สัญญา"],
  ["/admin/meters", "มิเตอร์"],
  ["/admin/billing", "บิล"],
  ["/admin/payments", "ตรวจสลิป"],
  ["/admin/maintenance", "งานซ่อม"],
  ["/admin/settings", "ตั้งค่า"],
] as const;

// TODO Phase 1: กันหน้า admin ให้เฉพาะ role owner/admin
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full">
      <nav className="flex w-48 flex-col gap-2 border-r p-4">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
