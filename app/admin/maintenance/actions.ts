"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, requireStaff } from "@/lib/phase1";
import { signedUrl, storagePath, uploadPrivateFile } from "@/lib/storage";
import { NEXT_STATUS } from "./status";

const MAX_PHOTOS = 8;

function safeFileName(name: string): string {
  const ext = /\.(jpg|jpeg|png|webp)$/i.exec(name)?.[0].toLowerCase() ?? ".jpg";
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${Date.now()}-${base || "photo"}${ext === ".jpeg" ? ".jpg" : ext}`;
}

/**
 * รับเรื่อง / เปลี่ยนสถานะ / แนบรูปผล (ฝั่งแอดมิน)
 * ทุกครั้งที่สถานะเปลี่ยน เขียน audit + timeline (maintenance_updates)
 */
export async function updateMaintenanceStatus(form: FormData): Promise<void> {
  const supabase = await createClient();
  const { userId } = await requireStaff(supabase);
  const id = String(form.get("id") ?? "");
  const next = String(form.get("status") ?? "").trim();
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  if (!id) throw new Error("ไม่พบ id งานซ่อม");

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("maintenance_requests")
    .select("id,room_id,category,status")
    .eq("id", id)
    .maybeSingle();
  const request = before as unknown as {
    id: string;
    room_id: string;
    category: string;
    status: string;
  } | null;
  if (!request) throw new Error("ไม่พบงานนี้");

  const changed = !!next && next !== request.status;
  if (changed && !(NEXT_STATUS[request.status] ?? []).includes(next)) {
    throw new Error(
      `เปลี่ยนจาก "${request.status}" ไป "${next}" ไม่ได้ (ลำดับการทำงาน: รอรับเรื่อง → รับเรื่องแล้ว → กำลังดำเนินการ → รออะไหล่ → เสร็จ)`,
    );
  }

  const files = form
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS);
  if (!changed && !note && files.length === 0) {
    throw new Error("ไม่มีข้อมูลให้บันทึก: กรุณาเลือกสถานะ พิมพ์หมายเหตุ หรือแนบรูปภาพ");
  }

  // อัปโหลดก่อนเขียนสถานะ: path ตาม policy เดิม maintenance/<room_id>/<request_id>/<file>
  const paths: string[] = [];
  for (const file of files) {
    const path = storagePath("maintenance", request.room_id, id, safeFileName(file.name));
    paths.push(await uploadPrivateFile("maintenance", path, file));
  }

  if (changed) {
    // เขียนแบบมีเงื่อนไขสถานะเดิม กันสองเจ้าหน้าที่กดพร้อมกันแล้วคนหลังทับคนแรก
    const { data: updated, error } = await admin
      .from("maintenance_requests")
      .update({ status: next })
      .eq("id", id)
      .eq("status", request.status)
      .select("id");
    if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
    if (!updated || updated.length === 0) {
      throw new Error("สถานะงานมีการเปลี่ยนแปลงโดยผู้ใช้อื่น: กรุณารีเฟรชหน้าจอแล้วลองใหม่อีกครั้ง");
    }
    await audit(admin, {
      actor_id: userId,
      action: "maintenance.status",
      table_name: "maintenance_requests",
      record_id: id,
      before: { status: request.status },
      after: { status: next },
    });
  }

  if (changed || note || paths.length > 0) {
    const { error: logError } = await admin.from("maintenance_updates").insert({
      request_id: id,
      status: changed ? next : request.status,
      note: note || null,
      created_by: userId,
    });
    if (logError) throw new Error(`บันทึกประวัติงานไม่สำเร็จ: ${logError.message}`);
  }

  if (paths.length > 0) {
    const { error: photoError } = await admin
      .from("maintenance_photos")
      .insert(paths.map((file_path) => ({ request_id: id, kind: "result", file_path, uploaded_by: userId })));
    if (photoError) throw new Error(`บันทึกรายการรูปผลไม่สำเร็จ: ${photoError.message}`);
    await audit(admin, {
      actor_id: userId,
      action: "maintenance.photos",
      table_name: "maintenance_photos",
      record_id: id,
      after: { count: paths.length },
    });
  }

  revalidatePath("/admin/maintenance");
  revalidatePath("/liff/maintenance");
}

/** เปิดรูปงานซ่อมของหน้าแอดมิน (path มาจาก DB เท่านั้น) */
export async function maintenancePhotoUrls(
  photoIds: string[],
): Promise<Record<string, string>> {
  const supabase = await createClient();
  await requireStaff(supabase);
  const out: Record<string, string> = {};
  if (photoIds.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin
    .from("maintenance_photos")
    .select("id,file_path")
    .in("id", photoIds);
  for (const row of (data ?? []) as unknown as { id: string; file_path: string }[]) {
    try {
      out[row.id] = await signedUrl("maintenance", row.file_path);
    } catch {
      // เปิดรูปไม่ได้ — ข้ามรายการนี้
    }
  }
  return out;
}