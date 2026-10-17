export function formatTHB(n: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDateTH(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** due_day 31 = วันสุดท้ายของเดือน ตามกติกา */
export function dueDayLabel(dueDay: number): string {
  if (dueDay === 31) return "วันสุดท้ายของเดือน";
  return `วันที่ ${dueDay}`;
}

/** วันที่ตามเวลาไทย (Asia/Bangkok) เป็น YYYY-MM-DD — toISOString() ให้วันก่อนหน้า 1 วันช่วง 00:00–07:00 */
export function todayTH(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
