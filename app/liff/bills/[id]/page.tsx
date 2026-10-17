import Link from "next/link";
import QRCode from "qrcode";
import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { getEnv, isSupabaseConfigured } from "@/lib/env";
import { formatDateTH, formatTHB, invoiceStatusForDisplay, todayTH } from "@/lib/format";
import { INVOICE_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/mock";
import { promptPayPayload } from "@/lib/promptpay";
import { createClient } from "@/lib/supabase/server";
import { SlipUpload } from "./slip-upload";

type Invoice = {
  id: string;
  lease_id: string;
  period: string;
  issue_date: string | null;
  due_date: string;
  total: number;
  status: string;
  leases: { rooms: { room_no: string } | null } | null;
};

type InvoiceItem = {
  id: string;
  type: string;
  description: string | null;
  qty: number;
  unit_price: number;
  amount: number;
};

const ITEM_LABEL: Record<string, string> = {
  rent: "ค่าเช่า",
  water: "ค่าน้ำ",
  electric: "ค่าไฟ",
  extra: "รายการเพิ่มเติม",
  discount: "ส่วนลด",
  penalty: "ค่าปรับ",
};

async function PromptPayQr({ amount }: { amount: number }) {
  const promptPayId = getEnv("PROMPTPAY_ID");
  const payload = promptPayId ? promptPayPayload(promptPayId, amount) : null;
  if (!payload) {
    return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">รอข้อมูลบัญชีรับเงิน: ยังแสดง QR PromptPay ไม่ได้ กรุณาสอบถามช่องทางโอนจากเจ้าหน้าที่</p>;
  }
  const src = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
  const name = getEnv("PROMPTPAY_ACCOUNT_NAME");
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-white p-3 text-center ring-1 ring-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL; กดค้างเพื่อบันทึกรูปไปสแกนในแอปธนาคารได้ */}
      <img src={src} alt={`QR PromptPay ยอด ${formatTHB(amount)}`} width={240} height={240} />
      <p className="text-sm font-semibold">สแกนจ่าย {formatTHB(amount)}</p>
      {name && <p className="text-xs text-gray-500">บัญชี {name}</p>}
      <p className="text-xs text-gray-500">โอนแล้วส่งสลิปด้านล่าง</p>
    </div>
  );
}

const badgeTone = (status: string) =>
  status === "paid" ? "green" : status === "overdue" ? "red" : "amber";

export default async function Page({ params }: PageProps<"/liff/bills/[id]">) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4 pb-20">
        <Link href="/liff" className="text-sm font-semibold text-teal-700">← กลับหน้าหลัก</Link>
        <DemoBanner text="รายละเอียดด้านล่างเป็นข้อมูลตัวอย่าง ไม่ใช่ยอดเรียกเก็บจริง" />
        <Card title="บิลห้องตัวอย่าง · ต.ค. 2569" desc={`รหัส ${id} · ครบกำหนด 30 ก.ย. 2569`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-3xl font-bold">{formatTHB(3720)}</p>
            <Badge tone="amber">รอชำระ</Badge>
          </div>
        </Card>
        <Card title="รายการคิดเงิน">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>ค่าเช่า</span><span>{formatTHB(3500)}</span></li>
            <li className="flex justify-between"><span>ค่าน้ำเหมาจ่าย</span><span>{formatTHB(100)}</span></li>
            <li className="flex justify-between"><span>ค่าไฟ 87 หน่วย × 8 บาท</span><span>{formatTHB(696)}</span></li>
            <li className="flex justify-between text-gray-500"><span>ส่วนลด</span><span>-{formatTHB(576)}</span></li>
          </ul>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4 pb-20">
        <Link href="/liff" className="text-sm font-semibold text-teal-700">← กลับหน้าหลัก</Link>
        <EmptyState title="กรุณาเข้าสู่ระบบด้วย LINE" desc="เปิดหน้านี้ผ่าน LINE LIFF เพื่อดูบิลของสัญญาที่ผูกกับบัญชี" />
      </div>
    );
  }

  const { data: rawInvoice, error } = await supabase
    .from("invoices")
    .select("id,lease_id,period,issue_date,due_date,total,status,leases(rooms(room_no))")
    .eq("id", id)
    .maybeSingle();
  if (error || !rawInvoice) {
    return (
      <div className="space-y-4 pb-20">
        <Link href="/liff" className="text-sm font-semibold text-teal-700">← กลับหน้าหลัก</Link>
        <EmptyState title="ไม่พบบิลนี้" desc="บิลอาจถูกยกเลิก หรือบัญชีนี้ไม่มีสิทธิ์ดูรายการดังกล่าว" />
      </div>
    );
  }

  const invoice = rawInvoice as unknown as Invoice;
  if (invoice.status === "draft" || invoice.status === "void") {
    return (
      <div className="space-y-4 pb-20">
        <Link href="/liff" className="text-sm font-semibold text-teal-700">← กลับหน้าหลัก</Link>
        <EmptyState title="ไม่พบบิลที่เปิดดูได้" desc="รายการนี้ยังไม่ออกบิลหรือถูกยกเลิกแล้ว" />
      </div>
    );
  }

  const { data: rawItems, error: itemError } = await supabase
    .from("invoice_items")
    .select("id,type,description,qty,unit_price,amount")
    .eq("invoice_id", invoice.id);
  const items = itemError ? [] : (rawItems ?? []) as unknown as InvoiceItem[];
  const { data: paymentsRaw } = await supabase.from("payments")
    .select("id,status,amount,created_at,review_reason")
    .eq("invoice_id", invoice.id)
    .order("created_at", { ascending: false });
  const payments = paymentsRaw ?? [];
  const status = invoiceStatusForDisplay(invoice.status, invoice.due_date, todayTH());
  const activePayment = payments.find((payment) => ["uploaded", "slipok_passed", "slipok_failed", "mismatch", "pending_review"].includes(payment.status));
  const latestRejected = payments.find((payment) => payment.status === "rejected");

  return (
    <div className="space-y-4 pb-20">
      <Link href="/liff" className="text-sm font-semibold text-teal-700">← กลับหน้าหลัก</Link>
      <div>
        <h1 className="text-xl font-bold text-gray-900">บิลห้อง {invoice.leases?.rooms?.room_no ?? "—"}</h1>
        <p className="text-sm text-gray-500">
          งวด {invoice.period.slice(0, 7)} · {invoice.issue_date ? `ออก ${formatDateTH(invoice.issue_date)} · ` : ""}
          ครบกำหนด {formatDateTH(invoice.due_date)}
        </p>
      </div>
      <Card title="ยอดที่ต้องชำระ">
        <div className="flex items-center justify-between gap-3">
          <p className="text-3xl font-bold">{formatTHB(Number(invoice.total))}</p>
          <Badge tone={badgeTone(status)}>
            {INVOICE_STATUS_LABEL[status as keyof typeof INVOICE_STATUS_LABEL] ?? status}
          </Badge>
        </div>
      </Card>
      <Card title="รายการคิดเงิน">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีรายละเอียดรายการในบิลนี้</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 border-b border-gray-50 pb-2">
                <span>
                  <span className="font-medium">{item.description || ITEM_LABEL[item.type] || item.type}</span>
                  {Number(item.qty) !== 1 && (
                    <span className="block text-xs text-gray-500">
                      {Number(item.qty)} × {formatTHB(Number(item.unit_price))}
                    </span>
                  )}
                </span>
                <span className="shrink-0">{formatTHB(Number(item.amount))}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-gray-200 pt-2 font-bold">
              <span>รวม</span><span>{formatTHB(Number(invoice.total))}</span>
            </li>
          </ul>
        )}
      </Card>
      <Card title="ชำระเงิน" desc="ส่งสลิปแล้วรอเจ้าหน้าที่ตรวจสอบและยืนยันยอด">
        {status === "paid" ? <p className="text-sm text-emerald-700">บิลนี้ชำระแล้ว</p> : activePayment ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium">{PAYMENT_STATUS_LABEL[activePayment.status as keyof typeof PAYMENT_STATUS_LABEL] ?? "รอตรวจ"}</p>
            {activePayment.status === "uploaded" && <p className="text-amber-800">ระบบเก็บสลิปไว้แล้ว เจ้าหน้าที่จะตรวจสอบรายการเดิม ไม่ต้องโอนเงินหรือส่งสลิปใหม่</p>}
            <p className="text-gray-500">ส่งเมื่อ {formatDateTH(activePayment.created_at)}{activePayment.amount == null ? "" : ` · ผลตรวจยอด ${formatTHB(Number(activePayment.amount))}`}</p>
            {activePayment.review_reason && <p className="text-red-700">เหตุผล: {activePayment.review_reason}</p>}
          </div>
        ) : status === "issued" || status === "overdue" ? (
          <div className="space-y-3">
            {latestRejected?.review_reason && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">สลิปก่อนหน้าถูกปฏิเสธ: {latestRejected.review_reason}</p>}
            <PromptPayQr amount={Number(invoice.total)} />
            <SlipUpload invoiceId={invoice.id} />
          </div>
        ) : <p className="text-sm text-gray-500">ยังส่งสลิปไม่ได้ในสถานะบิลปัจจุบัน</p>}
      </Card>
    </div>
  );
}
