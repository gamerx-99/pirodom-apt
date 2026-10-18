// อ่าน session/DB ทุก request — ยกเว้น static-shell validation (Cache Components)
export const instant = false;
import Link from "next/link";
import { Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { formatDateTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS, signedUrl } from "@/lib/storage";
import LiffNav from "../components/nav";

type LeaseRef = {
  id: string;
  status: string;
  rooms: { room_no: string } | null;
};

type DocRow = {
  id: string;
  lease_id: string;
  type: string;
  file_path: string;
  created_at: string;
};

const TTL_MINUTES = Math.round(SIGNED_URL_TTL_SECONDS / 60);

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 pb-20">
        <div>
          <h1 className="text-xl font-bold text-gray-900">เอกสารของฉัน</h1>
          <p className="text-sm text-gray-500">สัญญาและเอกสารแนบ · เปิดได้เฉพาะสัญญาของห้องที่อยู่</p>
        </div>
        <DemoBanner text="ไฟล์จริงจะเปิดผ่าน Signed URL เมื่อเชื่อม Supabase แล้ว" />
        <Card title="ยังไม่มีเอกสาร">เอกสารจริงจะแสดงที่นี่เมื่อเจ้าหน้าที่อัปโหลด</Card>
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
        <h1 className="text-xl font-bold text-gray-900">เข้าสู่ระบบด้วย LINE</h1>
        <EmptyState
          title="ยังไม่ได้ผูกบัญชี"
          desc="เปิดหน้านี้ผ่าน LINE แล้วยืนยันตัวตน หากเพิ่งย้ายเข้าให้กดลิงก์เชิญจากผู้ดูแลก่อน"
        />
        <LiffNav />
      </div>
    );
  }

  // RLS จำกัดอยู่แล้ว แต่หน้านี้กรองซ้ำฝั่ง server เพื่อไม่ให้พึ่ง policy อย่างเดียว
  const { data: myLeasesRaw } = await supabase
    .from("lease_tenants")
    .select("leases(id,status,rooms(room_no))")
    .eq("profile_id", user.id);
  const refs = (myLeasesRaw ?? []) as unknown as { leases: LeaseRef | null }[];
  const active = refs.filter((r) => r.leases?.status === "active");
  if (active.length === 0) {
    return (
      <div className="space-y-4 pb-20">
        <h1 className="text-xl font-bold text-gray-900">เอกสารของฉัน</h1>
        <EmptyState
          title="ยังไม่มีห้องที่ผูกอยู่"
          desc="ถ้าเพิ่งย้ายเข้าใหม่ ให้ขอลิงก์เชิญจากผู้ดูแลอีกครั้ง (ลิงก์ใช้ได้ครั้งเดียว 7 วัน)"
        />
        <LiffNav />
      </div>
    );
  }

  const leaseIds = active.map((r) => r.leases!.id);
  const roomByLease = new Map(active.map((r) => [r.leases!.id, r.leases!.rooms?.room_no ?? "?"]));

  const { data: docsRaw } = await supabase
    .from("documents")
    .select("id,lease_id,type,file_path,created_at")
    .in("lease_id", leaseIds)
    .order("created_at", { ascending: false });
  const docs = (docsRaw ?? []) as unknown as DocRow[];

  // ลิงก์เปิดไฟล์ออกจาก server เท่านั้น ไม่ส่ง path ให้ client เรียกเอง
  const items = await Promise.all(
    docs.map(async (d) => {
      try {
        const url = await signedUrl("documents", d.file_path, SIGNED_URL_TTL_SECONDS);
        return { doc: d, room: roomByLease.get(d.lease_id) ?? "?", url };
      } catch {
        return { doc: d, room: roomByLease.get(d.lease_id) ?? "?", url: null };
      }
    }),
  );

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">เอกสารของฉัน</h1>
        <p className="text-sm text-gray-500">
          ห้อง {[...roomByLease.values()].join(", ")} · เห็นเฉพาะเอกสารของสัญญาที่อยู่
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีเอกสาร"
          desc="เจ้าหน้าที่ยังไม่ได้อัปโหลดเอกสารของห้องนี้ ถ้าคิดว่าควรมี สอบถามผู้ดูแลได้เลย"
        />
      ) : (
        <Card
          title={`เอกสาร (${items.length})`}
          desc={`ลิงก์เปิดไฟล์หมดอายุใน ${TTL_MINUTES} นาที ถ้าหมดอายุให้เปิดหน้านี้ใหม่`}
        >
          <ul className="space-y-2">
            {items.map(({ doc, room, url }) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{doc.type}</p>
                  <p className="text-xs text-gray-500">
                    ห้อง {room} · อัปโหลด {formatDateTH(doc.created_at)}
                  </p>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    เปิดดู
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-gray-400">เปิดไม่ได้</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="หมายเหตุ">
        <p className="text-sm text-gray-500">
          ขณะนี้เจ้าหน้าที่ระบุชื่อเอกสารตามสัญญาของแต่ละห้อง
        </p>
        <Link href="/liff" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">
          ← กลับหน้าหลัก
        </Link>
      </Card>
      <LiffNav />
    </div>
  );
}
