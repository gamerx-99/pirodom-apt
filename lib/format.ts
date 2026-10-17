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
