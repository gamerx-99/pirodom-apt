import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
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
          <h1 className="text-xl font-bold text-gray-900">ห้องพักและร้านค้า</h1>
          <p className="text-sm text-gray-500">จัดการยูนิตและดูความพร้อมให้เช่า</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: แสดงข้อมูลตัวอย่าง" />
        <Card title={`ยูนิตทั้งหมด ${MOCK_ROOMS.length}`} desc="สถานะห้องแยกจากสถานะชำระเงิน">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MOCK_ROOMS.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-gray-900">{r.room_no}</p>
                  <Badge tone={r.status === "occupied" ? "green" : r.status === "vacant" ? "blue" : "gray"}>
                    {ROOM_STATUS_LABEL[r.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {r.unit_type === "commercial" ? "ร้านค้า" : "ห้องพัก"}
                  {r.floor ? ` · ชั้น ${r.floor}` : ""} · {r.tenant ?? "ยังไม่มีผู้เช่า"}
                </p>
              </div>
            ))}
          </div>
        </Card>
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
        <h1 className="text-xl font-bold text-gray-900">ห้องพักและร้านค้า</h1>
        <p className="text-sm text-gray-500">จัดการยูนิต {rooms?.length ?? 0} ยูนิต · รองรับห้องพักและร้านค้า</p>
      </div>
      <Card title="เพิ่มยูนิต" desc="เลขห้องต้องไม่ซ้ำกัน: สามารถสร้างสัญญาเช่าได้ที่เมนูสัญญา">
        <CreateRoomForm />
      </Card>
      {!rooms || rooms.length === 0 ? (
        <EmptyState title="ยังไม่มียูนิต" desc="เพิ่มยูนิตแรกด้วยฟอร์มด้านบน (เช่น 101 ถึง 118 และร้านค้ายูนิตที่ 1)" />
      ) : (
        <Card title={`ยูนิตทั้งหมด ${rooms.length}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((r) => {
              const tenants = tenantsByRoom.get(r.id) ?? [];
              return (
                <div key={r.id} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-900">{r.room_no}</p>
                    <Badge tone={r.status === "occupied" ? "green" : r.status === "vacant" ? "blue" : "gray"}>
                      {ROOM_STATUS_LABEL[r.status as keyof typeof ROOM_STATUS_LABEL] ?? r.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {r.unit_type === "commercial" ? "ร้านค้า" : "ห้องพัก"}
                    {r.floor != null ? ` · ชั้น ${r.floor}` : ""} · {tenants.length > 0 ? tenants.join(", ") : "ยังไม่มีผู้เช่า"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">เช่า {Number(r.rent_amount)}/ด. · ประกัน {Number(r.deposit)} · น้ำ {Number(r.water_fee)} · ไฟ {Number(r.electric_rate)}/หน่วย</p>
                  <RoomActions room={{ ...r, rent_amount: Number(r.rent_amount), deposit: Number(r.deposit), water_fee: Number(r.water_fee), electric_rate: Number(r.electric_rate) }} locked={tenantsByRoom.has(r.id)} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
