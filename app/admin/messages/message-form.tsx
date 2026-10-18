"use client";

import { useActionState, useState } from "react";
import { MESSAGE_MAX_LENGTH, MESSAGE_TEMPLATES, fillMessage } from "@/lib/messages";
import { resendNotification, sendMessages } from "./actions";

type Room = { leaseId: string; roomNo: string; unpaid: number; nextDue: string | null; names: string };
const button = "rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50";

export function MessageForm({ rooms }: { rooms: Room[] }) {
  const [state, action, pending] = useActionState(sendMessages, null);
  const [mode, setMode] = useState("rooms");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const selected = rooms.filter((r) => mode === "all" || (mode === "unpaid" && r.unpaid > 0) || (mode === "rooms" && picked.includes(r.leaseId)));
  const first = selected[0];
  return <form action={action} className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      <label className="block">ผู้รับ
        <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 block w-full rounded-lg border p-2">
          <option value="rooms">เลือกห้อง</option><option value="all">ทุกห้องที่มีสัญญาใช้งาน</option><option value="unpaid">ห้องที่ยังมีบิลรอชำระ</option>
        </select>
      </label>
      {mode === "rooms" && <fieldset className="max-h-64 space-y-2 overflow-auto rounded-lg border p-3"><legend>เลือกห้องที่ต้องการส่ง</legend>
        {rooms.map((r) => <label key={r.leaseId} className="flex items-center gap-2"><input type="checkbox" name="lease_id" value={r.leaseId} checked={picked.includes(r.leaseId)} onChange={(e) => setPicked((ids) => e.target.checked ? [...ids, r.leaseId] : ids.filter((id) => id !== r.leaseId))} />ห้อง {r.roomNo} · {r.names}</label>)}
      </fieldset>}
      <label className="block">แม่แบบข้อความ<select defaultValue="custom" onChange={(e) => setText(MESSAGE_TEMPLATES.find((t) => t.key === e.target.value)?.text ?? "")} className="mt-1 block w-full rounded-lg border p-2">{MESSAGE_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
      <label className="block">ข้อความ<textarea name="message" required maxLength={MESSAGE_MAX_LENGTH} rows={5} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <p className="text-sm text-gray-600">{text.length}/{MESSAGE_MAX_LENGTH} ตัวอักษร · ผู้รับ {selected.length} ห้อง · ใช้ตัวแปร {"{ห้อง} {ยอดค้าง} {ครบกำหนด}"} ได้ ยอดค้างรวมเฉพาะบิลรอชำระ ไม่รวมสลิปที่รอตรวจ</p>
      {first && <div className="rounded-lg bg-gray-50 p-3"><p className="font-semibold">ตัวอย่างห้อง {first.roomNo}</p><p className="whitespace-pre-wrap">{fillMessage(text, { room: first.roomNo, unpaid: first.unpaid, nextDue: first.nextDue })}</p></div>}
      <button disabled={pending || selected.length === 0 || !text.trim()} className={button}>{pending ? "กำลังส่ง…" : `ส่งข้อความถึง ${selected.length} ห้อง`}</button>
    </fieldset>
    {state && <p role="status" className={state.ok ? "text-blue-800" : "text-red-700"}>{state.message}</p>}
  </form>;
}

export function ResendForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(resendNotification, null);
  return <form action={action} className="mt-2"><input type="hidden" name="notification_id" value={id} /><button disabled={pending} className={button}>{pending ? "กำลังส่ง…" : "ส่งซ้ำ"}</button>{state && <p role="status" className="mt-1 text-sm">{state.message}</p>}</form>;
}
