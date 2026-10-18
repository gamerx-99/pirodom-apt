import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSetting } from "./settings";
import { paymentResultText, pushLineText } from "./line-push";

type PaymentForNotify = {
  id: string;
  review_reason: string | null;
  invoices: {
    period: string;
    total: number;
    leases: {
      rooms: { room_no: string } | null;
      lease_tenants: { profile_id: string; profiles: { line_user_id: string | null } | null }[];
    } | null;
  } | null;
};

/**
 * แจ้งผลตรวจสลิปให้ผู้เช่าทุกคนในสัญญา เรียกหลังอนุมัติ/ปฏิเสธสำเร็จแล้วเท่านั้น
 * ไม่ throw และไม่ส่งซ้ำ (unique profile/payment/type) ผลการส่งเก็บใน notifications
 */
export async function notifyPaymentResult(
  admin: SupabaseClient,
  paymentId: string,
  result: "approved" | "rejected",
): Promise<void> {
  try {
    const { data, error } = await admin
      .from("payments")
      .select("id,review_reason,invoices(period,total,leases(rooms(room_no),lease_tenants(profile_id,profiles(line_user_id))))")
      .eq("id", paymentId)
      .maybeSingle();
    if (error || !data) return;
    const payment = data as unknown as PaymentForNotify;
    const invoice = payment.invoices;
    if (!invoice) return;
    const text = paymentResultText({
      result,
      roomNo: invoice.leases?.rooms?.room_no ?? null,
      period: invoice.period,
      total: Number(invoice.total),
      reason: payment.review_reason,
    });
    const token = await getSetting("LINE_CHANNEL_ACCESS_TOKEN");

    for (const tenant of invoice.leases?.lease_tenants ?? []) {
      const { data: row, error: insertError } = await admin
        .from("notifications")
        .insert({ profile_id: tenant.profile_id, type: `payment_${result}`, channel: "line", payment_id: paymentId, status: "pending", sent_at: null, message: text })
        .select("id")
        .single();
      if (insertError || !row) continue; // 23505 = แจ้งรายการนี้ไปแล้ว
      const sent = await pushLineText(token, tenant.profiles?.line_user_id, text);
      await admin
        .from("notifications")
        .update({ status: sent.status, last_error: sent.error ?? null, sent_at: sent.status === "sent" ? new Date().toISOString() : null })
        .eq("id", row.id);
    }
  } catch {
    // แถว failed/skipped ค้างไว้ให้แอดมินกดส่งซ้ำที่ /admin/messages
  }
}
