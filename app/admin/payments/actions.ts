"use server";

import { revalidatePath } from "next/cache";
import { requireStaff, toNumberOrNull } from "@/lib/phase1";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    if (error) {
      if (error.message.includes("full invoice amount")) return fail("ยอดต้องตรงกับยอดเต็มของบิล");
      if (error.message.includes("not eligible")) return fail("รายการนี้ยังอนุมัติไม่ได้ ถ้าบันทึกผลตรวจค้าง ให้กดนำผลตรวจเดิมกลับเข้าคิวก่อน โดยไม่ต้องส่งสลิปใหม่");
      return fail("อนุมัติไม่สำเร็จ กรุณาตรวจสถานะบิลและรายการชำระ");
    }
    revalidatePath("/admin/payments");
    revalidatePath("/admin/billing");
    revalidatePath("/liff");
    return { ok: true, message: "อนุมัติและปิดบิลแล้ว" };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "อนุมัติไม่สำเร็จ");
  }
}

export async function recoverPayment(_previous: PaymentActionResult | null, form: FormData): Promise<PaymentActionResult> {
  try {
    const client = await createClient();
    const { userId } = await requireStaff(client);
    const id = String(form.get("payment_id") ?? "").trim();
    if (!id) return fail("ไม่พบรหัสรายการสลิป");
    const { data, error } = await createAdminClient().rpc("finalize_invoice_payment_verification", {
      p_payment_id: id,
      p_actor_id: userId,
    });
    if (error || !data) return fail("นำผลตรวจกลับเข้าคิวยังไม่สำเร็จ กรุณาตรวจ log ของรายการเดิม ไม่ต้องให้ผู้เช่าส่งสลิปใหม่");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/billing");
    revalidatePath("/liff");
    return { ok: true, message: "นำผลตรวจเดิมกลับเข้าคิวแล้ว กรุณาตรวจสลิปก่อนอนุมัติ" };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "นำผลตรวจกลับเข้าคิวไม่สำเร็จ");
  }
}

export async function rejectPayment(_previous: PaymentActionResult | null, form: FormData): Promise<PaymentActionResult> {
  try {
    const client = await createClient();
    await requireStaff(client);
    const id = String(form.get("payment_id") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim().slice(0, 300);
    if (!id || !reason) return fail("กรุณาระบุเหตุผลที่ปฏิเสธ");
    const { error } = await client.rpc("reject_invoice_payment", { p_payment_id: id, p_reason: reason });
    if (error) return fail(error.message.includes("not open for review") ? "รายการนี้ถูกตรวจแล้วหรือเปลี่ยนสถานะไปแล้ว" : "ปฏิเสธไม่สำเร็จ กรุณาลองใหม่");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/billing");
    revalidatePath("/liff");
    return { ok: true, message: "ปฏิเสธสลิปแล้ว ผู้เช่าสามารถส่งรายการใหม่ได้" };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "ปฏิเสธรายการไม่สำเร็จ");
  }
}
