"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SlipUpload({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(form: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/slipok/verify", { method: "POST", body: form });
      const result = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error ?? "ส่งสลิปไม่สำเร็จ");
      setMessage(result.message ?? "รับสลิปแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งสลิปไม่สำเร็จ");
    } finally {
      setBusy(false);
      // Even an error response may follow a saved upload. Show that existing
      // submission instead of inviting the tenant to upload the same slip again.
      router.refresh();
    }
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <label className="block text-sm">
        รูปสลิป (JPG, PNG, WEBP ไม่เกิน 4 MB)
        <input name="slip" type="file" required accept="image/jpeg,image/png,image/webp" disabled={busy}
          className="mt-1 block w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700" />
      </label>
      <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "กำลังส่ง…" : "ส่งสลิปให้ตรวจสอบ"}
      </button>
      {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
    </form>
  );
}
