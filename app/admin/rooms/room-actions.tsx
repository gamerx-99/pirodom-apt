"use client";

import { useActionState, useState } from "react";
import { deleteRoom, updateRoom } from "./actions";
import { ROOM_STATUS_LABEL } from "@/lib/mock";
import { ROOM_STATUSES } from "@/lib/rooms";

type Room = { id: string; room_no: string; unit_type: string; floor: number | null; status: string };
const fieldClass = "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900";

export function RoomActions({ room }: { room: Room }) {
  const [editState, editAction, saving] = useActionState(updateRoom, null);
  const [deleteState, deleteAction, deleting] = useActionState(deleteRoom, null);
  const [confirmation, setConfirmation] = useState("");
  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 pt-3">
      <details>
        <summary className="rounded-lg px-2 py-2 text-sm font-semibold text-teal-800">แก้ไขข้อมูลห้อง {room.room_no}</summary>
        <form action={editAction} className="mt-3 space-y-3">
          <input type="hidden" name="id" value={room.id} />
          <fieldset disabled={saving || deleting} className="space-y-3 disabled:opacity-60">
            <label className="block text-sm font-medium">เลขห้อง / ยูนิต
              <input name="room_no" defaultValue={room.room_no} required maxLength={40} className={fieldClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">ประเภท
                <select name="unit_type" defaultValue={room.unit_type} className={fieldClass}>
                  <option value="residential">ห้องพัก</option><option value="commercial">ร้านค้า</option>
                </select>
              </label>
              <label className="block text-sm font-medium">ชั้น
                <input name="floor" type="number" step="1" min={-2147483648} max={2147483647} defaultValue={room.floor ?? ""} className={fieldClass} />
              </label>
            </div>
            <label className="block text-sm font-medium">สถานะ
              <select name="status" defaultValue={room.status} className={fieldClass}>
                {ROOM_STATUSES.map((status) => <option key={status} value={status}>{ROOM_STATUS_LABEL[status]}</option>)}
              </select>
            </label>
            <button type="submit" className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800">
              {saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
            </button>
          </fieldset>
          {editState && !editState.ok && <p role="alert" className="text-sm text-red-700">{editState.error}</p>}
          {editState?.ok && <p role="status" className="text-sm text-emerald-800">บันทึกข้อมูลห้องแล้ว</p>}
        </form>
      </details>
      <details>
        <summary className="rounded-lg px-2 py-2 text-sm font-medium text-red-700">ลบห้อง {room.room_no}</summary>
        <form action={deleteAction} className="mt-3 space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <input type="hidden" name="id" value={room.id} />
          <p className="text-sm text-red-900">ลบได้เฉพาะห้องที่ไม่มีสัญญา ประวัติมิเตอร์ หรืองานซ่อม การลบห้องเป็นการลบถาวร</p>
          <label className="block text-sm font-medium text-gray-900">พิมพ์ {room.room_no} เพื่อยืนยัน
            <input name="confirm_room_no" required autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={deleting || saving} className={fieldClass} />
          </label>
          <button type="submit" disabled={deleting || saving || confirmation !== room.room_no} className="w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            {deleting ? "กำลังลบ…" : "ยืนยันลบห้อง"}
          </button>
          {deleteState && !deleteState.ok && <p role="alert" className="text-sm text-red-800">{deleteState.error}</p>}
        </form>
      </details>
    </div>
  );
}
