import { Card, DemoBanner, EmptyState, StatCard } from "@/app/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { requireStaff } from "@/lib/phase1";
import { loadRecipients } from "@/lib/recipients";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MessageForm, ResendForm } from "./message-form";

type Log = {
  id: string;
  type: string;
  message: string | null;
  status: string;
  created_at: string;
  last_error: string | null;
  profiles: { display_name: string | null } | null;
};

const labels: Record<string, string> = {
  pending: "กำลังส่ง/รอตรวจสอบผล",
  sent: "ส่งแล้ว",
  failed: "ส่งไม่สำเร็จ",
  skipped: "ข้ามการส่ง",
};

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ส่งข้อความถึงผู้เช่า</h1>
          <p className="text-sm text-gray-500">แอดมินกดส่งเองผ่าน LINE ไม่มีการแจ้งเตือนตามเวลาอัตโนมัติ</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: ฟอร์มส่งข้อความและประวัติจะเปิดใช้งานเมื่อเชื่อมต่อระบบแล้ว" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="ผู้รับในสัญญา" value="0" icon="contract" />
          <StatCard label="บิลรอชำระ" value="0" icon="receipt" tone="amber" />
          <StatCard label="ส่งสำเร็จ" value="0" icon="check" tone="green" />
          <StatCard label="ส่งไม่สำเร็จ/ข้าม" value="0" icon="alert" tone="red" />
        </div>
        <Card title="ประวัติ LINE ล่าสุด">
          <p className="text-sm text-gray-500">เชื่อม Supabase แล้วประวัติการส่งจะแสดงที่นี่</p>
        </Card>
      </div>
    );
  }

  await requireStaff(await createClient());
  const admin = createAdminClient();

  let rooms;
  try {
    rooms = await loadRecipients(admin);
  } catch {
    return <EmptyState title="โหลดผู้รับไม่สำเร็จ" desc="ตรวจการเชื่อมต่อฐานข้อมูลแล้วลองใหม่" />;
  }

  const { data, error } = await admin
    .from("notifications")
    .select("id,type,message,status,created_at,last_error,profiles!notifications_profile_id_fkey(display_name)")
    .eq("channel", "line")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <EmptyState title="โหลดประวัติไม่สำเร็จ" desc="ตรวจว่า migration สำหรับข้อความถูกติดตั้งแล้ว แล้วลองใหม่" />;
  }

  const logs = (data ?? []) as unknown as Log[];
  const hasLineToken = Boolean(await getSetting("LINE_CHANNEL_ACCESS_TOKEN"));

  const recipientCount = rooms.length;
  const unpaidCount = rooms.filter((r) => r.unpaid > 0).length;
  const sentCount = logs.filter((l) => l.status === "sent").length;
  const failedOrSkippedCount = logs.filter((l) => ["failed", "skipped"].includes(l.status)).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ส่งข้อความถึงผู้เช่า</h1>
        <p className="text-sm text-gray-500">แอดมินกดส่งเองผ่าน LINE ไม่มีการแจ้งเตือนตามเวลาอัตโนมัติ</p>
      </div>

      {!hasLineToken && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          ยังไม่ได้ตั้งค่า LINE OA ข้อความจะบันทึกเป็น “ข้ามการส่ง” แล้วกดส่งซ้ำได้หลังตั้งค่า
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="ผู้รับในสัญญา" value={String(recipientCount)} icon="contract" />
        <StatCard label="บิลรอชำระ" value={String(unpaidCount)} icon="receipt" tone="amber" />
        <StatCard label="ส่งสำเร็จ" value={String(sentCount)} icon="check" tone="green" />
        <StatCard
          label="ส่งไม่สำเร็จ/ข้าม"
          value={String(failedOrSkippedCount)}
          icon="alert"
          tone={failedOrSkippedCount > 0 ? "red" : "default"}
        />
      </div>

      <Card title="สร้างข้อความ">
        {rooms.length ? (
          <MessageForm
            rooms={rooms.map((r) => ({
              leaseId: r.leaseId,
              roomNo: r.roomNo,
              unpaid: r.unpaid,
              nextDue: r.nextDue,
              names: r.tenants.map((t) => t.name ?? "ผู้เช่า").join(", "),
            }))}
          />
        ) : (
          <EmptyState title="ยังไม่มีผู้เช่าในสัญญาที่ใช้งาน" />
        )}
      </Card>

      <Card
        title="ประวัติ LINE ล่าสุด 100 รายการ"
        desc="รวมข้อความแอดมินและผลตรวจสลิป สถานะส่งแล้วหมายถึง LINE รับคำขอ ไม่ยืนยันว่าผู้เช่าอ่านข้อความแล้ว"
      >
        {logs.length ? (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-gray-100 p-3">
                <p className="font-semibold text-slate-900">
                  {log.profiles?.display_name ?? "ผู้เช่า"} · {labels[log.status] ?? log.status}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} ·{" "}
                  {log.type === "announcement" ? "ข้อความแอดมิน" : "ผลตรวจสลิป"}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {log.message ?? "ไม่มีข้อความเดิมบันทึกไว้"}
                </p>
                {log.last_error && <p className="mt-1 break-words text-sm text-red-700">{log.last_error}</p>}
                {log.message && ["failed", "skipped"].includes(log.status) && <ResendForm id={log.id} />}
                {log.status === "pending" && (
                  <p className="mt-1 text-sm text-amber-800">
                    หากสถานะค้าง กรุณาตรวจสอบผลการส่งก่อนส่งใหม่เพื่อป้องกันข้อความซ้ำ
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="ยังไม่มีประวัติการส่ง" />
        )}
      </Card>
    </div>
  );
}
