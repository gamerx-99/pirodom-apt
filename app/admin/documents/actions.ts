"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, requireStaff } from "@/lib/phase1";
import { storagePath, uploadPrivateFile } from "@/lib/storage";

const MAX_TYPE_LEN = 120;

/**
 * ชื่อไฟล์ใน storage ต้องไม่พา / หรือ .. ออกไป และต้องไม่ชนกัน
 * (uploadPrivateFile ใช้ upsert: false ไฟล์ชื่อเดิมจะอัปโหลดไม่ได้)
 * เก็บตัวอักษร/ตัวเลขไว้ทั้งภาษาไทยและอังกฤษ ที่เหลือแทนด้วย -
 */
function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const rawExt = dot > 0 ? name.slice(dot + 1) : "";
  const rawBase = dot > 0 ? name.slice(0, dot) : name;
  const ext = rawExt.replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 8);
  const base = rawBase
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = randomUUID().slice(0, 8);
  return `${base || "file"}-${suffix}${ext ? `.${ext}` : ""}`;
}

/**
 * อัปโหลดเอกสารสัญญาเข้า bucket documents แล้วผูกกับ lease_id
 * path ต้องเป็น documents/<lease_id>/<file> ตาม policy tenant_documents_select
 * (20261017000000_storage_rls.sql) ไม่งั้นผู้เช่าจะเห็นรายการแต่เปิดไฟล์ไม่ได้
 * ชนิดเอกสาร (type) เป็นข้อความอิสระ เพราะยังไม่ได้ยืนยันว่าจะแยกห้องพัก/ร้านค้าอย่างไร (Q-07)
 */
export async function uploadDocument(form: FormData): Promise<void> {
  const supabase = await createClient();
  const { userId } = await requireStaff(supabase);

  const lease_id = String(form.get("lease_id") ?? "");
  const type = String(form.get("type") ?? "").trim().slice(0, MAX_TYPE_LEN);
  const file = form.get("file");

  if (!lease_id) throw new Error("กรุณาเลือกสัญญาที่จะผูกเอกสาร");
  if (!type) throw new Error("กรุณาระบุชื่อ/ชนิดเอกสาร");
  if (!(file instanceof File) || file.size === 0) throw new Error("กรุณาเลือกไฟล์ (PDF หรือรูปภาพ)");

  const admin = createAdminClient();
  const { data: lease } = await admin
    .from("leases")
    .select("id,status,rooms(room_no)")
    .eq("id", lease_id)
    .maybeSingle();
  if (!lease) throw new Error("ไม่พบสัญญานี้");

  const path = storagePath("documents", lease_id, safeFileName(file.name));
  const stored = await uploadPrivateFile("documents", path, file);

  const { data, error } = await admin
    .from("documents")
    .insert({ lease_id, type, file_path: stored, uploaded_by: userId })
    .select("id")
    .single();

  if (error) {
    // เขียนแถวไม่ได้ = ไม่มีใครเห็นไฟล์นี้ ถอนไฟล์ทิ้งไม่ให้เป็นขยะใน storage
    await admin.storage.from("documents").remove([stored]).catch(() => {});
    throw new Error(`บันทึกเอกสารไม่สำเร็จ: ${error.message}`);
  }

  await audit(admin, {
    actor_id: userId,
    action: "document.upload",
    table_name: "documents",
    record_id: data.id,
    after: { lease_id, type, file_path: stored },
  });
  revalidatePath("/admin/documents");
}

/**
 * ลบเอกสาร — ต้องเป็นเอกสารของสัญญาที่ส่งมาเท่านั้น
 * กันฟอร์มถูกแก้ lease_id ให้ชี้สัญญาอื่นแล้วลบเอกสารข้ามสัญญา
 */
export async function deleteDocument(form: FormData): Promise<void> {
  const supabase = await createClient();
  const { userId } = await requireStaff(supabase);
  const id = String(form.get("id") ?? "");
  const lease_id = String(form.get("lease_id") ?? "");
  if (!id || !lease_id) throw new Error("ข้อมูลไม่ครบ");

  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("documents")
    .select("id,lease_id,type,file_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc) throw new Error("ไม่พบเอกสารนี้");
  if (doc.lease_id !== lease_id) {
    throw new Error("เอกสารนี้ไม่ได้อยู่ในสัญญาที่เลือก — ยกเลิกการลบ");
  }

  // ลบแถวก่อน เพื่อไม่ให้มีโอกาสออก Signed URL ของไฟล์ที่กำลังเอาออก
  const { error } = await admin.from("documents").delete().eq("id", id);
  if (error) throw new Error(`ลบเอกสารไม่สำเร็จ: ${error.message}`);

  // ลบไฟล์ไม่สำเร็จไม่ทำให้งานหลักล้ม เพราะแถวใน DB ถูกลบถูกต้องแล้ว
  // (ไฟล์ที่ค้างอยู่ไม่มีแถวอ้างอิง จึงไม่มีใครขอ Signed URL ได้) — ผลลัพธ์บันทึกไว้ใน audit
  const { error: removeError } = await admin.storage.from("documents").remove([doc.file_path]);
  await audit(admin, {
    actor_id: userId,
    action: "document.delete",
    table_name: "documents",
    record_id: id,
    before: { lease_id: doc.lease_id, type: doc.type, file_path: doc.file_path },
    after: { storage_removed: !removeError },
  });

  revalidatePath("/admin/documents");
}
