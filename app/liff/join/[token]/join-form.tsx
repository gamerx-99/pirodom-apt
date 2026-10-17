"use client";

import { useState } from "react";

const ERROR_TH: Record<string, string> = {
  invalid_token: "ลิงก์ไม่ถูกต้อง",
  already_used: "ลิงก์นี้ถูกใช้ไปแล้ว — ขอลิงก์ใหม่จากผู้ดูแล",
  revoked: "ลิงก์นี้ถูกเพิกถอนแล้ว — ขอลิงก์ใหม่จากผู้ดูแล",
  expired: "ลิงก์หมดอายุ (7 วัน) — ขอลิงก์ใหม่จากผู้ดูแล",
  lease_closed: "สัญญานี้ปิดแล้ว — ติดต่อผู้ดูแล",
  name_required: "กรุณากรอกชื่อ-นามสกุล",
  invalid_phone: "เบอร์โทรไม่ถูกต้อง (ตัวเลข 9–15 หลัก)",
  unauthorized: "กรุณาเข้าสู่ระบบด้วย LINE ก่อน",
  bind_failed: "ผูกบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง",
};

export function JoinForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, display_name: name.trim(), phone: phone.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(ERROR_TH[data.error ?? ""] ?? "ผูกบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setDone(true);
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-center">
        <p className="font-semibold text-emerald-800">ผูกบัญชีสำเร็จ</p>
        <a href="/liff" className="mt-2 inline-block text-sm font-semibold text-teal-700">ไปหน้าหลักผู้เช่า</a>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="block text-sm">
        ชื่อ-นามสกุล
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="ชื่อจริง นามสกุลจริง" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="mt-3 block text-sm">
        เบอร์โทร
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" placeholder="08x-xxx-xxxx" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="mt-4 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "กำลังผูกบัญชี…" : "ยืนยันผูกบัญชี"}
      </button>
    </form>
  );
}
