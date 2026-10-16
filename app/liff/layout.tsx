"use client";

import liff from "@line/liff";
import { useEffect, useState } from "react";

export default function LiffLayout({ children }: LayoutProps<"/liff">) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    liff
      .init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! })
      .then(() => {
        if (!liff.isLoggedIn()) return liff.login();
        // TODO Phase 0/1: ส่ง liff.getIDToken() ไป /api/auth/line เพื่อรับ session ของ Supabase
        setReady(true);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p>เปิดผ่าน LINE ไม่สำเร็จ: {error}</p>;
  if (!ready) return <p>กำลังโหลด...</p>;
  return children;
}
