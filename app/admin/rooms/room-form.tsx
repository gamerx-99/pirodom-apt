"use client";

import { useActionState } from "react";
import { createRoom } from "./actions";

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoom, null);
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <label className="text-sm">
        เลขห้อง / ยูนิต
        <input name="room_no" required maxLength={40} placeholder="101" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ประเภท
        <select name="unit_type" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" defaultValue="residential">
          <option value="residential">ห้องพัก</option>
          <option value="commercial">ร้านค้า</option>
        </select>
      </label>
      <label className="text-sm">
        ชั้น
        <input name="floor" inputMode="numeric" placeholder="1" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        สถานะเริ่ม
        <select name="status" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" defaultValue="vacant">
          <option value="vacant">ว่าง</option>
          <option value="reserved">จองแล้ว</option>
          <option value="occupied">มีผู้เช่า</option>
          <option value="maintenance">ปรับปรุง</option>
        </select>
      </label>
      <div className="flex items-end">
        <button disabled={pending} className="w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {pending ? "กำลังบันทึก…" : "เพิ่มยูนิต"}
        </button>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600 sm:col-span-5">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-700 sm:col-span-5">บันทึกแล้ว</p>}
    </form>
  );
}
