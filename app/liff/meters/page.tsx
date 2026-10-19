// อ่าน session/DB ทุก request — ยกเว้น static-shell validation (Cache Components)
export const instant = false;
import { Badge, Card, EmptyState } from "@/app/components/ui";
import LiffNav from "../components/nav";
import { formatDateTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

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

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 pb-20">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ประวัติมิเตอร์</h1>
          <p className="text-sm text-gray-500">โหมดตัวอย่าง: ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
        </div>
        <EmptyState
          title="ยังไม่มีข้อมูลมิเตอร์"
          desc="เชื่อม Supabase และผูกห้องด้วยลิงก์เชิญก่อน ข้อมูลจะแสดงเฉพาะงวดในช่วงสัญญาของคุณ"
        />
        <LiffNav />
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-2xl font-bold text-slate-900">ประวัติมิเตอร์</h1>
        <Card title="ยังไม่ได้ผูกบัญชี" desc="เปิดผ่าน LINE เพื่อยืนยันตัวตนก่อน">
          <p className="text-sm text-gray-500">
            ถ้ามีลิงก์เชิญจากผู้ดูแลหอพัก ให้กดลิงก์นั้นเพื่อผูกห้องก่อนดูข้อมูล
          </p>
        </Card>
        <LiffNav />
      </div>
    );
  }

  const [{ data: leasesRaw }, { data: readingsRaw }] = await Promise.all([
    supabase
      .from("leases")
      .select("id,status,rooms(id,room_no,unit_type)")
      .eq("status", "active"),
    // Meter row security limits this result to the user's own lease periods.
    supabase
      .from("meter_readings")
      .select("id,room_id,period,prev_value,curr_value,units,photo_path,created_at, rooms(room_no)")
      .order("period", { ascending: false }),
  ]);
  const rooms = ((leasesRaw ?? []) as unknown as {
    rooms: { id: string; room_no: string; unit_type: string } | null;
  }[])
    .map((l) => l.rooms)
    .filter((r): r is { id: string; room_no: string; unit_type: string } => !!r);

  if (rooms.length === 0) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-2xl font-bold text-slate-900">ประวัติมิเตอร์</h1>
        <EmptyState
          title="ยังไม่มีห้องที่ผูกอยู่"
          desc="ถ้าเพิ่งย้ายเข้าหรือเปลี่ยนเครื่อง ให้ขอลิงก์เชิญจากผู้ดูแลอีกครั้ง (ลิงก์ใช้ได้ครั้งเดียว 7 วัน)"
        />
        <LiffNav />
      </div>
    );
  }

  const readings = (readingsRaw ?? []) as unknown as Reading[];

  const byRoom = new Map<string, Reading[]>();
  for (const r of readings) {
    const list = byRoom.get(r.room_id) ?? [];
    list.push(r);
    byRoom.set(r.room_id, list);
  }

  const photoUrls: Record<string, string> = {};
  await Promise.all(
    readings
      .filter((reading): reading is Reading & { photo_path: string } => Boolean(reading.photo_path))
      .map(async (reading) => {
        try {
          photoUrls[reading.id] = await signedUrl("meters", reading.photo_path);
        } catch {
          // เปิดรูปไม่ได้ — ยังแสดงตัวเลขตามปกติ
        }
      }),
  );

  const roomNos = rooms.map((r) => r.room_no).join(", ");
  const totalUnits = readings.reduce((s, r) => s + Number(r.units ?? 0), 0);
  const maxUnits = Math.max(1, ...readings.map((r) => Number(r.units ?? 0)));

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ประวัติมิเตอร์</h1>
        <p className="text-sm text-gray-500">
          ห้อง {roomNos} · ดูได้เฉพาะงวดที่อยู่ในช่วงสัญญาของคุณ
        </p>
      </div>

      {readings.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข้อมูลมิเตอร์"
          desc="ยังไม่มีการบันทึกเลขมิเตอร์ของห้องคุณ: เจ้าหน้าที่จะบันทึกตามรอบของหอพัก หากต้องการสอบถามข้อมูล แจ้งผู้ดูแลได้ทันที"
        />
      ) : (
        <>
          <Card
            title={`ใช้ไฟรวม ${totalUnits} หน่วย`}
            desc={`บันทึกไว้ ${readings.length} งวด · ล่าสุด ${formatDateTH(readings[0].period)}`}
          >
            <div className="flex h-24 items-end gap-2">
              {readings
                .slice(0, 12)
                .reverse()
                .map((r) => (
                  <div
                    key={r.id}
                    className="flex-1 rounded-t-lg bg-blue-200"
                    style={{ height: `${Math.max(6, (Number(r.units ?? 0) / maxUnits) * 100)}%` }}
                    title={`${r.period}: ${Number(r.units ?? 0)} หน่วย`}
                  />
                ))}
            </div>
          </Card>

          {rooms.map((room) => {
            const list = byRoom.get(room.id) ?? [];
            return (
              <Card
                key={room.id}
                title={`ห้อง ${room.room_no}`}
                desc={list.length === 0 ? "ยังไม่มีข้อมูลในช่วงสัญญาของคุณ" : `${list.length} งวด`}
              >
                {list.length === 0 ? (
                  <p className="text-sm text-gray-400">ยังไม่มีข้อมูลมิเตอร์ของห้องนี้</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {list.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 border-b border-gray-50 pb-2"
                      >
                        <span>
                          {formatDateTH(r.period)}
                          <span className="ml-2 text-gray-500">
                            {Number(r.prev_value)} → {Number(r.curr_value)}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge tone={Number(r.units) > 0 ? "green" : "amber"}>
                            {Number(r.units)} หน่วย
                          </Badge>
                          {photoUrls[r.id] && (
                            <a
                              href={photoUrls[r.id]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-blue-700 hover:underline"
                            >
                              ดูรูป
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </>
      )}
      <LiffNav />
    </div>
  );
}
