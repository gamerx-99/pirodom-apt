"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, requireStaff } from "@/lib/phase1";
import { parseRoomInput, type RoomResult } from "@/lib/rooms";

const ROOM_STATUS = ["vacant", "reserved", "occupied", "moving_out", "maintenance"] as const;

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export async function createRoom(
  _prev: { ok: boolean; error?: string } | null,
  form: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { userId } = await requireStaff(supabase);
    const parsed = parseRoomInput(form);
    if (!parsed.ok) return parsed;
    const { room_no, unit_type, floor, status } = parsed.value;

    const admin = createAdminClient();
    const { error } = await admin.from("rooms").insert({ room_no, unit_type, floor, status });
    if (error) {
      if (error.code === "23505") return fail(`เลขห้อง "${room_no}" มีอยู่แล้ว`);
      return fail(`สร้างห้องไม่สำเร็จ: ${error.message}`);
    }
    await audit(admin, { actor_id: userId, action: "room.create", table_name: "rooms", after: { room_no, unit_type } });
    revalidatePath("/admin/rooms");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "สร้างห้องไม่สำเร็จ");
  }
}

export async function updateRoom(_prev: RoomResult | null, form: FormData): Promise<RoomResult> {
  try {
    const { userId } = await requireStaff(await createClient());
    const id = String(form.get("id") ?? "");
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return fail("ไม่พบรหัสห้องที่ถูกต้อง");
    const parsed = parseRoomInput(form);
    if (!parsed.ok) return parsed;
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin.from("rooms")
      .select("id,room_no,unit_type,floor,status").eq("id", id).maybeSingle();
    if (readError) return fail("อ่านข้อมูลห้องไม่สำเร็จ กรุณาลองใหม่");
    if (!before) return fail("ไม่พบห้องนี้ อาจถูกลบไปแล้ว");
    const { data, error } = await admin.from("rooms").update(parsed.value).eq("id", id).select("id").maybeSingle();
    if (error?.code === "23505") return fail(`เลขห้อง "${parsed.value.room_no}" มีอยู่แล้ว`);
    if (error) return fail("แก้ไขห้องไม่สำเร็จ กรุณาลองใหม่");
    if (!data) return fail("ไม่พบห้องนี้ อาจถูกลบไปแล้ว");
    await audit(admin, { actor_id: userId, action: "room.update", table_name: "rooms", record_id: id, before, after: parsed.value });
    revalidatePath("/admin/rooms");
    revalidatePath("/admin/leases");
    revalidatePath("/liff");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "แก้ไขห้องไม่สำเร็จ");
  }
}

export async function deleteRoom(_prev: RoomResult | null, form: FormData): Promise<RoomResult> {
  try {
    const { userId } = await requireStaff(await createClient());
    const id = String(form.get("id") ?? "");
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return fail("ไม่พบรหัสห้องที่ถูกต้อง");
    const admin = createAdminClient();
    const { data: before, error: readError } = await admin.from("rooms")
      .select("id,room_no,unit_type,floor,status").eq("id", id).maybeSingle();
    if (readError) return fail("อ่านข้อมูลห้องไม่สำเร็จ กรุณาลองใหม่");
    if (!before) return fail("ไม่พบห้องนี้ อาจถูกลบไปแล้ว");
    if (form.get("confirm_room_no") !== before.room_no) return fail("พิมพ์เลขห้องให้ตรงเพื่อยืนยันการลบ");
    // Foreign keys protect every reference, including a concurrent lease creation.
    const { data, error } = await admin.from("rooms").delete().eq("id", id).eq("room_no", before.room_no).select("id").maybeSingle();
    if (error?.code === "23503") return fail("ลบห้องนี้ไม่ได้ เพราะมีสัญญา ประวัติมิเตอร์ หรืองานซ่อมอ้างอิงอยู่");
    if (error) return fail("ลบห้องไม่สำเร็จ กรุณาลองใหม่");
    if (!data) return fail("ไม่พบห้องนี้ อาจถูกลบไปแล้ว");
    await audit(admin, { actor_id: userId, action: "room.delete", table_name: "rooms", record_id: id, before });
    revalidatePath("/admin/rooms");
    revalidatePath("/admin/leases");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "ลบห้องไม่สำเร็จ");
  }
}

/** ฟอร์มเปลี่ยนสถานะแบบ plain form action — 失败 throw ให้ Next แสดง error */
export async function updateRoomStatus(form: FormData): Promise<void> {
  const supabase = await createClient();
  const { userId } = await requireStaff(supabase);
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id) throw new Error("ไม่พบ id ห้อง");
   if (!ROOM_STATUS.includes(status as (typeof ROOM_STATUS)[number])) throw new Error("สถานะไม่ถูกต้อง");
   const admin = createAdminClient();
   const { data: before } = await admin.from("rooms").select("room_no,status").eq("id", id).maybeSingle();
  const { error } = await admin.from("rooms").update({ status }).eq("id", id);
  if (error) throw new Error(`เปลี่ยนสถานะไม่สำเร็จ: ${error.message}`);
  await audit(admin, { actor_id: userId, action: "room.status", table_name: "rooms", record_id: id, before, after: { status } });
  revalidatePath("/admin/rooms");
}
