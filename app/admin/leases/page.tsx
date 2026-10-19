import { Badge, Card, DemoBanner, EmptyState, StatCard } from "@/app/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { CreateLeaseForm, InviteButton } from "./lease-forms";
import { endLease, removeTenant, revokeInvite, setPrimaryTenant } from "./actions";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">สัญญาเช่า</h1>
          <p className="text-sm text-gray-500">เงื่อนไขรายสัญญา ผู้เช่าร่วม และรหัสยืนยันทาง LINE Bot</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: ฟอร์มสัญญาและรหัสยืนยันจะเปิดใช้งานเมื่อเชื่อมต่อระบบแล้ว" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="สัญญาทั้งหมด" value="3" icon="contract" />
          <StatCard label="กำลังเช่าอยู่" value="3" icon="check" tone="green" />
          <StatCard label="สิ้นสุดแล้ว" value="0" icon="logout" tone="default" />
          <StatCard label="มีผู้ผูก LINE" value="3" icon="door" tone="blue" />
        </div>
        <Card title="สัญญาตัวอย่าง" desc="due_day 31 = วันสุดท้ายของเดือน">
          <p className="text-sm text-gray-500">เชื่อม Supabase แล้วข้อมูลจริงจะแสดงที่นี่</p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: rooms } = await supabase.from("rooms").select("id,room_no,rent_amount,deposit,water_fee,electric_rate,due_day").order("room_no");
   type LeaseRow = {
     id: string;
     room_id: string;
     start_date: string;
     end_date: string | null;
     rent_amount: number;
     water_fee: number;
     electric_rate: number;
     due_day: number;
     deposit: number;
     status: string;
     drive_folders: { folder: string } | null;
     rooms: { room_no: string } | null;
     lease_tenants: {
       profile_id: string;
       is_primary: boolean;
       profiles: { display_name: string | null; phone: string | null } | null;
     }[] | null;
   };
   type InviteRow = { id: string; lease_id: string; expires_at: string; used_at: string | null; revoked_at: string | null };
   const { data: leasesRaw } = await supabase
     .from("leases")
     .select(
       "id,room_id,start_date,end_date,rent_amount,water_fee,electric_rate,due_day,deposit,status,drive_folders, rooms(room_no), lease_tenants(profile_id, is_primary, profiles(display_name, phone))",
     )
     .order("start_date", { ascending: false });
   const leases = (leasesRaw ?? []) as unknown as LeaseRow[];
   const leaseIds = leases.map((l) => l.id);
   const { data: invitesRaw } = leaseIds.length
     ? await supabase
         .from("room_invitations")
         .select("id,lease_id,expires_at,used_at,revoked_at")
         .in("lease_id", leaseIds)
         .order("expires_at", { ascending: false })
     : { data: [] as InviteRow[] };
   const invites = (invitesRaw ?? []) as unknown as InviteRow[];
   const invitesByLease = new Map<string, InviteRow[]>();
   for (const inv of invites) {
     const cur = invitesByLease.get(inv.lease_id) ?? [];
     cur.push(inv);
     invitesByLease.set(inv.lease_id, cur);
   }

  const activeCount = leases.filter((l) => l.status === "active").length;
  const endedCount = leases.filter((l) => l.status !== "active").length;
  const boundCount = leases.filter((l) => l.status === "active" && (l.lease_tenants?.length ?? 0) > 0).length;
  const pendingCount = leases.filter((l) => l.status === "active" && (l.lease_tenants?.length ?? 0) === 0).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">สัญญาเช่า</h1>
        <p className="text-sm text-gray-500">สร้างสัญญา เชิญผู้เช่าด้วยรหัสยืนยันทาง LINE Bot (7 วัน ใช้ครั้งเดียว) และปิดสัญญาเมื่อย้ายออก</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="สัญญาทั้งหมด" value={String(leases.length)} icon="contract" />
        <StatCard label="กำลังเช่าอยู่" value={String(activeCount)} icon="check" tone="green" />
        <StatCard label="สิ้นสุดแล้ว" value={String(endedCount)} icon="logout" tone="default" />
        <StatCard label="มีผู้ผูก LINE" value={String(boundCount)} sub={pendingCount > 0 ? `รอผูก ${pendingCount} ห้อง` : undefined} icon="door" tone="blue" />
      </div>
      <Card title="สร้างสัญญา" desc="1 ห้องมีสัญญาที่ใช้งานได้ 1 ฉบับ · กรอกอัตราค่าเช่าและเงินประกันตามที่ตกลงในสัญญา">
        <CreateLeaseForm rooms={rooms ?? []} />
      </Card>
      {!leases || leases.length === 0 ? (
        <EmptyState title="ยังไม่มีสัญญา" desc="สร้างสัญญาแรกจากฟอร์มด้านบน แล้วออกรหัสยืนยันให้ผู้เช่าส่งหา LINE Bot" />
      ) : (
        <div className="space-y-3">
          {leases.map((l) => {
             const tenants = l.lease_tenants ?? [];
            const invs = invitesByLease.get(l.id) ?? [];
            return (
              <Card
                key={l.id}
                title={`ห้อง ${l.rooms?.room_no ?? "?"} · ${l.status === "active" ? "active" : "ended"}`}
                desc={`เริ่ม ${l.start_date}${l.end_date ? ` – ${l.end_date}` : ""} · ครบกำหนดวันที่ ${l.due_day === 31 ? "31 (สิ้นเดือน)" : l.due_day} · เช่า ${l.rent_amount}/ด.`}
                action={<Badge tone={l.status === "active" ? "green" : "gray"}>{l.status}</Badge>}
              >
                <p className="text-sm text-gray-500">
                  น้ำ {l.water_fee} · ไฟ {l.electric_rate}/หน่วย · ประกัน {l.deposit}
                </p>
                {l.drive_folders?.folder && (
                  <a href={`https://drive.google.com/drive/folders/${encodeURIComponent(l.drive_folders.folder)}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-blue-700 hover:underline">
                    เปิดโฟลเดอร์ Google Drive (สลิป / เอกสาร)
                  </a>
                )}
                <div className="mt-2">
                  <p className="text-sm font-semibold">ผู้เช่า ({tenants.length})</p>
                  {tenants.length === 0 ? (
                    <p className="text-sm text-gray-400">ยังไม่มีผู้ผูกบัญชี (สามารถออกรหัสยืนยันให้ผู้เช่าส่งผ่าน LINE Bot ได้ที่ส่วนด้านล่าง)</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
{tenants.map((t) => (
                         <li key={t.profile_id} className="flex items-center justify-between gap-2 text-sm">
                           <span>
                             {t.profiles?.display_name ?? t.profile_id}
                             {t.profiles?.phone ? ` · ${t.profiles.phone}` : ""}
                             {t.is_primary ? " · ผู้เช่าหลัก" : ""}
                           </span>
                           <span className="flex items-center gap-2">
                             {!t.is_primary && (
                               <form action={setPrimaryTenant}>
                                 <input type="hidden" name="lease_id" value={l.id} />
                                 <input type="hidden" name="profile_id" value={t.profile_id} />
                                 <button className="text-xs text-gray-500 hover:underline">ตั้งเป็นหลัก</button>
                               </form>
                             )}
                             <form action={removeTenant}>
                               <input type="hidden" name="lease_id" value={l.id} />
                               <input type="hidden" name="profile_id" value={t.profile_id} />
                               <button className="text-xs text-red-600 hover:underline">ถอนสิทธิ์</button>
                             </form>
                           </span>
                         </li>
                       ))}
                    </ul>
                  )}
                </div>
                {l.status === "active" && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-sm font-semibold">คำเชิญ ({invs.length})</p>
                    {invs.length > 0 && (
                      <ul className="mt-1 space-y-1 text-xs text-gray-500">
                        {invs.map((v) => {
                          const state = v.used_at ? "ใช้แล้ว" : v.revoked_at ? "เพิกถอนแล้ว" : new Date(v.expires_at) < new Date() ? "หมดอายุ" : `ใช้ได้ถึง ${new Date(v.expires_at).toLocaleDateString("th-TH")}`;
                          return (
                            <li key={v.id} className="flex items-center justify-between gap-2">
                              <span>
                                {v.id.slice(0, 8)}… · {state}
                              </span>
                              {!v.used_at && !v.revoked_at && (
                                <form action={revokeInvite}>
                                  <input type="hidden" name="id" value={v.id} />
                                  <button className="text-xs text-red-600 hover:underline">เพิกถอน</button>
                                </form>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <InviteButton leaseId={l.id} />
                    <form action={endLease} className="mt-2">
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100">
                        ปิดสัญญา (ย้ายออก)
                      </button>
                    </form>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
