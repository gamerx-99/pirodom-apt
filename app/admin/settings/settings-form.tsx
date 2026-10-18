"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";

type Field = { key: string; label: string; secret: boolean; value?: string; isSet: boolean; hint?: string };
type Group = { title: string; desc: string; fields: Field[] };

const input = "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2";

export function SettingsForm({ groups }: { groups: Group[] }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  return (
    <form action={action} className="space-y-4">
      {groups.map((g) => (
        <section key={g.title} className="rounded-2xl bg-white p-4 text-gray-900 shadow-sm ring-1 ring-gray-200 sm:p-5">
          <h2 className="text-base font-semibold">{g.title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{g.desc}</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.fields.map((f) => (
              <label key={f.key} className="text-sm">
                {f.label}
                {f.secret ? (
                  <input
                    name={f.key}
                    type="password"
                    autoComplete="off"
                    placeholder={f.isSet ? "ตั้งค่าแล้ว: เว้นว่างเพื่อใช้ค่าเดิม" : "ยังไม่ได้ตั้งค่า"}
                    className={input}
                  />
                ) : (
                  <input name={f.key} defaultValue={f.value ?? ""} autoComplete="off" className={input} />
                )}
                {f.hint && <span className="mt-1 block text-xs text-gray-500">{f.hint}</span>}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
        </button>
        {state && !state.ok && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-emerald-800">บันทึกแล้ว มีผลทันที</p>}
      </div>
    </form>
  );
}
