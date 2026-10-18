"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Alerts = {
  count: number;
  items: { id: string; category: string; room: string }[];
};

export default function MaintenanceNotifications() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const response = await fetch("/api/admin/maintenance-notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("notification request failed");
        const next = (await response.json()) as Alerts;
        if (!controller.signal.aborted) {
          setAlerts(next);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAlerts(null);
          setError(true);
        }
      } finally {
        loading = false;
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return (
    <aside aria-label="แจ้งเตือนงานซ่อม" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <p role="status" aria-live="polite" className="font-semibold text-amber-950">
        {error
          ? "โหลดแจ้งเตือนงานซ่อมไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ"
          : !alerts
            ? "กำลังตรวจงานซ่อมใหม่…"
            : alerts.count > 0
              ? `มีงานซ่อมใหม่รอรับเรื่อง ${alerts.count} รายการ`
              : "ยังไม่มีงานซ่อมใหม่รอรับเรื่อง"}
      </p>
      {alerts && alerts.items.length > 0 && (
        <ul className="mt-1 space-y-1 text-amber-950">
          {alerts.items.map((item) => (
            <li key={item.id}>
              <Link href="/admin/maintenance" className="underline underline-offset-2">
                ห้อง {item.room} · {item.category} · รับเรื่อง
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
