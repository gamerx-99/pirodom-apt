"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayTH } from "@/lib/format";
import {
  audit,
  generateInviteCode,
  hashInviteToken,
  inviteExpiry,
  requireStaff,
  toNumberOrNull,
} from "@/lib/phase1";
import { createLeaseFolders } from "@/lib/google-drive";
import { getSettings } from "@/lib/settings";

type Result = { ok: boolean; error?: string; inviteCode?: string; warning?: string };

const fail = (error: string): Result => ({ ok: false, error });

// สร้างสัญญา: เก็บค่าตามที่กรอกจริง ไม่ hardcode ชื่อห้อง/รอบบิล (รอ Q-02..Q-05)
export async function createLease(_prev: Result | null, form: FormData): Promise<Result> {
  try {
    const supabase = await createClient();
    const { userId } = await requireStaff(supabase);
    const room_id = String(form.get("room_id") ?? "");
    const start_date = String(form.get("start_date") ?? "");
    const end_date = String(form.get("end_date") ?? "") || null;
    const rent = toNumberOrNull(form.get("rent_amount"));
    const water = toNumberOrNull(form.get("water_fee")) ?? 0;
    const electric = toNumberOrNull(form.get("electric_rate")) ?? 0;
    const deposit = toNumberOrNull(form.get("deposit")) ?? 0;
    const due_day = toNumberOrNull(form.get("due_day"));

    if (!room_id) return fail("กรุณาเลือกห้อง");
    if (!start_date) return fail("กรุณากรอกวันเริ่มสัญญา");
    if (rent == null || rent < 0) return fail("ค่าเช่าต้องเป็นตัวเลข 0 ขึ้นไป");
    if (due_day == null || !Number.isInteger(due_day) || due_day < 1 || due_day > 31) {
      return fail("วันครบกำหนดต้องเป็น 1–31 (31 = วันสุดท้ายของเดือน)");
    }
    if (end_date && end_date < start_date) return fail("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("leases")
      .insert({
        room_id,
        start_date,
        end_date,
        rent_amount: rent,
        water_fee: water,
        electric_rate: electric,
        deposit,
        due_day,
        status: "active",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return fail("ห้องนี้มีสัญญา active อยู่แล้ว: กรุณาปิดสัญญาเดิมก่อน");
      return fail(`สร้างสัญญาไม่สำเร็จ: ${error.message}`);
    }
    await admin.from("rooms").update({ status: "occupied" }).eq("id", room_id);
    await audit(admin, { actor_id: userId, action: "lease.create", table_name: "leases", record_id: data.id, after: { room_id, start_date, rent_amount: rent, due_day } });
    const warning = await createDriveFolders(admin, data.id, room_id, start_date);
    revalidatePath("/admin/leases");
    revalidatePath("/admin/rooms");
    return { ok: true, warning };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "สร้างสัญญาไม่สำเร็จ");
  }
}

// สร้างโฟลเดอร์ Drive ของสัญญา: สัญญาสร้างแล้วเสมอ ถ้า Drive ล้มเหลวคืนคำเตือนแทน error
async function createDriveFolders(admin: ReturnType<typeof createAdminClient>, leaseId: string, roomId: string, startDate: string): Promise<string | undefined> {
  const s = await getSettings();
  if (!s.GOOGLE_SERVICE_ACCOUNT_JSON || !s.GOOGLE_DRIVE_FOLDER_ID) return undefined;
  try {
    const { data: room } = await admin.from("rooms").select("room_no").eq("id", roomId).maybeSingle();
    const folders = await createLeaseFolders(s.GOOGLE_SERVICE_ACCOUNT_JSON, s.GOOGLE_DRIVE_FOLDER_ID, `ห้อง ${room?.room_no ?? "?"} · ${startDate}`);
    const { error } = await admin.from("leases").update({ drive_folders: folders }).eq("id", leaseId);
    if (error) return "สร้างโฟลเดอร์ใน Google Drive แล้ว แต่บันทึกรหัสโฟลเดอร์ไม่สำเร็จ";
    return undefined;
  } catch (e) {
    return `สร้างสัญญาแล้ว แต่สร้างโฟลเดอร์ Google Drive ไม่สำเร็จ: ${e instanceof Error ? e.message : "ไม่ทราบสาเหตุ"}`;
  }
}

// ปิดสัญญา (ย้ายออก): จบสัญญา + เพิกถอนคำเชิญที่ยังไม่ใช้ + คืนห้องเป็นว่าง
 export async function endLease(form: FormData): Promise<void> {
   const supabase = await createClient();
   const { userId } = await requireStaff(supabase);
   const id = String(form.get("id") ?? "");
   if (!id) throw new Error("ไม่พบ id สัญญา");
   const admin = createAdminClient();
   const { data: lease } = await admin.from("leases").select("id,room_id,status,start_date").eq("id", id).maybeSingle();
   if (!lease) throw new Error("ไม่พบสัญญานี้");
   if (lease.status !== "active") throw new Error("สัญญานี้ปิดไปแล้ว");
   // วันที่ตามเวลาไทย ไม่ใช่ UTC (toISOString คืนวันก่อนหน้า 1 วันช่วง 00:00–07:00)
   const today = todayTH();
   if (today < lease.start_date) {
     throw new Error("สัญญานี้ยังไม่เริ่ม: กรุณาตั้งวันเริ่มสัญญาให้ถูกต้องก่อนปิดสัญญา");
   }
   const { error } = await admin.from("leases").update({ status: "ended", end_date: today }).eq("id", id).eq("status", "active");
   if (error) throw new Error(`ปิดสัญญาไม่สำเร็จ: ${error.message}`);
   // เพิกถอนคำเชิญค้าง (ใช้ครั้งเดียวอยู่แล้ว + กันลิงก์เก่าถูกกดหลังย้ายออก)
   await admin.from("room_invitations").update({ revoked_at: new Date().toISOString() }).eq("lease_id", id).is("used_at", null);
   await admin.from("rooms").update({ status: "vacant" }).eq("id", lease.room_id);
   await audit(admin, { actor_id: userId, action: "lease.end", table_name: "leases", record_id: id, after: { end_date: today } });
   revalidatePath("/admin/leases");
   revalidatePath("/admin/rooms");
 }

// ออกรหัสเชิญ: แสดงรหัสดิบครั้งเดียว เก็บเฉพาะ hash อายุ 7 วัน
 export async function createInvite(_prev: Result | null, form: FormData): Promise<Result> {
   try {
     const supabase = await createClient();
     const { userId } = await requireStaff(supabase);
     const lease_id = String(form.get("lease_id") ?? "");
     if (!lease_id) return fail("ไม่พบ id สัญญา");
     const admin = createAdminClient();
     const { data: lease } = await admin.from("leases").select("id,status").eq("id", lease_id).maybeSingle();
     if (!lease) return fail("ไม่พบสัญญานี้");
     if (lease.status !== "active") return fail("สัญญาไม่ active ออกคำเชิญไม่ได้");
 
    const code = generateInviteCode();
    const { data, error } = await admin
      .from("room_invitations")
      .insert({ lease_id, token_hash: hashInviteToken(code), expires_at: inviteExpiry() })
      .select("id")
      .single();
    if (error) return fail(`ออกคำเชิญไม่สำเร็จ: ${error.message}`);
    await audit(admin, { actor_id: userId, action: "invite.create", table_name: "room_invitations", record_id: data.id, after: { lease_id } });
    revalidatePath("/admin/leases");
    return { ok: true, inviteCode: code };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "ออกคำเชิญไม่สำเร็จ");
  }
}

 export async function revokeInvite(form: FormData): Promise<void> {
   const supabase = await createClient();
   const { userId } = await requireStaff(supabase);
   const id = String(form.get("id") ?? "");
   if (!id) throw new Error("ไม่พบ id คำเชิญ");
   const admin = createAdminClient();
   const { error } = await admin
     .from("room_invitations")
     .update({ revoked_at: new Date().toISOString() })
     .eq("id", id)
     .is("used_at", null);
   if (error) throw new Error(`เพิกถอนไม่สำเร็จ: ${error.message}`);
   await audit(admin, { actor_id: userId, action: "invite.revoke", table_name: "room_invitations", record_id: id });
   revalidatePath("/admin/leases");
 }
 
 // ถอนผู้เช่าออกจากสัญญา (ย้ายออกเฉพาะคน / สิทธิ์หมด)
 export async function removeTenant(form: FormData): Promise<void> {
   const supabase = await createClient();
   const { userId } = await requireStaff(supabase);
   const lease_id = String(form.get("lease_id") ?? "");
   const profile_id = String(form.get("profile_id") ?? "");
   if (!lease_id || !profile_id) throw new Error("ข้อมูลไม่ครบ");
   const admin = createAdminClient();
   const { data, error } = await admin.rpc("remove_lease_tenant", {
     p_lease_id: lease_id,
     p_profile_id: profile_id,
   });
   if (error) throw new Error(`ถอนสิทธิ์ไม่สำเร็จ: ${error.message}`);
   const code = String(data ?? "ok");
   if (code === "not_found") throw new Error("ไม่พบผู้เช่าคนนี้ในสัญญา");
   if (code === "is_primary") {
     throw new Error("ถอนผู้เช่าหลักไม่ได้: กรุณาตั้งผู้เช่าหลักคนใหม่ก่อน หรือปิดสัญญาหากเป็นผู้เช่าคนสุดท้าย");
   }
   await audit(admin, { actor_id: userId, action: "lease.unbind", table_name: "lease_tenants", after: { lease_id, profile_id } });
   revalidatePath("/admin/leases");
 }

 // เปลี่ยนผู้เช่าหลัก (ROADMAP Phase 1: จัดการผู้เช่าร่วมและผู้เช่าหลัก) — มีหลักได้คนเดียวต่อสัญญา
 export async function setPrimaryTenant(form: FormData): Promise<void> {
   const supabase = await createClient();
   const { userId } = await requireStaff(supabase);
   const lease_id = String(form.get("lease_id") ?? "");
   const profile_id = String(form.get("profile_id") ?? "");
   if (!lease_id || !profile_id) throw new Error("ข้อมูลไม่ครบ");
   const admin = createAdminClient();
   const { data, error } = await admin.rpc("set_primary_tenant", {
     p_lease_id: lease_id,
     p_profile_id: profile_id,
   });
   if (error) throw new Error(`เปลี่ยนผู้เช่าหลักไม่สำเร็จ: ${error.message}`);
   if (!data) throw new Error("เปลี่ยนผู้เช่าหลักไม่สำเร็จ: ผู้คนนี้ไม่ได้อยู่ในสัญญานี้");
   await audit(admin, { actor_id: userId, action: "lease.set_primary", table_name: "lease_tenants", after: { lease_id, profile_id } });
   revalidatePath("/admin/leases");
 }
