"use client";

import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/app/components/ui";
import { recordMeters, type RecordMetersResult } from "./actions";
import { DateInput } from "@/app/components/date-input";

export type MeterRoomInput = {
  id: string;
  room_no: string;
  readings: { period: string; prev: number; curr: number; units: number | null }[];
};

type Draft = { prev: string; curr: string };

/** งวดก่อนหน้าของห้องที่ยังใช้ได้ตามงวดที่เลือก (ห้องว่างยังไม่เคยจด) */
function lastBefore(readings: MeterRoomInput["readings"], period: string) {
  return readings.find((r) => r.period < period) ?? null;
}

function toNumber(v: string): number | null {
  const n = Number(v.replace(/,/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

export function MeterForm({
  rooms,
  defaultPeriod,
}: {
  rooms: MeterRoomInput[];
  defaultPeriod: string;
}) {
  const [state, action, pending] = useActionState<RecordMetersResult | null, FormData>(
    recordMeters,
    null,
  );
  const [period, setPeriod] = useState(defaultPeriod);
  const [selected, setSelected] = useState<string[]>(() =>
    rooms.filter((r) => !r.readings.some((x) => x.period === defaultPeriod)).map((r) => r.id),
  );
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  const byId = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const pendingRooms = rooms.filter((r) => !r.readings.some((x) => x.period === period));
  const doneCount = rooms.length - pendingRooms.length;
  const picked = selected.filter((id) => byId.has(id));

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const setAll = (ids: string[]) => setSelected(ids);

  const setValue = (id: string, key: "prev" | "curr", value: string) =>
    setDraft((cur) => ({ ...cur, [id]: { ...{ prev: "", curr: "" }, ...cur[id], [key]: value } }));

  return (
    <form action={action} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          งวดที่จด
          <DateInput
            name="period"
            value={period}
            onChange={setPeriod}
            required
            className="mt-1 block rounded-xl border border-gray-200 px-3 py-2"
          />
        </label>
        <p className="text-sm text-gray-500">
          บันทึกงวดนี้แล้ว {doneCount}/{rooms.length} ห้อง · เลือกแล้ว {picked.length} ห้อง
        </p>
        <div className="ml-auto flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setAll(pendingRooms.map((r) => r.id))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            เลือกที่ยังไม่จด
          </button>
          <button
            type="button"
            onClick={() => setAll([])}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
          >
            ล้าง
          </button>
        </div>
      </div>

      {picked.length === 0 ? (
        <p className="text-sm text-gray-400">เลือกห้องอย่างน้อย 1 ห้องเพื่อกรอกเลขมิเตอร์</p>
      ) : (
        <ul className="space-y-2">
          {picked.map((id) => {
            const room = byId.get(id)!;
            const last = lastBefore(room.readings, period);
            const value = draft[id] ?? { prev: "", curr: "" };
            const prev = toNumber(value.prev);
            const curr = toNumber(value.curr);
            const units =
              prev !== null && curr !== null ? Math.round((curr - prev) * 100) / 100 : null;
            const mismatch = last && prev !== null && prev !== last.curr;
            const already = room.readings.find((x) => x.period === period);
            const drop = prev !== null && curr !== null && curr < prev;
            return (
              <li key={id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(id)}
                      className="h-4 w-4"
                    />
                    ห้อง {room.room_no}
                  </label>
                  {already ? (
                    <Badge tone="green">จดงวดนี้แล้ว {Number(already.prev)} → {Number(already.curr)}</Badge>
                  ) : last ? (
                    <span className="text-xs text-gray-500">
                      งวดก่อน {last.period} จบที่ {last.curr}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">ยังไม่เคยจด</span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-sm">
                    เลขก่อนหน้า
                    <input
                      name={`prev:${id}`}
                      inputMode="decimal"
                      value={value.prev}
                      placeholder={last ? String(last.curr) : "เช่น 305"}
                      onChange={(e) => setValue(id, "prev", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    เลขปัจจุบัน
                    <input
                      name={`curr:${id}`}
                      inputMode="decimal"
                      value={value.curr}
                      placeholder="กรอกเลขใหม่"
                      onChange={(e) => setValue(id, "curr", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                    />
                  </label>
                  <div className="text-sm">
                    หน่วยที่ใช้
                    <p
                      className={`mt-1 rounded-xl border border-gray-200 px-3 py-2 ${
                        drop ? "bg-red-50 text-red-700" : "bg-white text-gray-800"
                      }`}
                    >
                      {units === null ? "-" : `${units} หน่วย`}
                    </p>
                  </div>
                  <label className="text-sm">
                    รูปมิเตอร์ (ไม่บังคับ)
                    <input
                      type="file"
                      name={`photo:${id}`}
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-1 w-full text-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs"
                    />
                  </label>
                </div>
                {drop && (
                  <p className="mt-2 text-xs text-red-600">
                    เลขปัจจุบันต่ำกว่าเลขก่อนหน้า: ระบบจะไม่บันทึกห้องนี้
                  </p>
                )}
                {!drop && mismatch && (
                  <p className="mt-2 text-xs text-amber-700">
                    เลขก่อนหน้าไม่ตรงกับเลขที่จบงวดก่อน ({last?.curr}): กรุณาตรวจสอบมิเตอร์อีกครั้ง
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || picked.length === 0}
          className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : `บันทึก ${picked.length} ห้อง`}
        </button>
        <p className="text-xs text-gray-400">
          ถ้ามีห้องที่ตัวเลขผิด ระบบจะไม่บันทึกทั้งงวด และจะระบุห้องที่ต้องตรวจ
        </p>
      </div>

      {state && !state.ok && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <p className="font-semibold">{state.error}</p>
          {state.rejected.length > 0 && (
            <ul className="mt-1 space-y-1 text-xs">
              {state.rejected.map((r) => (
                <li key={r.room_no}>
                  ห้อง {r.room_no}: {r.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state?.ok && (
        <div className="space-y-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">
            บันทึกแล้ว {state.saved.length} ห้อง
            {state.rejected.length > 0 ? ` · ไม่สำเร็จ ${state.rejected.length} ห้อง` : ""}
            {state.skipped.length > 0 ? ` · ข้าม ${state.skipped.length} ห้องที่ยังไม่กรอก` : ""}
          </p>
          <ul className="space-y-1 text-xs">
            {state.saved.map((r) => (
              <li key={r.room_no}>
                ห้อง {r.room_no} · {r.units} หน่วย
                {r.warn && <span className="ml-1 text-amber-700">· ต้องตรวจ: {r.warn}</span>}
              </li>
            ))}
            {state.rejected.map((r) => (
              <li key={r.room_no} className="text-red-700">
                ห้อง {r.room_no}: {r.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}