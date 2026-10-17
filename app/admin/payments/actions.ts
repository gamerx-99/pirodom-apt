"use server";

import { revalidatePath } from "next/cache";
import { audit, requireStaff, toNumberOrNull } from "@/lib/phase1";
import { todayTH } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PaymentActionResult = { ok: boolean; message: string };
const fail = (message: string): PaymentActionResult => ({ ok: false, message });

export async function approvePayment(_previous: PaymentActionResult | null, form: FormData): Promise<PaymentActionResult> {
  try {
    const client = await createClient();
    await requireStaff(client);
    const paymentId = String(form.get("payment_id") ?? "").trim();
    const amount = toNumberOrNull(form.get("amount"));
    if (!paymentId || amount === null || amount <= 0) return fail("กรอกรหัสรายการและยอดที่รับจริงให้ถูกต้อง");
    const { error } = await client.rpc("approve_invoice_payment", { p_payment_id: paymentId, p_amount: amount });
    if (error) return fail(error.message.includes("full invoice amount") ? "ยอดต้องตรงกับยอดเต็มของบิล" : "อนุมัติไม่สำเร็จ กรุณาตรวจสถานะบิลและรายการชำระ");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/billing");
    revalidatePath("/liff");
    return { ok: true, message: "อนุมัติและปิดบิลแล้ว" };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "อนุมัติไม่สำเร็จ");
  }
}

export async function rejectPayment(_previous: PaymentActionResult | null, form: FormData): Promise<PaymentActionResult> {
  try {
    const client = await createClient();
    const { userId } = await requireStaff(client);
    const id = String(form.get("payment_id") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
    if (!id || !reason) return fail("กรุณาระบุเหตุผลที่ปฏิเสธ");
    const admin = createAdminClient();
    const { data: payment, error: readError } = await admin.from("payments").select("id,invoice_id,status").eq("id", id).maybeSingle();
    if (readError || !payment) return fail("ไม่พบรายการชำระนี้");
    if (!["uploaded", "slipok_passed", "slipok_failed", "mismatch", "pending_review"].includes(payment.status)) return fail("รายการนี้ถูกตรวจแล้วหรือเปลี่ยนสถานะไปแล้ว");
    const { data: updated, error } = await admin.from("payments")
      .update({ status: "rejected", reviewed_by: userId, review_reason: reason })
      .eq("id", id).eq("status", payment.status).select("id").maybeSingle();
    if (error || !updated) return fail("ปฏิเสธไม่สำเร็จ: รายการอาจถูกเปลี่ยนจากอีกหน้าต่างแล้ว");
    const { data: invoice } = await admin.from("invoices").select("id,status,due_date").eq("id", payment.invoice_id).maybeSingle();
    if (invoice && ["pending_review", "verifying"].includes(invoice.status)) {
      const nextStatus = invoice.due_date < todayTH() ? "overdue" : "issued";
      await admin.from("invoices").update({ status: nextStatus }).eq("id", invoice.id).eq("status", invoice.status);
    }
    await audit(admin, { actor_id: userId, action: "payment.reject", table_name: "payments", record_id: id, before: { status: payment.status }, after: { status: "rejected", reason } });
    revalidatePath("/admin/payments");
    revalidatePath("/admin/billing");
    revalidatePath("/liff");
    return { ok: true, message: "ปฏิเสธสลิปแล้ว ผู้เช่าสามารถส่งรายการใหม่ได้" };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "ปฏิเสธรายการไม่สำเร็จ");
  }
}
