import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { formatDateTH, formatTHB } from "@/lib/format";
import { PAYMENT_STATUS_LABEL } from "@/lib/mock";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS, signedUrl } from "@/lib/storage";
import { ApprovePaymentForm, RecoverPaymentForm, RejectPaymentForm } from "./review-forms";
import { OPEN_PAYMENT_STATUSES } from "@/lib/payment-status";

type PaymentRow = {
  id: string;
  invoice_id: string;
  amount: number | null;
  status: string;
  slip_path: string;
  created_at: string;
  review_reason: string | null;
  payment_verifications: { id: string; result: string; provider_reference: string | null; checked_at: string }[];
  invoices: { total: number; period: string; due_date: string; leases: { rooms: { room_no: string } | null } | null } | null;
};

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return <div className="space-y-4"><h1 className="text-xl font-bold">คิวตรวจสลิป</h1><DemoBanner text="เชื่อมฐานข้อมูลแล้วคิวตรวจสลิปจริงจะแสดงที่นี่" /><EmptyState title="ยังไม่มีคิวตรวจจริง" /></div>;
  }
  const supabase = await createClient();
  const { data: raw, error } = await supabase.from("payments")
    .select("id,invoice_id,amount,status,slip_path,created_at,review_reason,invoices(total,period,due_date,leases(rooms(room_no))),payment_verifications(id,result,provider_reference,checked_at)")
    .in("status", OPEN_PAYMENT_STATUSES)
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
              return <li id={`payment-${p.id}`} key={p.id} className="scroll-mt-4 rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">ห้อง {invoice?.leases?.rooms?.room_no ?? "—"} · งวด {invoice?.period?.slice(0, 7) ?? "—"}</p>
                  <Badge tone={p.status === "mismatch" || p.status === "slipok_failed" ? "red" : p.status === "slipok_passed" ? "green" : "amber"}>{label}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">ยอดบิล {formatTHB(Number(invoice?.total ?? 0))} · ผลตรวจ {p.amount == null ? "ยังไม่มียอด" : formatTHB(Number(p.amount))} · ส่ง {formatDateTH(p.created_at)} · ครบกำหนด {invoice?.due_date ?? "—"}</p>
                {p.review_reason && <p className="mt-1 text-sm text-red-700">เหตุผลเดิม: {p.review_reason}</p>}
                {url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">เปิดรูปสลิป</a> : <p className="mt-2 text-sm text-red-700">เปิดไฟล์สลิปไม่ได้</p>}
                <details className="mt-2 text-xs text-gray-600">
                  <summary className="cursor-pointer font-semibold">Log ผลตรวจที่บันทึกไว้</summary>
                  <p className="mt-1 break-all">รหัสรายการ: {p.id}</p>
                  {(p.payment_verifications ?? []).length === 0 ? <p>ยังไม่มีผลตรวจที่บันทึกสำเร็จ กรุณาตรวจสอบรายการเดิมก่อนดำเนินการ</p> : (
                    <ul className="mt-1 space-y-2">{p.payment_verifications.map((log) => <VerificationLog key={log.id} log={log} />)}</ul>
                  )}
                </details>
                <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3">
                  {p.status === "uploaded" ? <RecoverPaymentForm id={p.id} /> : ["slipok_passed", "pending_review"].includes(p.status) ? (
                    <ApprovePaymentForm id={p.id} amount={p.amount == null ? null : Number(p.amount)} />
                  ) : <p className="text-sm text-red-700">ผลตรวจรายการนี้ไม่ผ่านเกณฑ์อนุมัติ กรุณาตรวจ log และสลิปก่อนดำเนินการ</p>}
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

function VerificationLog({ log }: { log: PaymentRow["payment_verifications"][number] }) {
  let status = "อ่านผลตรวจไม่ได้";
  let code: number | null = null;
  let reason = "";
  try {
    const parsed: unknown = JSON.parse(log.result);
    if (parsed && typeof parsed === "object") {
      const data = parsed as Record<string, unknown>;
      if (typeof data.status === "string") status = PAYMENT_STATUS_LABEL[data.status as keyof typeof PAYMENT_STATUS_LABEL] ?? "รอตรวจสอบผล";
      if (typeof data.code === "number") code = data.code;
      const reasons: Record<string, string> = { duplicate_reference: "reference นี้มีรายการใช้อยู่แล้ว", slipok_unavailable: "บริการตรวจสลิปไม่พร้อมใช้งาน", slipok_not_configured: "ยังไม่ตั้งค่าบริการตรวจสลิป" };
      if (typeof data.reason === "string") reason = reasons[data.reason] ?? "ต้องให้เจ้าหน้าที่ตรวจสอบ";
    }
  } catch { /* Keep malformed logs visible without treating them as valid results. */ }
  return <li className="rounded-lg bg-gray-50 p-2">
    <p>{formatDateTH(log.checked_at)} · {status}{code === null ? "" : ` · รหัสผล ${code}`}</p>
    {reason && <p>{reason}</p>}
    {log.provider_reference && <p className="break-all">Reference: {log.provider_reference}</p>}
  </li>;
}
