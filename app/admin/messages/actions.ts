"use server";

import { revalidatePath } from "next/cache";
import { getSetting } from "@/lib/settings";
import { pushLineText } from "@/lib/line-push";
import { MESSAGE_MAX_LENGTH, fillMessage } from "@/lib/messages";
import { requireStaff } from "@/lib/phase1";
import { loadRecipients } from "@/lib/recipients";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SendResult = { ok: boolean; message: string };
const fail = (message: string): SendResult => ({ ok: false, message });

/** ส่งข้อความหาผู้เช่าตามกลุ่มที่เลือก ผู้รับและยอดคำนวณใหม่ฝั่ง server ไม่เชื่อค่าจากฟอร์ม */
export async function sendMessages(_previous: SendResult | null, form: FormData): Promise<SendResult> {
  try {
    const { userId } = await requireStaff(await createClient());
    const text = String(form.get("message") ?? "").trim();
    const mode = String(form.get("mode") ?? "");
    if (!["all", "unpaid", "rooms"].includes(mode)) return fail("กรุณาเลือกกลุ่มผู้รับ");
    const picked = new Set(form.getAll("lease_id").map(String));
    if (!text) return fail("กรุณาพิมพ์ข้อความ");
    if (text.length > MESSAGE_MAX_LENGTH) return fail(`ข้อความยาวเกิน ${MESSAGE_MAX_LENGTH} ตัวอักษร`);

    const admin = createAdminClient();
    const all = await loadRecipients(admin);
    const targets = all.filter((r) => mode === "all" || (mode === "unpaid" && r.unpaid > 0) || (mode === "rooms" && picked.has(r.leaseId)));
    if (targets.length === 0) return fail(mode === "rooms" ? "กรุณาเลือกห้องอย่างน้อย 1 ห้อง" : "ไม่มีผู้รับตามเงื่อนไขที่เลือก");

    const token = await getSetting("LINE_CHANNEL_ACCESS_TOKEN");
    const count = { sent: 0, failed: 0, skipped: 0 };
    let unrecorded = 0;
    const deliveries = targets.flatMap((room) => {
      const body = fillMessage(text, { room: room.roomNo, unpaid: room.unpaid, nextDue: room.nextDue });
      return room.tenants.map((tenant) => ({ tenant, body }));
    });
    if (deliveries.some(({ body }) => body.length > 5000)) return fail("ข้อความหลังเติมตัวแปรยาวเกินกำหนด กรุณาลดข้อความ");
    // จำกัดคำขอพร้อมกัน เพื่อลดเวลาส่งหลายห้องโดยไม่ยิงทุกคนในคราวเดียว
    for (let offset = 0; offset < deliveries.length; offset += 5) {
      await Promise.all(deliveries.slice(offset, offset + 5).map(async ({ tenant, body }) => {
        const { data: row, error } = await admin
          .from("notifications")
          .insert({ profile_id: tenant.profileId, type: "announcement", channel: "line", status: "pending", sent_at: null, message: body, created_by: userId })
          .select("id")
          .single();
        if (error || !row) { count.failed++; return; }
        const sent = await pushLineText(token, tenant.lineUserId, body);
        count[sent.status]++;
        const { error: updateError } = await admin.from("notifications")
          .update({ status: sent.status, last_error: sent.error ?? null, sent_at: sent.status === "sent" ? new Date().toISOString() : null })
          .eq("id", row.id);
        if (updateError) unrecorded++;
      }));
    }
    revalidatePath("/admin/messages");
    const summary = `ส่งแล้ว ${count.sent} · ไม่สำเร็จ ${count.failed} · ข้าม ${count.skipped}`;
    if (unrecorded) return fail(`${summary} · บันทึกผลไม่สำเร็จ ${unrecorded} รายการ กรุณาตรวจสถานะค้างก่อนส่งใหม่`);
    return { ok: count.failed === 0, message: token ? summary : `${summary} (ยังไม่ได้ตั้งค่า LINE OA จึงยังไม่ส่งจริง)` };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "ส่งข้อความไม่สำเร็จ");
  }
}

/** ส่งซ้ำรายการที่ล้ม/ถูกข้าม: จองแถวเป็น pending ก่อน กันกดพร้อมกันแล้วส่งซ้ำสองครั้ง */
export async function resendNotification(_previous: SendResult | null, form: FormData): Promise<SendResult> {
  try {
  await requireStaff(await createClient());
  const id = String(form.get("notification_id") ?? "").trim();
  if (!id) return fail("ไม่พบรายการข้อความ");
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("notifications")
    .update({ status: "pending", last_error: null })
    .eq("id", id)
    .eq("channel", "line")
    .in("status", ["failed", "skipped"])
    .select("id,message,profiles!notifications_profile_id_fkey(line_user_id)")
    .maybeSingle();
  if (error) return fail("โหลดรายการเพื่อส่งซ้ำไม่สำเร็จ");
  if (!row) return fail("รายการนี้ถูกส่งแล้วหรือกำลังดำเนินการ กรุณารีเฟรชประวัติ");
  const target = row as unknown as { id: string; message: string | null; profiles: { line_user_id: string | null } | null };
  const sent = target.message
    ? await pushLineText(await getSetting("LINE_CHANNEL_ACCESS_TOKEN"), target.profiles?.line_user_id, target.message)
    : { status: "failed" as const, error: "ไม่มีข้อความเดิมให้ส่งซ้ำ" };
  const { error: updateError } = await admin.from("notifications")
    .update({ status: sent.status, last_error: sent.error ?? null, sent_at: sent.status === "sent" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/admin/messages");
  if (updateError) return fail("บันทึกผลส่งไม่สำเร็จ กรุณาตรวจสอบผลก่อนส่งใหม่");
  return { ok: sent.status === "sent", message: sent.status === "sent" ? "ส่งข้อความแล้ว" : sent.status === "skipped" ? "ข้ามการส่ง กรุณาตรวจการตั้งค่า LINE และบัญชีผู้รับ" : "ส่งไม่สำเร็จ ตรวจรายละเอียดในประวัติ" };
  } catch {
    return fail("ส่งซ้ำไม่สำเร็จ กรุณาตรวจประวัติก่อนดำเนินการอีกครั้ง");
  }
}
