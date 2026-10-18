"use client";

import { useActionState } from "react";
import { createInvoiceDraft, type BillingResult } from "./actions";
import { DateInput } from "@/app/components/date-input";

export type DraftLeaseInput = {
  id: string;
  room_no: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  water_fee: number;
  electric_rate: number;
  due_day: number;
  tenant_count: number;
  readings: { id: string; period: string; prev: number; curr: number; units: number }[];
};

export function InvoiceDraftForm({
  lease,
  defaultMonth,
}: {
  lease: DraftLeaseInput;
  defaultMonth: string;
}) {
  const [state, action, pending] = useActionState<BillingResult | null, FormData>(createInvoiceDraft, null);
  return (
    <details className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800">
        ห้อง {lease.room_no} · ค่าเช่า {lease.rent_amount} · กำหนดชำระตามสัญญาวันที่ {lease.due_day}
      </summary>
      <form action={action} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="lease_id" value={lease.id} />
        <label className="text-sm">
          งวดค่าเช่า
          <input name="period" type="month" defaultValue={defaultMonth} required className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" />
        </label>
        <label className="text-sm">
          วันครบกำหนดของบิลนี้
          <DateInput name="due_date" required className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" />
        </label>
        <label className="text-sm">
          มิเตอร์ที่ใช้คิดค่าไฟ (เลือกงวดล่าสุดของห้องให้แล้ว)
          <select name="meter_reading_id" required defaultValue={lease.readings[0]?.id ?? ""} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2">
            <option value="" disabled>ยังไม่มีมิเตอร์ที่ยังไม่ออกบิล: จดมิเตอร์ห้องนี้ก่อน</option>
            {lease.readings.map((reading) => (
              <option key={reading.id} value={reading.id}>
                {reading.period} · {reading.units} หน่วย ({reading.prev} → {reading.curr})
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl bg-white p-3 text-sm ring-1 ring-gray-100">
          <p>ค่าเช่า: {lease.rent_amount} บาท</p>
          <p>น้ำเหมาจ่าย: {lease.water_fee} บาท</p>
          <p>ค่าไฟ: {lease.electric_rate} บาท/หน่วย</p>
          <p className="mt-1 text-xs text-gray-500">ระบบเลือกมิเตอร์ล่าสุดที่ยังไม่ออกบิลของห้องนี้ให้แล้ว</p>
        </div>
        <label className="text-sm">
          รายการเพิ่ม (บาท)
          <input name="extra_amount" type="number" min="0" step="0.01" defaultValue="0" inputMode="decimal" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" />
          <input name="extra_description" maxLength={160} placeholder="ระบุเหตุผลเมื่อมีรายการเพิ่ม" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" />
        </label>
        <label className="text-sm">
          ส่วนลด (บาท)
          <input name="discount_amount" type="number" min="0" step="0.01" defaultValue="0" inputMode="decimal" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" />
          <input name="discount_description" maxLength={160} placeholder="ระบุเหตุผลเมื่อมีส่วนลด" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2" />
        </label>
        <div className="flex items-end">
          <button disabled={pending || lease.tenant_count === 0 || lease.readings.length === 0} className="w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {pending ? "กำลังสร้างร่าง…" : "คำนวณและบันทึกเป็นร่าง"}
          </button>
        </div>
        {state?.error && <p role="alert" className="text-sm text-red-700 sm:col-span-2 xl:col-span-4">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-emerald-800 sm:col-span-2 xl:col-span-4">{state.message}</p>}
        {lease.tenant_count === 0 && <p className="text-sm text-amber-800 sm:col-span-2 xl:col-span-4">ยังไม่มีผู้เช่าผูกกับสัญญานี้ จึงยังสร้างบิลไม่ได้</p>}
        {lease.readings.length === 0 && <p className="text-sm text-amber-800 sm:col-span-2 xl:col-span-4">ยังไม่มีบันทึกมิเตอร์ของห้องนี้</p>}
      </form>
    </details>
  );
}
