import type { ReactNode } from "react";
import { Badge, Card, DemoBanner, EmptyState, StatCard } from "@/app/components/ui";
import { formatTHB } from "@/lib/format";
import { MOCK_ROOMS, ROOM_STATUS_LABEL } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CreateRoomForm } from "./room-form";
import { RoomActions } from "./room-actions";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ห้องพักและร้านค้า</h1>
          <p className="text-sm text-gray-500">จัดการยูนิตและดูความพร้อมให้เช่า</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: แสดงข้อมูลตัวอย่าง" />
        <RoomStatusTiles statuses={MOCK_ROOMS.map((r) => r.status)} />
        {groupByFloor(MOCK_ROOMS).map(([floor, list]) => (
          <FloorSection key={floor} floor={floor} count={list.length}>
            {list.map((r) => (
              <RoomCard key={r.id} roomNo={r.room_no} status={r.status} commercial={r.unit_type === "commercial"} tenant={r.tenant ?? null} />
            ))}
          </FloorSection>
        ))}
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rooms } = await supabase.from("rooms").select("id,room_no,unit_type,floor,status,rent_amount,deposit,water_fee,electric_rate,due_day").order("room_no");
   const { data: activeLeasesRaw } = await supabase
     .from("leases")
     .select("room_id, lease_tenants(profiles(display_name))")
     .eq("status", "active");
   const activeLeases = (activeLeasesRaw ?? []) as unknown as {
     room_id: string;
     lease_tenants: { profiles: { display_name: string | null } | null }[] | null;
   }[];
   const tenantsByRoom = new Map<string, string[]>();
   for (const l of activeLeases) {
     const names = (l.lease_tenants ?? [])
       .map((t) => t.profiles?.display_name)
       .filter((n): n is string => !!n);
     const cur = tenantsByRoom.get(l.room_id) ?? [];
     tenantsByRoom.set(l.room_id, [...cur, ...names]);
   }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ห้องพักและร้านค้า</h1>
        <p className="text-sm text-gray-500">จัดการยูนิต {rooms?.length ?? 0} ยูนิต · รองรับห้องพักและร้านค้า</p>
      </div>
      <Card title="เพิ่มยูนิต" desc="เลขห้องต้องไม่ซ้ำกัน: สามารถสร้างสัญญาเช่าได้ที่เมนูสัญญา">
        <CreateRoomForm />
      </Card>
      {!rooms || rooms.length === 0 ? (
        <EmptyState title="ยังไม่มียูนิต" desc="เพิ่มยูนิตแรกด้วยฟอร์มด้านบน (เช่น 101 ถึง 118 และร้านค้ายูนิตที่ 1)" />
      ) : (
        <>
          <RoomStatusTiles statuses={rooms.map((r) => r.status)} />
          {groupByFloor(rooms).map(([floor, list]) => (
            <FloorSection key={floor} floor={floor} count={list.length}>
              {list.map((r) => {
                const tenants = tenantsByRoom.get(r.id) ?? [];
                return (
                  <RoomCard key={r.id} roomNo={r.room_no} status={r.status} commercial={r.unit_type === "commercial"}
                    tenant={tenants.length > 0 ? tenants.join(", ") : null} rent={Number(r.rent_amount)}
                    detail={`ประกัน ${Number(r.deposit)} · น้ำ ${Number(r.water_fee)} · ไฟ ${Number(r.electric_rate)}/หน่วย`}>
                    <RoomActions room={{ ...r, rent_amount: Number(r.rent_amount), deposit: Number(r.deposit), water_fee: Number(r.water_fee), electric_rate: Number(r.electric_rate) }} locked={tenantsByRoom.has(r.id)} />
                  </RoomCard>
                );
              })}
            </FloorSection>
          ))}
        </>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, "green" | "blue" | "amber" | "red" | "gray"> = {
  occupied: "green", vacant: "blue", reserved: "amber", moving_out: "amber", maintenance: "red",
};

// แถวสรุปสถานะตาม mockup ui/admin_rooms
function RoomStatusTiles({ statuses }: { statuses: string[] }) {
  const n = (s: string) => statuses.filter((x) => x === s).length;
  const pct = (v: number) => (statuses.length ? `${Math.round((v / statuses.length) * 1000) / 10}%` : "0%");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard label="ยูนิตทั้งหมด" value={String(statuses.length)} icon="building" />
      <StatCard label="มีผู้เช่า" value={String(n("occupied"))} sub={pct(n("occupied"))} icon="check" tone="green" />
      <StatCard label="ว่างพร้อมอยู่" value={String(n("vacant"))} sub={pct(n("vacant"))} icon="door" tone="blue" />
      <StatCard label="จองแล้ว" value={String(n("reserved"))} icon="contract" tone="amber" />
      <StatCard label="รอย้ายออก" value={String(n("moving_out"))} icon="logout" tone="amber" />
      <StatCard label="ปรับปรุง" value={String(n("maintenance"))} icon="wrench" tone={n("maintenance") ? "red" : "default"} />
    </div>
  );
}

function groupByFloor<T extends { floor: number | null; unit_type: string }>(rooms: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of rooms) {
    const key = r.unit_type === "commercial" ? "ร้านค้า" : r.floor == null ? "ไม่ระบุชั้น" : `ชั้น ${r.floor}`;
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].sort(([a], [b]) => (a === "ร้านค้า" ? -1 : b === "ร้านค้า" ? 1 : a.localeCompare(b, "th", { numeric: true })));
}

function FloorSection({ floor, count, children }: { floor: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <span className="h-6 w-2.5 rounded-full bg-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">{floor}</h2>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">{count} ยูนิต</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function RoomCard({ roomNo, status, commercial, tenant, rent, detail, children }: {
  roomNo: string; status: string; commercial: boolean; tenant: string | null; rent?: number; detail?: string; children?: ReactNode;
}) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${commercial ? "ring-2 ring-blue-200" : "ring-slate-200"} ${status === "vacant" ? "border-2 border-dashed border-blue-300" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl font-bold tabular-nums text-slate-900">{roomNo}</p>
        <Badge tone={STATUS_TONE[status] ?? "gray"}>{ROOM_STATUS_LABEL[status as keyof typeof ROOM_STATUS_LABEL] ?? status}</Badge>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-700">{tenant ?? (status === "vacant" ? "พร้อมเข้าอยู่" : "ยังไม่มีผู้เช่า")}</p>
      {rent != null && <p className="mt-1 text-sm font-semibold tabular-nums text-blue-700">{formatTHB(rent)}/ด.</p>}
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
      {children}
    </div>
  );
}
