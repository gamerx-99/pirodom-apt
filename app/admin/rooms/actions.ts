"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, cleanRoomNo, requireStaff } from "@/lib/phase1";

const ROOM_STATUS = ["vacant", "reserved", "occupied", "moving_out", "maintenance"] as const;
const UNIT_TYPES = ["residential", "commercial"] as const;

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
    const room_no = cleanRoomNo(form.get("room_no"));
    const unit_type = String(form.get("unit_type") ?? "residential");
    const floorRaw = String(form.get("floor") ?? "").trim();
    const status = String(form.get("status") ?? "vacant");
    if (!room_no) return fail("กรุณากรอกเลขห้อง/ยูนิต");
    if (!UNIT_TYPES.includes(unit_type as (typeof UNIT_TYPES)[number])) return fail("ประเภทยูนิตไม่ถูกต้อง");
    if (!ROOM_STATUS.includes(status as (typeof ROOM_STATUS)[number])) return fail("สถานะห้องไม่ถูกต้อง");
    const floor = floorRaw === "" ? null : Number(floorRaw);
    if (floor !== null && !Number.isInteger(floor)) return fail("ชั้นต้องเป็นจำนวนเต็ม");

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
