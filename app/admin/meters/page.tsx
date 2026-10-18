import { Badge, Card, DemoBanner, EmptyState, StatCard } from "@/app/components/ui";
import { MOCK_METER_HISTORY } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateTH, todayTH } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { MeterForm, type MeterRoomInput } from "./meter-form";
import { meterPhotoUrls } from "./actions";

type Reading = {
  id: string;
  room_id: string;
  period: string;
  prev_value: number;
  curr_value: number;
  units: number | null;
  photo_path: string | null;
  created_at: string;
  rooms: { room_no: string } | null;
};

/** งวดเริ่มต้น = วันที่ 1 ของเดือนตามเวลาไทย (toISOString ให้วันก่อนหน้า 1 วันช่วง 00:00–07:00) */
function currentPeriodTH(): string {
  return `${todayTH().slice(0, 7)}-01`;
}

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">บันทึกมิเตอร์</h1>
          <p className="text-sm text-gray-500">จดเลขหลายห้องพร้อมกันในหน้าเดียว</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: ข้อมูลด้านล่างเป็นข้อมูลตัวอย่างสำหรับการสาธิต" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="ยูนิตทั้งหมด" value="5" icon="building" />
          <StatCard label="จดงวดนี้แล้ว" value="3" sub="60% ของห้องทั้งหมด" icon="check" tone="green" />
          <StatCard label="ยังไม่บันทึก" value="2" sub="เหลืออีก 2 ห้อง" icon="meter" tone="amber" />
          <StatCard label="ไฟใช้รวมงวดนี้" value="240 หน่วย" icon="receipt" tone="blue" />
        </div>
        <Card title="ตัวอย่างการใช้งาน">
          <ul className="space-y-1 text-sm text-gray-600">
            {MOCK_METER_HISTORY.map((m) => (
              <li key={m.period}>
                {m.period}: {m.prev} → {m.curr} · {m.units} หน่วย
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: roomsRaw }, { data: readingsRaw }] = await Promise.all([
    supabase.from("rooms").select("id,room_no,unit_type").order("room_no"),
    supabase
      .from("meter_readings")
      .select("id,room_id,period,prev_value,curr_value,units,photo_path,created_at, rooms(room_no)")
      .order("period", { ascending: false }),
  ]);
  const rooms = (roomsRaw ?? []) as unknown as { id: string; room_no: string }[];
  const readings = (readingsRaw ?? []) as unknown as Reading[];

  const byRoom = new Map<string, Reading[]>();
  for (const r of readings) {
    const list = byRoom.get(r.room_id) ?? [];
    list.push(r);
    byRoom.set(r.room_id, list);
  }
  const formRooms: MeterRoomInput[] = rooms.map((r) => ({
    id: r.id,
    room_no: r.room_no,
    readings: (byRoom.get(r.id) ?? []).map((x) => ({
      period: x.period,
      prev: Number(x.prev_value),
      curr: Number(x.curr_value),
      units: x.units === null ? null : Number(x.units),
    })),
  }));

  const period = currentPeriodTH();
  const thisPeriod = readings.filter((r) => r.period === period);
  const photos = await meterPhotoUrls(thisPeriod.filter((r) => r.photo_path).map((r) => r.id));
  const recent = readings.slice(0, 12);
  const unrecordedCount = Math.max(0, rooms.length - thisPeriod.length);
  const totalUnits = thisPeriod.reduce((sum, r) => sum + (Number(r.units) || 0), 0);
  const pct = rooms.length ? Math.round((thisPeriod.length / rooms.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">บันทึกมิเตอร์</h1>
        <p className="text-sm text-gray-500">
          จดหลายห้องพร้อมกัน แนบรูป และตรวจสอบความถูกต้องก่อนบันทึก: งวด {period}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="ยูนิตทั้งหมด" value={String(rooms.length)} icon="building" />
        <StatCard label="จดงวดนี้แล้ว" value={String(thisPeriod.length)} sub={`${pct}% ของห้องทั้งหมด`} icon="check" tone="green" />
        <StatCard label="ยังไม่บันทึก" value={String(unrecordedCount)} sub={unrecordedCount === 0 ? "ครบทุกห้องแล้ว" : `เหลืออีก ${unrecordedCount} ห้อง`} icon="meter" tone={unrecordedCount > 0 ? "amber" : "default"} />
        <StatCard label="ไฟใช้รวมงวดนี้" value={`${totalUnits} หน่วย`} icon="receipt" tone="blue" />
      </div>

      <Card
        title="จดมิเตอร์เป็นชุด"
        desc="เลือกห้อง → กรอกเลขก่อนหน้า/ปัจจุบัน → แนบรูป → บันทึก · งวดบันทึกเป็นวันแรกของเดือน"
      >
        {formRooms.length === 0 ? (
          <EmptyState
            title="ยังไม่มีห้องให้จดมิเตอร์"
            desc="เพิ่มยูนิตที่หน้าห้องพักและร้านค้าก่อน"
          />
        ) : (
          <MeterForm rooms={formRooms} defaultPeriod={period} />
        )}
      </Card>

      <Card
        title={`บันทึกงวด ${period} แล้ว ${thisPeriod.length}/${rooms.length} ห้อง`}
        desc="เลขปัจจุบันต่ำกว่าเลขก่อนหน้าระบบจะไม่บันทึก ต้องแก้และส่งใหม่ทั้งชุด"
      >
        {thisPeriod.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีข้อมูลของงวดนี้</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {thisPeriod.map((r) => (
              <li key={r.id} className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">ห้อง {r.rooms?.room_no ?? "?"}</p>
                  <Badge tone={Number(r.units) > 0 ? "green" : "amber"}>
                    {Number(r.units)} หน่วย
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {Number(r.prev_value)} → {Number(r.curr_value)} · จด {formatDateTH(r.created_at)}
                </p>
                {photos[r.id] && (
                  <a
                    href={photos[r.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-blue-700 hover:underline"
                  >
                    เปิดรูปมิเตอร์
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="ประวัติล่าสุด" desc="ทุกห้อง เรียงตามงวด">
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีประวัติมิเตอร์</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-gray-50 pb-1">
                <span>
                  ห้อง {r.rooms?.room_no ?? "?"} · งวด {r.period}
                </span>
                <span className="text-gray-500">
                  {Number(r.prev_value)} → {Number(r.curr_value)} · {Number(r.units)} หน่วย
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}