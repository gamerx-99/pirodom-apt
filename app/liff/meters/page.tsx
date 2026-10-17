import { Card } from "@/app/components/ui";
import LiffNav from "../components/nav";
import { MOCK_METER_HISTORY } from "@/lib/mock";

export default function Page() {
  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ประวัติมิเตอร์</h1>
        <p className="text-sm text-gray-500">ห้อง 101 · ดูได้เฉพาะช่วงสัญญาของตัวเอง</p>
      </div>
      <Card title="งวดล่าสุด: ต.ค. 2569" desc="305 → 392 · 87 หน่วย">
        <div className="flex h-24 items-end gap-2">
          {MOCK_METER_HISTORY.map((m) => (
            <div key={m.period} className="flex-1 rounded-t-lg bg-teal-200" style={{ height: `${(m.units / 87) * 100}%` }} />
          ))}
        </div>
      </Card>
      <Card title="ประวัติ">
        <ul className="space-y-2 text-sm">
          {MOCK_METER_HISTORY.map((m) => (
            <li key={m.period} className="flex justify-between border-b border-gray-50 pb-2">
              <span>{m.period}</span>
              <span>{m.prev} → {m.curr} · {m.units} หน่วย</span>
            </li>
          ))}
        </ul>
      </Card>
      <LiffNav />
    </div>
  );
}

