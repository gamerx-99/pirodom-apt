"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Alerts = { count: number; items: { id: string; status: string; room: string; period: string }[] };

export default function PaymentNotifications() {
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function refresh() {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const response = await fetch("/api/admin/payment-notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("notification request failed");
        const next = await response.json() as Alerts;
        if (!controller.signal.aborted) { setAlerts(next); setError(false); }
      } catch {
        if (!controller.signal.aborted) { setAlerts(null); setError(true); }
      } finally { loading = false; }
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

  return <aside aria-label="แจ้งเตือนสลิป" className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm">
    <p role="status" aria-live="polite" className="font-semibold text-teal-900">
      {error ? "โหลดแจ้งเตือนไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ" : !alerts ? "กำลังตรวจสลิปที่รอเจ้าหน้าที่…" : alerts.count > 0 ? `มีสลิปรอเจ้าหน้าที่ตรวจ ${alerts.count} รายการ` : "ยังไม่มีสลิปรอตรวจ"}
    </p>
    {alerts && alerts.items.length > 0 && <ul className="mt-1 space-y-1 text-teal-800">
      {alerts.items.map((item) => <li key={item.id}>
        <Link href={`/admin/payments#payment-${item.id}`} className="underline underline-offset-2">
          ห้อง {item.room} · งวด {item.period}{item.status === "uploaded" ? " · เก็บสลิปแล้ว รอผลตรวจ/นำผลกลับเข้าคิว" : " · เปิดตรวจสลิป"}
        </Link>
      </li>)}
    </ul>}
    <Link href="/admin/payments" className="mt-2 inline-block font-semibold text-teal-800 underline underline-offset-2">ไปคิวตรวจสลิปทั้งหมด</Link>
  </aside>;
}
