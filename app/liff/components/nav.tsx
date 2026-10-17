import Link from "next/link";

export default function LiffNav() {
  const items: Array<[string, string]> = [
    ["/liff", "หน้าหลัก"],
    ["/liff/meters", "มิเตอร์"],
    ["/liff/documents", "เอกสาร"],
    ["/liff/maintenance", "แจ้งซ่อม"],
  ];
  return (
    <nav aria-label="เมนูผู้เช่า" className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {items.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="px-2 py-3 text-center text-sm font-medium text-gray-600 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
