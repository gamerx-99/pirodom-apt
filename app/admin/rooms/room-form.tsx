"use client";

import { useActionState } from "react";
import { createRoom } from "./actions";
import { PriceFields } from "./room-actions";

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoom, null);
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        <input name="floor" type="number" step="1" min={-2147483648} max={2147483647} placeholder="1" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
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
      <PriceFields className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" />
      <div className="flex items-end sm:col-span-2 xl:col-span-1">
        <button disabled={pending} className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? "กำลังบันทึก…" : "เพิ่มยูนิต"}
        </button>
      </div>
      {state && !state.ok && <p role="alert" className="text-sm text-red-700 sm:col-span-2 xl:col-span-5">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-800 sm:col-span-2 xl:col-span-5">บันทึกแล้ว</p>}
    </form>
  );
}
