"use client";

import { useActionState, useState } from "react";
import { createInvite, createLease } from "./actions";
import { DateInput } from "@/app/components/date-input";

type RoomPrice = { id: string; room_no: string; rent_amount: number; deposit: number; water_fee: number; electric_rate: number; due_day: number };

// เลือกห้องแล้วดึงราคาตั้งต้นของห้องมาใส่ แก้เฉพาะสัญญานี้ได้ (ราคาห้องไม่เปลี่ยน)
export function CreateLeaseForm({ rooms }: { rooms: RoomPrice[] }) {
  const [state, action, pending] = useActionState(createLease, null);
  const [roomId, setRoomId] = useState("");
  const room = rooms.find((r) => r.id === roomId);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label className="text-sm">
        ห้อง
        <select name="room_id" required className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="" disabled>เลือกห้อง</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.room_no}</option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        วันเริ่ม
        <DateInput name="start_date" required className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        วันสิ้นสุด (ถ้ามี)
        <DateInput name="end_date" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ครบกำหนดวันที่ (31 = สิ้นเดือน)
        <input key={`due-${roomId}`} name="due_day" inputMode="numeric" required defaultValue={room?.due_day ?? 31} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ค่าเช่า (บาท)
        <input key={`rent-${roomId}`} name="rent_amount" inputMode="decimal" required placeholder="3500" defaultValue={room && Number(room.rent_amount) > 0 ? Number(room.rent_amount) : undefined} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ค่าน้ำเหมาจ่าย
        <input key={`water-${roomId}`} name="water_fee" inputMode="decimal" defaultValue={Number(room?.water_fee ?? 0)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        ค่าไฟ/หน่วย
        <input key={`elec-${roomId}`} name="electric_rate" inputMode="decimal" defaultValue={Number(room?.electric_rate ?? 0)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <label className="text-sm">
        เงินประกัน
        <input key={`dep-${roomId}`} name="deposit" inputMode="decimal" defaultValue={Number(room?.deposit ?? 0)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2" />
      </label>
      <div className="col-span-2 flex items-end sm:col-span-4">
        <button disabled={pending} className="w-full rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 sm:w-auto">
          {pending ? "กำลังบันทึก…" : "สร้างสัญญา"}
        </button>
      </div>
      {state && !state.ok && <p className="col-span-2 text-sm text-red-600 sm:col-span-4">{state.error}</p>}
      {state?.ok && <p className="col-span-2 text-sm text-emerald-700 sm:col-span-4">สร้างสัญญาเรียบร้อยแล้ว: สามารถออกรหัสยืนยันให้ผู้เช่าได้ด้านล่าง</p>}
    </form>
  );
}

export function InviteButton({ leaseId }: { leaseId: string }) {
  const [state, action, pending] = useActionState(createInvite, null);
  return (
    <form action={action} className="mt-2">
      <input type="hidden" name="lease_id" value={leaseId} />
      <button disabled={pending} className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {pending ? "กำลังออก…" : "ออกรหัสยืนยัน (7 วัน)"}
      </button>
      {state && !state.ok && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.ok && state.inviteCode && (
        <div className="mt-2 rounded-xl bg-teal-50 p-3 text-sm text-teal-900">
          <p>ส่งรหัสนี้ให้ผู้เช่า แล้วให้พิมพ์ส่งหา LINE Bot ภายใน 7 วัน (รหัสแสดงครั้งเดียว):</p>
          <p className="mt-2 select-all font-mono text-xl font-bold tracking-[0.2em]">{state.inviteCode}</p>
          <p className="mt-2 text-xs">LINE Login ของ LIFF และ LINE OA Bot ต้องอยู่ใน LINE Developers Provider เดียวกัน</p>
        </div>
      )}
    </form>
  );
}
