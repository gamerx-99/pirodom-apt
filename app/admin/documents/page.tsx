import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { formatDateTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS, signedUrl } from "@/lib/storage";
import { deleteDocument, uploadDocument } from "./actions";

type LeaseRow = {
  id: string;
  status: string;
  start_date: string;
  rooms: { room_no: string } | null;
};

type DocRow = {
  id: string;
  lease_id: string;
  type: string;
  file_path: string;
  created_at: string;
  leases: { rooms: { room_no: string } | null } | null;
};

/** ลิงก์ดูไฟล์ต้องให้ server ออก Signed URL ทุกครั้ง (bucket private) — ไฟล์หายไปก็แสดงว่าเปิดไม่ได้ ไม่ทำให้ทั้งหน้าพัง */
async function openUrl(filePath: string): Promise<string | null> {
  try {
    return await signedUrl("documents", filePath, SIGNED_URL_TTL_SECONDS);
  } catch {
    return null;
  }
}

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">เอกสารสัญญา</h1>
          <p className="text-sm text-gray-500">อัปโหลดสัญญา/เอกสารแนบ แล้วผูกกับสัญญาห้องนั้น</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: ฟอร์มอัปโหลดและรายการเอกสารจะเปิดใช้งานเมื่อเชื่อมต่อระบบแล้ว" />
        <Card title="ตัวอย่างรายการ">
          <p className="text-sm text-gray-500">เชื่อม Supabase แล้วเอกสารจริงจะแสดงที่นี่</p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: leasesRaw } = await supabase
    .from("leases")
    .select("id,status,start_date,rooms(room_no)")
    .order("start_date", { ascending: false });
  const leases = (leasesRaw ?? []) as unknown as LeaseRow[];

  const { data: docsRaw } = await supabase
    .from("documents")
    .select("id,lease_id,type,file_path,created_at,leases(rooms(room_no))")
    .order("created_at", { ascending: false });
  const docs = (docsRaw ?? []) as unknown as DocRow[];

  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const roomByLease = new Map<string, string>();
  for (const l of leases) roomByLease.set(l.id, l.rooms?.room_no ?? "?");

  // โหลดชื่อไฟล์ที่แสดงผล + Signed URL (ห้องแอดมินอ่านได้ทุกสัญญา)
  const rows = await Promise.all(
    docs.map(async (d) => ({
      doc: d,
      url: await openUrl(d.file_path),
      fileName: d.file_path.split("/").slice(2).join("/") || d.file_path,
    })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">เอกสารสัญญา</h1>
        <p className="text-sm text-gray-500">
          อัปโหลด PDF หรือรูปภาพ ผูกกับสัญญาที่เลือก · ผู้เช่าเห็นเฉพาะเอกสารของสัญญาตนเอง
        </p>
      </div>

      <Card
        title="อัปโหลดเอกสาร"
        desc="ชนิดไฟล์: PDF, JPG, PNG ไม่เกิน 10 MB · path เก็บเป็น documents/<สัญญา>/<ไฟล์> ตามสิทธิ์ฝั่ง storage"
      >
        <form action={uploadDocument} className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            สัญญา
            <select
              name="lease_id"
              required
              defaultValue=""
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            >
              <option value="" disabled>
                เลือกสัญญา
              </option>
              {leases.map((l) => (
                <option key={l.id} value={l.id}>
                  ห้อง {l.rooms?.room_no ?? "?"} · {l.status === "active" ? "active" : "ended"} · เริ่ม{" "}
                  {l.start_date}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            ชื่อ/ชนิดเอกสาร
            <input
              name="type"
              required
              maxLength={120}
              placeholder="เช่น สัญญาเช่า, พิมพ์เขียวห้อง"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            ไฟล์
            <input
              name="file"
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png"
              className="mt-1 w-full text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              อัปโหลดและผูกกับสัญญา
            </button>
            <p className="mt-1 text-xs text-gray-400">
              สามารถพิมพ์ระบุชื่อเอกสารหรือประเภทสัญญาได้อิสระ
            </p>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="ยังไม่มีเอกสาร"
          desc="อัปโหลดเอกสารสัญญาฉบับแรกจากฟอร์มด้านบน แล้วผู้เช่าจะเห็นและเปิดได้จากหน้าเอกสารของตน"
        />
      ) : (
        <Card
          title={`เอกสารทั้งหมด (${rows.length})`}
          desc={`ลิงก์เปิดไฟล์เป็น Signed URL อายุ ${Math.round(SIGNED_URL_TTL_SECONDS / 60)} นาที · หมดอายุแล้วให้เปิดหน้านี้ใหม่`}
        >
          <ul className="space-y-2">
            {rows.map(({ doc, url, fileName }) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{doc.type}</p>
                  <p className="text-xs text-gray-500">
                    ห้อง {doc.leases?.rooms?.room_no ?? roomByLease.get(doc.lease_id) ?? "?"} ·{" "}
                    {formatDateTH(doc.created_at)} · {fileName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={leaseById.get(doc.lease_id)?.status === "active" ? "green" : "gray"}>
                    {leaseById.get(doc.lease_id)?.status ?? "ไม่พบสัญญา"}
                  </Badge>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                    >
                      เปิดไฟล์
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">ไม่สามารถเปิดไฟล์ได้</span>
                  )}
                  <form action={deleteDocument}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="lease_id" value={doc.lease_id} />
                    <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
                      ลบ
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
