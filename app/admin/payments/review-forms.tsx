"use client";

import { useActionState } from "react";
import { approvePayment, recoverPayment, rejectPayment, type PaymentActionResult } from "./actions";

const initial: PaymentActionResult | null = null;

export function RecoverPaymentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(recoverPayment, initial);
  return <form action={action} className="space-y-2">
    <input type="hidden" name="payment_id" value={id} />
    <p className="text-sm text-amber-800">เก็บรูปสลิปและรายการไว้แล้ว หากมีผลตรวจใน log สามารถนำรายการเดิมกลับเข้าคิวได้โดยไม่ต้องให้ผู้เช่าส่งใหม่</p>
    <button disabled={pending} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50">
      {pending ? "กำลังนำผลกลับเข้าคิว…" : "นำผลตรวจเดิมกลับเข้าคิว"}
    </button>
    {state && <p role="status" className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p>}
  </form>;
}

export function ApprovePaymentForm({ id, amount }: { id: string; amount: number | null }) {
  const [state, action, pending] = useActionState(approvePayment, initial);
  return <form action={action} className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="payment_id" value={id} />
    <label className="text-xs">ยอดรับจริง
      <input name="amount" type="number" min="0.01" step="0.01" required defaultValue={amount ?? ""} className="mt-1 block w-32 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
    </label>
    <button disabled={pending} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "กำลังบันทึก…" : "อนุมัติและปิดบิล"}</button>
    {state && <span role="status" className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</span>}
  </form>;
}

export function RejectPaymentForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(rejectPayment, initial);
  return <form action={action} className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="payment_id" value={id} />
    <label className="min-w-48 flex-1 text-xs">เหตุผลที่ปฏิเสธ
      <input name="reason" required maxLength={300} className="mt-1 block w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
    </label>
    <button disabled={pending} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 disabled:opacity-50">{pending ? "กำลังบันทึก…" : "ปฏิเสธ"}</button>
    {state && <span role="status" className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</span>}
  </form>;
}
