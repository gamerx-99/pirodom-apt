// อ่าน session/DB ทุก request — ยกเว้น static-shell validation (Cache Components)
export const instant = false;
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Badge, Card, EmptyState } from "@/app/components/ui";
import LiffNav from "../components/nav";
import { MAINT_STATUS_LABEL, type MaintenanceStatus } from "@/lib/mock";
import { formatDateTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { audit } from "@/lib/phase1";
import { signedUrl, storagePath, uploadPrivateFile } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CATEGORIES = ["ไฟฟ้า", "ประปา", "แอร์", "เฟอร์นิเจอร์", "ประตู/กุญแจ", "อื่นๆ"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const PRIORITY_LABEL: Record<string, string> = {
  low: "ไม่ด่วน",
  normal: "ปกติ",
  high: "ด่วน",
  urgent: "เร่งด่วน",
};
const MAX_PHOTOS = 6;

type RequestRow = {
  id: string;
  room_id: string;
  category: string;
  priority: string;
  description: string | null;
  status: string;
  created_at: string;
  rooms: { room_no: string } | null;
};

type UpdateRow = {
  id: string;
  request_id: string;
  status: string;
  note: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

type PhotoRow = {
  id: string;
  request_id: string;
  kind: string;
  file_path: string;
  created_at: string;
};

function statusLabel(status: string): string {
  return MAINT_STATUS_LABEL[status as MaintenanceStatus] ?? status;
}

/** ชื่อไฟล์ตาม path policy: maintenance/<room_id>/<request_id>/<file> */
function photoName(file: File, index: number): string {
  const ext = /\.(jpg|jpeg|png|webp)$/i.exec(file.name)?.[0].toLowerCase() ?? ".jpg";
  return `t${index + 1}-${Date.now()}${ext === ".jpeg" ? ".jpg" : ext}`;
}

export default async function Page({ searchParams }: PageProps<"/liff/maintenance">) {
  const notice = await searchParams;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">แจ้งซ่อม</h1>
        <EmptyState
          title="ยังไม่ได้เชื่อมฐานข้อมูล"
          desc="ฟอร์มแจ้งซ่อมจะใช้ได้เมื่อเชื่อม Supabase แล้ว"
        />
        <LiffNav />
      </div>
    );
  }

  // ---------- server actions ของฝั่งผู้เช่า (ประกาศในหน้า เพราะไม่มีไฟล์ action ของ LIFF) ----------

  async function submitRequest(form: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("กรุณาเปิดผ่าน LINE และเข้าสู่ระบบก่อนแจ้งซ่อม");

    const room_id = String(form.get("room_id") ?? "");
    const category = String(form.get("category") ?? "").trim();
    const priority = String(form.get("priority") ?? "normal");
    const description = String(form.get("description") ?? "").trim().slice(0, 2000);

    // ห้องที่ผู้ใช้เปิดแจ้งได้ = ห้องของสัญญา active ของเขาเอง (เชื่อค่าจาก client ไม่ได้)
    const { data: myLeasesRaw } = await supabase
      .from("leases")
      .select("room_id")
      .eq("status", "active");
    const myRooms = ((myLeasesRaw ?? []) as unknown as { room_id: string }[]).map(
      (l) => l.room_id,
    );
    if (!room_id || !myRooms.includes(room_id)) {
      throw new Error("แจ้งซ่อมได้เฉพาะห้องที่คุณเช่าอยู่");
    }
    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      throw new Error("เลือกหมวดงาน");
    }
    if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
      throw new Error("เลือกความเร่งด่วน");
    }
    if (description.length < 3) throw new Error("เขียนรายละเอียดอาการอย่างน้อย 3 ตัวอักษร");

    // เขียนด้วย session ของผู้เช่าเอง → RLS + สิทธิ์ระดับคอลัมน์ที่มีอยู่แล้วคุมอีกชั้น
    const { data, error } = await supabase
      .from("maintenance_requests")
      .insert({ room_id, category, priority, description })
      .select("id")
      .single();
    if (error) throw new Error(`แจ้งซ่อมไม่สำเร็จ: ${error.message}`);
    const requestId = data.id as string;

    const admin = createAdminClient();
    const files = form
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_PHOTOS);
    let failed = 0;
    const paths: string[] = [];
    for (const [i, file] of files.entries()) {
      try {
        const path = storagePath("maintenance", room_id, requestId, photoName(file, i));
        paths.push(await uploadPrivateFile("maintenance", path, file));
      } catch {
        failed += 1;
      }
    }
    if (paths.length > 0) {
      await admin
        .from("maintenance_photos")
        .insert(paths.map((file_path) => ({ request_id: requestId, kind: "reported", file_path, uploaded_by: user.id })));
    }
    await audit(admin, {
      actor_id: user.id,
      action: "maintenance.create",
      table_name: "maintenance_requests",
      record_id: requestId,
      after: { room_id, category, priority, photos: paths.length },
    });
    revalidatePath("/liff/maintenance");
    revalidatePath("/admin/maintenance");
    redirect(failed > 0 ? "/liff/maintenance?sent=1&photo=failed" : "/liff/maintenance?sent=1");
  }

  async function confirmClosed(form: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("กรุณาเปิดผ่าน LINE และเข้าสู่ระบบก่อน");

    const id = String(form.get("id") ?? "");
    if (!id) throw new Error("ไม่พบงานที่จะยืนยัน");
    // อ่านด้วย session ของผู้เช่า → RLS ตัดงานของห้อง/ช่วงสัญญาอื่นทิ้ง
    const { data } = await supabase
      .from("maintenance_requests")
      .select("id,room_id,status")
      .eq("id", id)
      .maybeSingle();
    const request = data as unknown as { id: string; room_id: string; status: string } | null;
    if (!request) throw new Error("ไม่พบงานนี้ หรือไม่มีสิทธิ์ดูงานนี้");

    const { data: myLeasesRaw } = await supabase.from("leases").select("room_id").eq("status", "active");
    const myRooms = ((myLeasesRaw ?? []) as unknown as { room_id: string }[]).map((l) => l.room_id);
    if (!myRooms.includes(request.room_id)) {
      throw new Error("ยืนยันปิดงานได้เฉพาะงานของห้องที่คุณเช่าอยู่");
    }
    if (request.status !== "done") throw new Error("งานนี้ยังไม่พร้อมให้ยืนยันปิด");

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("maintenance_requests")
      .update({ status: "closed" })
      .eq("id", id)
      .eq("status", "done")
      .select("id");
    if (error) throw new Error(`ปิดงานไม่สำเร็จ: ${error.message}`);
    if (!updated || updated.length === 0) {
      throw new Error("สถานะงานเปลี่ยนไปแล้ว — รีเฟรชแล้วลองใหม่");
    }
    await admin.from("maintenance_updates").insert({
      request_id: id,
      status: "closed",
      note: String(form.get("note") ?? "").trim().slice(0, 500) || "ผู้เช่ายืนยันปิดงาน",
      created_by: user.id,
    });
    await audit(admin, {
      actor_id: user.id,
      action: "maintenance.tenant_close",
      table_name: "maintenance_requests",
      record_id: id,
      before: { status: "done" },
      after: { status: "closed" },
    });
    revalidatePath("/liff/maintenance");
    revalidatePath("/admin/maintenance");
    redirect("/liff/maintenance?closed=1");
  }

  // ---------- อ่านข้อมูลจริง ----------

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">แจ้งซ่อม</h1>
        <Card title="ยังไม่ได้ผูกบัญชี" desc="เปิดผ่าน LINE เพื่อยืนยันตัวตนก่อน">
          <p className="text-sm text-gray-500">
            ถ้ามีลิงก์เชิญจากผู้ดูแลหอพัก ให้กดลิงก์นั้นเพื่อผูกห้องก่อนแจ้งซ่อม
          </p>
        </Card>
        <LiffNav />
      </div>
    );
  }

  const { data: leasesRaw } = await supabase
    .from("leases")
    .select("room_id, rooms(id,room_no,unit_type)")
    .eq("status", "active");
  const rooms = ((leasesRaw ?? []) as unknown as {
    room_id: string;
    rooms: { id: string; room_no: string; unit_type: string } | null;
  }[])
    .map((l) => l.rooms)
    .filter((r): r is { id: string; room_no: string; unit_type: string } => !!r);

  const { data: requestsRaw } = await supabase
    .from("maintenance_requests")
    .select("id,room_id,category,priority,description,status,created_at, rooms(room_no)")
    .order("created_at", { ascending: false })
    .limit(20);
  const requests = (requestsRaw ?? []) as unknown as RequestRow[];
  const requestIds = requests.map((r) => r.id);

  const [{ data: updatesRaw }, { data: photosRaw }] = await Promise.all([
    requestIds.length
      ? supabase
          .from("maintenance_updates")
          .select("id,request_id,status,note,created_at, profiles(display_name)")
          .in("request_id", requestIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
    requestIds.length
      ? supabase
          .from("maintenance_photos")
          .select("id,request_id,kind,file_path,created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);
  const updates = (updatesRaw ?? []) as unknown as UpdateRow[];
  const photos = (photosRaw ?? []) as unknown as PhotoRow[];

  const updatesByRequest = new Map<string, UpdateRow[]>();
  for (const u of updates) {
    const list = updatesByRequest.get(u.request_id) ?? [];
    list.push(u);
    updatesByRequest.set(u.request_id, list);
  }
  const photosByRequest = new Map<string, PhotoRow[]>();
  const photoUrls: Record<string, string> = {};
  for (const p of photos) {
    const list = photosByRequest.get(p.request_id) ?? [];
    list.push(p);
    photosByRequest.set(p.request_id, list);
    try {
      photoUrls[p.id] = await signedUrl("maintenance", p.file_path);
    } catch {
      // เปิดรูปไม่ได้ — ข้ามรายการนี้
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">แจ้งซ่อม</h1>
        <p className="text-sm text-gray-500">แจ้งปัญหาพร้อมรูป แล้วติดตามจนผู้ดูแลปิดงาน</p>
      </div>

      {notice.sent && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          แจ้งซ่อมแล้ว — เจ้าหน้าที่จะเข้ามารับเรื่อง
          {notice.photo === "failed" && " · บางรูปอัปโหลดไม่สำเร็จ ถ้าจำเป็นแจ้งรูปเพิ่มได้"}
        </p>
      )}
      {notice.closed && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ยืนยันปิดงานแล้ว — ขอบคุณที่แจ้งปัญหา
        </p>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          title="ยังไม่มีห้องที่ผูกอยู่"
          desc="แจ้งซ่อมได้หลังผูกห้องด้วยลิงก์เชิญจากผู้ดูแล (ลิงก์ใช้ได้ครั้งเดียว 7 วัน)"
        />
      ) : (
        <Card title="แจ้งปัญหาใหม่" desc={`แนบรูปได้สูงสุด ${MAX_PHOTOS} รูป (jpg/png/webp)`}>
          <form action={submitRequest} className="space-y-3">
            {rooms.length > 1 ? (
              <label className="block text-sm">
                ห้อง
                <select
                  name="room_id"
                  required
                  defaultValue={rooms[0].id}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_no}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="room_id" value={rooms[0].id} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                หมวด
                <select
                  name="category"
                  required
                  defaultValue={CATEGORIES[0]}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                ความเร่งด่วน
                <select
                  name="priority"
                  defaultValue="normal"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              รายละเอียดอาการ
              <textarea
                name="description"
                rows={3}
                required
                maxLength={2000}
                placeholder="เช่น ปลั๊กไฟห้องนอนไม่ติด สวิตช์ติดแต่ไฟไม่มา"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              รูปปัญหา
              <input
                type="file"
                name="photos"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="mt-1 w-full text-sm text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm"
              />
            </label>
            <button className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700">
              ส่งเรื่อง
            </button>
          </form>
        </Card>
      )}

      <Card title="งานของฉัน" desc={`${requests.length} รายการ`}>
        {requests.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีงานซ่อมของคุณ</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const timeline = updatesByRequest.get(r.id) ?? [];
              const shots = photosByRequest.get(r.id) ?? [];
              return (
                <li key={r.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      ห้อง {r.rooms?.room_no ?? "?"} · {r.category}
                    </span>
                    <Badge tone={r.status === "done" ? "green" : r.status === "closed" ? "gray" : "amber"}>
                      {statusLabel(r.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{r.description}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    แจ้ง {formatDateTH(r.created_at)} · {PRIORITY_LABEL[r.priority] ?? r.priority}
                  </p>

                  {shots.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                      {shots.map((p, i) => (
                        <li key={p.id}>
                          {photoUrls[p.id] ? (
                            <a
                              href={photoUrls[p.id]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:underline"
                            >
                              {p.kind === "result" ? "ผลงาน" : "รูปที่แจ้ง"} #{i + 1}
                            </a>
                          ) : (
                            <span className="text-gray-400">รูป #{i + 1} เปิดไม่ได้</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {timeline.length > 0 && (
                    <ol className="mt-2 space-y-1 text-xs text-gray-600">
                      {timeline.map((u) => (
                        <li key={u.id} className="border-l-2 border-gray-100 pl-2">
                          {formatDateTH(u.created_at)} · {statusLabel(u.status)} ·{" "}
                          {u.profiles?.display_name ?? "เจ้าหน้าที่"}
                          {u.note ? ` — ${u.note}` : ""}
                        </li>
                      ))}
                    </ol>
                  )}

                  {r.status === "done" && (
                    <form action={confirmClosed} className="mt-3 rounded-xl bg-emerald-50 p-3">
                      <input type="hidden" name="id" value={r.id} />
                      <p className="text-sm text-emerald-900">
                        เจ้าหน้าที่แจ้งว่าซ่อมเสร็จแล้ว — ตรวจงานแล้วใช่ไหม?
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          name="note"
                          placeholder="หมายเหตุ (ถ้ามี)"
                          className="min-w-0 flex-1 rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                          ยืนยันปิดงาน
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <LiffNav />
    </div>
  );
}