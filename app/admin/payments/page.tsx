import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { formatDateTH, formatTHB } from "@/lib/format";
import { PAYMENT_STATUS_LABEL } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS, signedUrl } from "@/lib/storage";
import { ApprovePaymentForm, RejectPaymentForm } from "./review-forms";

type PaymentRow = {
  id: string;
  invoice_id: string;
  amount: number | null;
  status: string;
  slip_path: string;
  created_at: string;
  review_reason: string | null;
  invoices: { total: number; period: string; due_date: string; leases: { rooms: { room_no: string } | null } | null } | null;
};

const OPEN_STATUSES = ["uploaded", "slipok_passed", "slipok_failed", "mismatch", "pending_review"];

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return <div className="space-y-4"><h1 className="text-xl font-bold">คิวตรวจสลิป</h1><DemoBanner text="เชื่อมฐานข้อมูลแล้วคิวตรวจสลิปจริงจะแสดงที่นี่" /><EmptyState title="ยังไม่มีคิวตรวจจริง" /></div>;
  }
  const supabase = await createClient();
  const { data: raw, error } = await supabase.from("payments")
    .select("id,invoice_id,amount,status,slip_path,created_at,review_reason,invoices(total,period,due_date,leases(rooms(room_no)))")
    .in("status", OPEN_STATUSES)
    .order("created_at", { ascending: true });
  if (error) return <div className="space-y-4"><h1 className="text-xl font-bold">คิวตรวจสลิป</h1><EmptyState title="โหลดคิวไม่สำเร็จ" desc="ตรวจสิทธิ์ฐานข้อมูลและลองเปิดหน้านี้ใหม่" /></div>;
  const payments = (raw ?? []) as unknown as PaymentRow[];
  const rows = await Promise.all(payments.map(async (payment) => {
    let url: string | null = null;
    try { url = await signedUrl("slips", payment.slip_path, SIGNED_URL_TTL_SECONDS); } catch { /* show unavailable state */ }
    return { payment, url };
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">คิวตรวจสลิป</h1>
        <p className="text-sm text-gray-500">ตรวจรูปสลิป เทียบยอดเต็มกับบิล และบันทึกผลพร้อม audit</p>
      </div>
      <Card title={`รอตรวจ ${rows.length} รายการ`} desc={`ไฟล์เปิดผ่าน Signed URL อายุ ${Math.round(SIGNED_URL_TTL_SECONDS / 60)} นาที`}>
        {rows.length === 0 ? <EmptyState title="ไม่มีรายการรอตรวจ" desc="สลิปใหม่จะเข้าคิวนี้หลังผู้เช่าส่งจากหน้า LIFF" /> : (
          <ul className="space-y-4">
            {rows.map(({ payment: p, url }) => {
              const invoice = p.invoices;
              const label = PAYMENT_STATUS_LABEL[p.status as keyof typeof PAYMENT_STATUS_LABEL] ?? p.status;
              return <li key={p.id} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">ห้อง {invoice?.leases?.rooms?.room_no ?? "—"} · งวด {invoice?.period?.slice(0, 7) ?? "—"}</p>
                  <Badge tone={p.status === "mismatch" || p.status === "slipok_failed" ? "red" : p.status === "slipok_passed" ? "green" : "amber"}>{label}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">ยอดบิล {formatTHB(Number(invoice?.total ?? 0))} · ผลตรวจ {p.amount == null ? "ยังไม่มียอด" : formatTHB(Number(p.amount))} · ส่ง {formatDateTH(p.created_at)} · ครบกำหนด {invoice?.due_date ?? "—"}</p>
                {p.review_reason && <p className="mt-1 text-sm text-red-700">เหตุผลเดิม: {p.review_reason}</p>}
                {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-lg bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-700">เปิดรูปสลิป</a> : <p className="mt-2 text-sm text-red-700">เปิดไฟล์สลิปไม่ได้</p>}
                <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3">
                  <ApprovePaymentForm id={p.id} amount={p.amount == null ? null : Number(p.amount)} />
                  <RejectPaymentForm id={p.id} />
                </div>
              </li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
