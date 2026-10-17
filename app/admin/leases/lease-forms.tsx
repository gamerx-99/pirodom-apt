"use client";

import { useActionState } from "react";
import { createInvite, createLease } from "./actions";

export function CreateLeaseForm({ rooms }: { rooms: { id: string; room_no: string }[] }) {
  const [state, action, pending] = useActionState(createLease, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="text-sm">
        ห้อง
        <select name="room_id" required className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" defaultValue="">
          <option value="" disabled>เลือกห้อง</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.room_no}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        วันเริ่ม
        <input name="start_date" type="date" required className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        วันสิ้นสุด (ถ้ามี)
        <input name="end_date" type="date" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ครบกำหนดวันที่ (31 = สิ้นเดือน)
        <input name="due_day" inputMode="numeric" required defaultValue="31" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ค่าเช่า (บาท)
        <input name="rent_amount" inputMode="decimal" required placeholder="3500" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ค่าน้ำเหมาจ่าย
        <input name="water_fee" inputMode="decimal" defaultValue="0" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ค่าไฟ/หน่วย
        <input name="electric_rate" inputMode="decimal" defaultValue="0" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        เงินประกัน
        <input name="deposit" inputMode="decimal" defaultValue="0" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <div className="col-span-2 flex items-end sm:col-span-4">
        <button disabled={pending} className="w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 sm:w-auto">
          {pending ? "กำลังบันทึก…" : "สร้างสัญญา"}
        </button>
      </div>
      {state && !state.ok && <p className="col-span-2 text-sm text-red-600 sm:col-span-4">{state.error}</p>}
      {state?.ok && <p className="col-span-2 text-sm text-emerald-700 sm:col-span-4">สร้างสัญญาแล้ว — ออกลิงก์เชิญด้านล่าง</p>}
    </form>
  );
}

export function InviteButton({ leaseId }: { leaseId: string }) {
  const [state, action, pending] = useActionState(createInvite, null);
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="lease_id" value={leaseId} />
      <button disabled={pending} className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "กำลังออก…" : "ออกลิงก์เชิญ (7 วัน)"}
      </button>
      {state && !state.ok && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.ok && state.inviteUrl && (
        <p className="mt-1 break-all text-xs text-emerald-700">
          ส่งลิงก์นี้ให้ผู้เช่า (แสดงครั้งเดียว): <span className="font-mono">{state.inviteUrl}</span>
        </p>
      )}
    </form>
  );
}
