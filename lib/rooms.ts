export const ROOM_STATUSES = ["vacant", "reserved", "occupied", "moving_out", "maintenance"] as const;
export const UNIT_TYPES = ["residential", "commercial"] as const;

export type RoomInput = {
  room_no: string;
  unit_type: (typeof UNIT_TYPES)[number];
  floor: number | null;
  status: (typeof ROOM_STATUSES)[number];
};

export type RoomResult = { ok: true } | { ok: false; error: string };

export function parseRoomInput(form: FormData):
  { ok: true; value: RoomInput } | { ok: false; error: string } {
  const room = form.get("room_no");
  const unit = form.get("unit_type") ?? "residential";
  const status = form.get("status") ?? "vacant";
  const floorEntry = form.get("floor") ?? "";
  if (typeof room !== "string" || !room.trim()) return { ok: false, error: "กรุณากรอกเลขห้อง/ยูนิต" };
  if (room.trim().length > 40) return { ok: false, error: "เลขห้องต้องไม่เกิน 40 ตัวอักษร" };
  if (!UNIT_TYPES.includes(unit as RoomInput["unit_type"])) return { ok: false, error: "ประเภทยูนิตไม่ถูกต้อง" };
  if (!ROOM_STATUSES.includes(status as RoomInput["status"])) return { ok: false, error: "สถานะห้องไม่ถูกต้อง" };
  if (typeof floorEntry !== "string") return { ok: false, error: "ชั้นต้องเป็นจำนวนเต็ม" };
  const floor = floorEntry.trim() === "" ? null : Number(floorEntry);
  if (floor !== null && (!Number.isInteger(floor) || floor < -2147483648 || floor > 2147483647)) {
    return { ok: false, error: "ชั้นต้องเป็นจำนวนเต็มที่รองรับ" };
  }
  return { ok: true, value: { room_no: room.trim(), unit_type: unit as RoomInput["unit_type"], status: status as RoomInput["status"], floor } };
}
