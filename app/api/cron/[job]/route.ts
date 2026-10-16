import { isCronRequest } from "@/lib/cron";

// งานตามบรีฟ 1.6 ตารางเวลาอยู่ใน vercel.json (เวลา UTC)
const JOBS = [
  "meter-reminder", //   วันที่ 1: เตือนแอดมินจดมิเตอร์
  "issue-invoices", //   วันที่ 25 และ 5: สร้างบิลจาก due_day ของแต่ละสัญญา
  "due-reminder", //     ทุกวัน 09:00: เตือนบิลครบกำหนดใน 3 วัน และวันครบกำหนด
  "mark-overdue", //     ทุกวัน 00:05: overdue + ค่าปรับ
  "lease-expiry", //     ทุกสัปดาห์: สัญญาหมดอายุใน 30 วัน
];

export async function GET(request: Request, { params }: RouteContext<"/api/cron/[job]">) {
  if (!isCronRequest(request)) return new Response("unauthorized", { status: 401 });
  const { job } = await params;
  if (!JOBS.includes(job)) return new Response("unknown job", { status: 404 });
  // TODO Phase 5: ลงมือทำแต่ละงาน (idempotent)
  return new Response("not implemented", { status: 501 });
}
