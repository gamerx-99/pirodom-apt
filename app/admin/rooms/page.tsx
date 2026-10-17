import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { MOCK_ROOMS, ROOM_STATUS_LABEL } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CreateRoomForm } from "./room-form";
import { updateRoomStatus } from "./actions";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ห้องพักและร้านค้า</h1>
          <p className="text-sm text-gray-500">จัดการยูนิตและดูความพร้อมให้เช่า</p>
        </div>
        <DemoBanner text="ยังไม่เชื่อม Supabase — แสดงข้อมูลตัวอย่าง" />
        <Card title={`ยูนิตทั้งหมด ${MOCK_ROOMS.length}`} desc="สถานะห้องแยกจากสถานะชำระเงิน">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
  const { data: rooms } = await supabase.from("rooms").select("id,room_no,unit_type,floor,status").order("room_no");
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
      <Card title="เพิ่มยูนิต" desc="เลขห้องซ้ำไม่ได้ — สร้างสัญญาที่หน้าสัญญาหลังจากนี้">
        <CreateRoomForm />
      </Card>
      {!rooms || rooms.length === 0 ? (
        <EmptyState title="ยังไม่มียูนิต" desc="เพิ่มยูนิตแรกด้วยฟอร์มด้านบน (เช่น 101–118 และร้านค้า 1 ยูนิต รวม 19 ยูนิตตามบรีฟ)" />
      ) : (
        <Card title={`ยูนิตทั้งหมด ${rooms.length}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  <form action={updateRoomStatus} className="mt-3 flex gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
                      <option value="vacant">ว่าง</option>
                      <option value="reserved">จองแล้ว</option>
                      <option value="occupied">มีผู้เช่า</option>
                      <option value="moving_out">รอย้ายออก</option>
                      <option value="maintenance">ปรับปรุง</option>
                    </select>
                    <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-700">
                      บันทึก
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
