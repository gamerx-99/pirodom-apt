"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type BridgeState =
  | { status: "loading" }
  | { status: "demo" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function LiffLayout({ children }: LayoutProps<"/liff">) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const router = useRouter();
  const [state, setState] = useState<BridgeState>(() =>
    liffId ? { status: "loading" } : { status: "demo" },
  );

  useEffect(() => {
    // ข้าม LIFF จริงเมื่อไม่มี env — เข้า demo mode ให้ดู UI ต่อได้
    if (!liffId) return;
    let cancelled = false;
    import("@line/liff")
      .then(({ default: liff }) =>
        liff.init({ liffId }).then(async () => {
          if (cancelled) return;
          if (!liff.isLoggedIn()) {
            // คืนกลับ URL เดิม เพื่อไม่ให้ token ใน /liff/join/<token> หายตอน login
            liff.login({ redirectUri: window.location.href });
            return;
          }
          const idToken = liff.getIDToken();
          if (!idToken) {
            setState({ status: "error", message: "อ่าน ID token จาก LINE ไม่ได้" });
            return;
          }
          // ส่ง ID token ให้สะพานตรวจกับ LINE แล้วตั้ง Supabase session cookie
          const res = await fetch("/api/auth/line", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          if (cancelled) return;
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            setState({
              status: "error",
              message:
                body?.error === "invalid_id_token"
                  ? "ยืนยันตัวตนกับ LINE ไม่ผ่าน ลองเข้าใหม่"
                  : "ผูกบัญชีกับระบบหอไม่สำเร็จ ลองเข้าใหม่",
            });
            return;
          }
          setState({ status: "ready" });
          // เซิร์ฟเวอร์เรนเดอร์หน้านี้ไปก่อนที่ cookie จะมี ให้ดึงใหม่เพื่อได้ข้อมูลจริง
          router.refresh();
        }),
      )
      .catch((e: Error) => {
        if (!cancelled) setState({ status: "error", message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [liffId, router]);

  if (state.status === "loading") return <p role="status" className="min-h-dvh bg-gray-50 p-6 text-gray-900">กำลังโหลด...</p>;
  if (state.status === "error")
    return <p role="alert" className="min-h-dvh bg-gray-50 p-6 text-gray-900">เปิดผ่าน LINE ไม่สำเร็จ: {state.message}</p>;
  if (state.status === "demo")
    return (
      <div className="min-h-dvh w-full bg-gray-50 text-gray-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-24">
          <p className="mb-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            <span className="font-semibold">โหมดตัวอย่าง</span>: ยังไม่ได้กำหนดค่า LIFF ID
            จึงข้ามขั้นตอนการเข้าสู่ระบบ LINE
          </p>
          {children}
        </div>
      </div>
    );
  return (
    <div className="min-h-dvh w-full bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-24">{children}</div>
    </div>
  );
}
