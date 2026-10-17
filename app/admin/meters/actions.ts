"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, requireStaff, toNumberOrNull } from "@/lib/phase1";
import { signedUrl, storagePath, uploadPrivateFile } from "@/lib/storage";

export type MeterRowResult = {
  room_no: string;
  units: number | null;
  error?: string;
  warn?: string;
};

export type RecordMetersResult = {
  ok: boolean;
  error?: string;
  period?: string;
  saved: MeterRowResult[];
  rejected: MeterRowResult[];
  /** เลือกห้องไว้แต่ไม่ได้กรอกเลข — ข้ามไปโดยไม่ถือเป็นข้อผิดพลาด */
  skipped: string[];
};

/** ชื่อฟิลด์ต่อห้อง: prev:<room_id> / curr:<room_id> / photo:<room_id> */
const PREV = "prev:";
const CURR = "curr:";
const PHOTO = "photo:";

/** ใช้โหมดผิดปกติ: มากกว่า 2.5 เท่าของค่าเฉลี่ยงวดก่อนที่มีข้อมูล (เป็นธงแจ้งตรวจ ไม่ใช่กติกาคิดเงิน) */
const ABNORMAL_FACTOR = 2.5;
const ABNORMAL_MIN_SAMPLES = 2;

type History = {
  room_id: string;
  period: string;
  prev_value: number;
  curr_value: number;
  units: number | null;
  photo_path: string | null;
};

type Draft = {
  room_id: string;
  prev: number | null;
  curr: number | null;
  photo: FormDataEntryValue | null;
  room_no: string;
};

function fail(error: string): RecordMetersResult {
  return { ok: false, error, saved: [], rejected: [], skipped: [] };
}

/** เก็บชื่อไฟล์แบบสุ่มตามนามสกุลเดิม กันชื่อซ้ำและกัน path แหวก */
function safeFileName(name: string): string {
  const ext = /\.[a-z0-9]{1,8}$/i.exec(name)?.[0].toLowerCase() ?? ".jpg";
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${Date.now()}-${base || "photo"}${ext}`;
}

function collectRows(form: FormData, roomNos: Map<string, string>): Draft[] {
  const rows: Draft[] = [];
  const seen = new Set<string>();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith(CURR)) continue;
    const room_id = key.slice(CURR.length);
    if (!room_id || seen.has(room_id)) continue;
    seen.add(room_id);
    rows.push({
      room_id,
      room_no: roomNos.get(room_id) ?? room_id.slice(0, 8),
      prev: toNumberOrNull(form.get(PREV + room_id) as FormDataEntryValue | null),
      curr: toNumberOrNull(value),
      photo: form.get(PHOTO + room_id),
    });
  }
  return rows;
}

/** ตรวจตัวเลข + เทียบกับงวดก่อนหน้าของห้อง (chain) และธงการใช้ผิดปกติ */
function checkRow(
  row: Draft,
  history: History[],
  alreadyInPeriod: boolean,
): { skip?: boolean; error?: string; warn?: string; units: number | null } {
  // เลือกห้องไว้แต่ยังไม่ได้กรอกเลข — ข้าม ไม่ถือเป็นข้อผิดพลาด
  if (row.prev === null && row.curr === null) return { skip: true, units: null };
  if (row.prev === null || row.curr === null) {
    return { units: null, error: "กรอกเลขก่อนหน้าและเลขปัจจุบันให้ครบ" };
  }
  if (row.prev < 0 || row.curr < 0) {
    return { units: null, error: "เลขมิเตอร์ต้องไม่ติดลบ" };
  }
  if (row.curr < row.prev) {
    return {
      units: null,
      error: `เลขปัจจุบัน ${row.curr} ต่ำกว่าเลขก่อนหน้า ${row.prev}: กรุณาตรวจสอบรูปมิเตอร์อีกครั้งก่อนบันทึก`,
    };
  }
  if (alreadyInPeriod) {
    return { units: null, error: "จดห้องนี้ในงวดนี้ไปแล้ว: กรุณาแก้ไขจากงวดเดิม" };
  }

  const units = Math.round((row.curr - row.prev) * 100) / 100;
  const last = history[0];
  const warns: string[] = [];
  if (last && Number(last.curr_value) !== row.prev) {
    warns.push(`เลขก่อนหน้าไม่ตรงกับเลขที่จบงวด ${last.period} (${Number(last.curr_value)})`);
  }
  if (units === 0) {
    warns.push("ใช้ไฟ 0 หน่วย (กรุณาตรวจสอบว่ามิเตอร์ทำงานปกติและอ่านถูกต้อง)");
  }
  const recent = history
    .slice(0, ABNORMAL_MIN_SAMPLES + 1)
    .map((h) => Number(h.units ?? 0));
  if (recent.length >= ABNORMAL_MIN_SAMPLES && units > 0) {
    const avg = recent.reduce((s, n) => s + n, 0) / recent.length;
    if (avg > 0 && units > avg * ABNORMAL_FACTOR) {
      warns.push(
        `ใช้ไฟ ${units} หน่วย มากผิดปกติเทียบค่าเฉลี่ยงวดก่อน (${avg.toFixed(1)})`,
      );
    }
  }
  return { units, warn: warns.length > 0 ? warns.join(" · ") : undefined };
}

/**
 * จดมิเตอร์หลายห้องในงวดเดียวกัน (หน้าเดียว)
 * กติกา: ตรวจตัวเลขทุกแถวก่อนเขียน — ถ้ามีแถวที่ผิดจะไม่บันทึกใด ๆ ทั้งงวด
 */
export async function recordMeters(
  _prev: RecordMetersResult | null,
  form: FormData,
): Promise<RecordMetersResult> {
  try {
    const supabase = await createClient();
    const { userId } = await requireStaff(supabase);

    const period = String(form.get("period") ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      return fail("เลือกงวดที่จด (รูปแบบ ปปป-คค-คค)");
    }

    const admin = createAdminClient();
    const { data: roomsRaw } = await admin.from("rooms").select("id,room_no");
    const roomNos = new Map<string, string>(
      ((roomsRaw ?? []) as unknown as { id: string; room_no: string }[]).map((r) => [
        r.id,
        r.room_no,
      ]),
    );
    const rows = collectRows(form, roomNos);
    if (rows.length === 0) return fail("ยังไม่ได้เลือกห้องที่จะจด");

    const roomIds = rows.map((r) => r.room_id);
    const { data: inPeriodRaw } = await admin
      .from("meter_readings")
      .select("room_id")
      .in("room_id", roomIds)
      .eq("period", period);
    const already = new Set(
      ((inPeriodRaw ?? []) as unknown as { room_id: string }[]).map((r) => r.room_id),
    );

    const { data: historyRaw } = await admin
      .from("meter_readings")
      .select("room_id,period,prev_value,curr_value,units,photo_path")
      .in("room_id", roomIds)
      .lt("period", period)
      .order("period", { ascending: false });
    const historyByRoom = new Map<string, History[]>();
    for (const h of (historyRaw ?? []) as unknown as History[]) {
      const list = historyByRoom.get(h.room_id) ?? [];
      list.push(h);
      historyByRoom.set(h.room_id, list);
    }

    const checked = rows.map((row) => {
      const result = checkRow(row, historyByRoom.get(row.room_id) ?? [], already.has(row.room_id));
      return { row, ...result };
    });
    const skipped = checked.filter((c) => c.skip).map((c) => c.row.room_no);

    const rejected: MeterRowResult[] = [];
    for (const c of checked) {
      if (c.error) rejected.push({ room_no: c.row.room_no, units: null, error: c.error });
    }
    if (rejected.length > 0) {
      return {
        ok: false,
        error: `ยังไม่บันทึกข้อมูล: พบปัญหา ${rejected.length} ห้อง กรุณาตรวจสอบแล้วส่งใหม่อีกครั้ง`,
        period,
        saved: [],
        rejected,
        skipped,
      };
    }
    if (checked.every((c) => c.skip)) return fail("ยังไม่ได้กรอกเลขมิเตอร์ของห้องใดเลย");

    const saved: MeterRowResult[] = [];
    for (const c of checked) {
      if (c.skip) continue;
      const { row, warn } = c;
      let photoPath: string | null = null;
      if (row.photo instanceof File && row.photo.size > 0) {
        try {
          const path = storagePath(
            "meters",
            row.room_id,
            period,
            safeFileName(row.photo.name),
          );
          photoPath = await uploadPrivateFile("meters", path, row.photo);
        } catch (e) {
          rejected.push({
            room_no: row.room_no,
            units: null,
            error: e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ",
          });
          continue;
        }
      }

      const { data, error } = await admin
        .from("meter_readings")
        .insert({
          room_id: row.room_id,
          period,
          prev_value: row.prev,
          curr_value: row.curr,
          photo_path: photoPath,
          recorded_by: userId,
        })
        .select("id,units")
        .single();
      if (error) {
        rejected.push({
          room_no: row.room_no,
          units: null,
          error:
            error.code === "23505"
              ? "จดห้องนี้ในงวดนี้ไปแล้ว (บันทึกซ้ำจากคนอื่นหรือจากเครื่องเดิม)"
              : `บันทึกไม่สำเร็จ: ${error.message}`,
        });
        continue;
      }
      await audit(admin, {
        actor_id: userId,
        action: "meter.create",
        table_name: "meter_readings",
        record_id: data.id,
        after: {
          room_id: row.room_id,
          period,
          prev_value: row.prev,
          curr_value: row.curr,
          units: Number(data.units ?? 0),
          has_photo: !!photoPath,
        },
      });
      saved.push({ room_no: row.room_no, units: Number(data.units ?? 0), warn });
    }

    revalidatePath("/admin/meters");
    revalidatePath("/liff/meters");
    const ok = saved.length > 0;
    return {
      ok,
      error: ok ? undefined : "ไม่มีห้องไหนบันทึกสำเร็จ",
      period,
      saved,
      rejected,
      skipped,
    };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "บันทึกมิเตอร์ไม่สำเร็จ");
  }
}

/** เปิดรูปมิเตอร์ของงวดนี้ (หน้าแอดมินเรียกใช้ — path มาจาก DB เท่านั้น ไม่รับจาก client) */
export async function meterPhotoUrls(
  readingIds: string[],
): Promise<Record<string, string>> {
  const supabase = await createClient();
  await requireStaff(supabase);
  const out: Record<string, string> = {};
  if (readingIds.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin
    .from("meter_readings")
    .select("id,photo_path")
    .in("id", readingIds);
  for (const row of (data ?? []) as unknown as { id: string; photo_path: string | null }[]) {
    if (!row.photo_path) continue;
    try {
      out[row.id] = await signedUrl("meters", row.photo_path);
    } catch {
      // ไฟล์หายหรืออ่านไม่ได้ — แสดงรายการต่อได้แต่ไม่มีลิงก์เปิดรูป
    }
  }
  return out;
}