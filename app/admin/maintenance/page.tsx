import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { MAINT_STATUS_LABEL, type MaintenanceStatus } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDateTH } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { maintenancePhotoUrls, statusOptions, updateMaintenanceStatus } from "./actions";

type Request = {
  id: string;
  room_id: string;
  category: string;
  priority: string;
  description: string | null;
  status: string;
  created_at: string;
  rooms: { room_no: string } | null;
};

type Update = {
  id: string;
  request_id: string;
  status: string;
  note: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

type Photo = {
  id: string;
  request_id: string;
  kind: string;
  created_at: string;
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "ไม่ด่วน",
  normal: "ปกติ",
  high: "ด่วน",
  urgent: "เร่งด่วน",
};

const QUEUE_ORDER = ["pending", "accepted", "in_progress", "waiting", "done", "closed"];

function statusLabel(status: string): string {
  return MAINT_STATUS_LABEL[status as MaintenanceStatus] ?? status;
}

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">งานซ่อม</h1>
          <p className="text-sm text-gray-500">รับเรื่อง เปลี่ยนสถานะ และแนบรูปผล</p>
        </div>
        <DemoBanner text="ยังไม่เชื่อม Supabase — คิวงานจริงจะแสดงเมื่อเชื่อมแล้ว" />
        <EmptyState
          title="ยังไม่มีงานซ่อม"
          desc="งานที่ผู้เช่าแจ้งผ่าน LINE จะเข้าคิวนี้อัตโนมัติ"
        />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: requestsRaw }, { data: updatesRaw }, { data: photosRaw }] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select("id,room_id,category,priority,description,status,created_at, rooms(room_no)")
      .order("created_at", { ascending: false }),
    supabase
      .from("maintenance_updates")
      .select("id,request_id,status,note,created_at, profiles(display_name)")
      .order("created_at", { ascending: true }),
    supabase
      .from("maintenance_photos")
      .select("id,request_id,kind,created_at")
      .order("created_at", { ascending: true }),
  ]);
  const requests = (requestsRaw ?? []) as unknown as Request[];
  const updates = (updatesRaw ?? []) as unknown as Update[];
  const photos = (photosRaw ?? []) as unknown as Photo[];

  const photoUrls = await maintenancePhotoUrls(photos.map((p) => p.id));
  const updatesByRequest = new Map<string, Update[]>();
  for (const u of updates) {
    const list = updatesByRequest.get(u.request_id) ?? [];
    list.push(u);
    updatesByRequest.set(u.request_id, list);
  }
  const photosByRequest = new Map<string, Photo[]>();
  for (const p of photos) {
    const list = photosByRequest.get(p.request_id) ?? [];
    list.push(p);
    photosByRequest.set(p.request_id, list);
  }

  const sorted = [...requests].sort((a, b) => {
    const d = QUEUE_ORDER.indexOf(a.status) - QUEUE_ORDER.indexOf(b.status);
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
  });
  // สถานะที่เปลี่ยนได้มาจากฟังก์ชันเดียวกับที่ฝั่ง server ตรวจซ้ำ
  const queue = await Promise.all(
    sorted.map(async (r) => ({ request: r, nextList: await statusOptions(r.status) })),
  );
  const counts = QUEUE_ORDER.map((s) => ({
    status: s,
    n: requests.filter((r) => r.status === s).length,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">งานซ่อม</h1>
        <p className="text-sm text-gray-500">
          รับเรื่อง → กำลังดำเนินการ → รออะไหล่ → เสร็จ → ผู้เช่ายืนยันปิดงาน (ทุกครั้งที่เปลี่ยนสถานะบันทึก audit)
        </p>
      </div>

      <Card title={`งานทั้งหมด ${requests.length}`} desc="เรียงตามคิว: งานใหม่มาก่อน">
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => (
            <Badge key={c.status} tone={c.status === "pending" ? "amber" : c.status === "closed" ? "gray" : "blue"}>
              {statusLabel(c.status)} {c.n}
            </Badge>
          ))}
        </div>
      </Card>

      {queue.length === 0 ? (
        <EmptyState title="ยังไม่มีงานซ่อม" desc="เมื่อผู้เช่าแจ้งปัญหาผ่าน LINE งานจะปรากฏที่นี่" />
      ) : (
        <div className="space-y-3">
          {queue.map(({ request: r, nextList }) => {
            const timeline = updatesByRequest.get(r.id) ?? [];
            const shots = photosByRequest.get(r.id) ?? [];
            return (
              <Card
                key={r.id}
                title={`ห้อง ${r.rooms?.room_no ?? "?"} · ${r.category}`}
                desc={`แจ้ง ${formatDateTH(r.created_at)} · ${PRIORITY_LABEL[r.priority] ?? r.priority}`}
                action={
                  <Badge tone={r.status === "pending" ? "amber" : r.status === "closed" ? "gray" : "blue"}>
                    {statusLabel(r.status)}
                  </Badge>
                }
              >
                {r.description && <p className="text-sm text-gray-700">{r.description}</p>}

                <form action={updateMaintenanceStatus} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="text-sm">
                      เปลี่ยนเป็น
                      <select
                        name="status"
                        defaultValue=""
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                      >
                        <option value="">ไม่เปลี่ยนสถานะ</option>
                        {nextList.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      หมายเหตุ / ผลงาน
                      <input
                        name="note"
                        placeholder="เช่น ส่งช่างแล้ว นัดเข้าห้องพรุ่งนี้"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm">
                      แนบรูปผล (สูงสุด 8 รูป)
                      <input
                        type="file"
                        name="photos"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        className="mt-1 w-full text-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs"
                      />
                    </label>
                  </div>
                  <button className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
                    อัปเดตงาน
                  </button>
                  {nextList.length === 0 && (
                    <p className="text-xs text-gray-400">
                      {r.status === "done"
                        ? "รอผู้เช่ายืนยันปิดงานจาก LINE — ยังเปิดงานใหม่ไม่ได้จนกว่าจะตกลงกับผู้ดูแล"
                        : "งานนี้ปิดแล้ว"}
                    </p>
                  )}
                </form>

                {shots.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold">รูปที่แนบ ({shots.length})</p>
                    <ul className="mt-1 flex flex-wrap gap-2 text-xs">
                      {shots.map((p) => (
                        <li key={p.id}>
                          {photoUrls[p.id] ? (
                            <a
                              href={photoUrls[p.id]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:underline"
                            >
                              {p.kind === "result" ? "ผลงาน" : "ผู้แจ้ง"} #{shots.indexOf(p) + 1}
                            </a>
                          ) : (
                            <span className="text-gray-400">เปิดรูปไม่ได้</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-sm font-semibold">ประวัติงาน ({timeline.length})</p>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-gray-400">ยังไม่มีการอัปเดต</p>
                  ) : (
                    <ol className="mt-1 space-y-1 text-xs text-gray-600">
                      {timeline.map((u) => (
                        <li key={u.id} className="border-l-2 border-gray-100 pl-2">
                          {formatDateTH(u.created_at)} · {statusLabel(u.status)} ·{" "}
                          {u.profiles?.display_name ?? "เจ้าหน้าที่"}
                          {u.note ? ` — ${u.note}` : ""}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}