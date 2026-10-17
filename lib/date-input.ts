// ช่องกรอกวันที่แบบ DD/MM/YYYY — input type="date" แสดงตามภาษาเบราว์เซอร์ (en-US = MM/DD/YYYY) คุมไม่ได้
// ส่งเข้าฟอร์มเป็น YYYY-MM-DD เหมือนเดิม ฝั่ง server ไม่ต้องแก้

/** "18/10/2026" หรือ พ.ศ. "18/10/2569" → "2026-10-18"; วันที่ไม่มีจริง → null */
export function parseDMY(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year > 2400) year -= 543;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

/** "2026-10-18" → "18/10/2026" */
export function formatDMY(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** ใส่ / ให้อัตโนมัติขณะพิมพ์ตัวเลข: "18102026" → "18/10/2026" */
export function maskDMY(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}
