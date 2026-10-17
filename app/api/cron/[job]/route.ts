import { isCronConfigured, notConfiguredResponse } from "@/lib/env";
import { isCronRequest } from "@/lib/cron";
import { todayTH } from "@/lib/format";
import { audit } from "@/lib/phase1";
import { createAdminClient } from "@/lib/supabase/admin";

// งานตามบรีฟ 1.6 ตารางเวลาอยู่ใน vercel.json (เวลา UTC)
const JOBS = [
  "meter-reminder", //   วันที่ 1: เตือนแอดมินจดมิเตอร์
  "issue-invoices", //   วันที่ 25 และ 5: สร้างบิลจาก due_day ของแต่ละสัญญา
  "due-reminder", //     ทุกวัน 09:00: เตือนบิลครบกำหนดใน 3 วัน และวันครบกำหนด
  "mark-overdue", //     ทุกวัน 00:05: overdue + ค่าปรับ
  "lease-expiry", //     ทุกสัปดาห์: สัญญาหมดอายุใน 30 วัน
];

export async function GET(request: Request, { params }: RouteContext<"/api/cron/[job]">) {
  if (!isCronConfigured()) {
    return notConfiguredResponse(["CRON_SECRET"]);
  }
  if (!isCronRequest(request)) return new Response("unauthorized", { status: 401 });
  const { job } = await params;
  if (!JOBS.includes(job)) return new Response("unknown job", { status: 404 });
  if (job === "mark-overdue") {
    try {
      const admin = createAdminClient();
      const today = todayTH();
      const { data: due, error: readError } = await admin
        .from("invoices")
        .select("id,lease_id,due_date,total")
        .eq("status", "issued")
        .lt("due_date", today);
      if (readError) return Response.json({ error: "อ่านบิลไม่สำเร็จ" }, { status: 500 });
      if (!due?.length) return Response.json({ ok: true, marked: 0, date: today });

      const ids = due.map((invoice) => invoice.id);
      const { data: marked, error: updateError } = await admin
        .from("invoices")
        .update({ status: "overdue" })
        .in("id", ids)
        .eq("status", "issued")
        .select("id,lease_id,due_date,total");
      if (updateError) return Response.json({ error: "ปรับสถานะบิลไม่สำเร็จ" }, { status: 500 });

      for (const invoice of marked ?? []) {
        await audit(admin, {
          action: "invoice.mark_overdue",
          table_name: "invoices",
          record_id: invoice.id,
          before: { status: "issued" },
          after: { status: "overdue", lease_id: invoice.lease_id, due_date: invoice.due_date, total: invoice.total },
        });
      }
      return Response.json({ ok: true, marked: marked?.length ?? 0, date: today });
    } catch {
      return Response.json({ error: "ทำเครื่องหมายบิลค้างชำระไม่สำเร็จ" }, { status: 500 });
    }
  }
  // TODO Phase 5: ลงมือทำแต่ละงาน (idempotent)
  return new Response("not implemented", { status: 501 });
}

