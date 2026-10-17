// ลำดับสถานะงานซ่อม เป็นกติกาที่ทั้ง server และ UI ใช้ร่วมกัน
// ต้องอยู่นอกไฟล์ "use server" เพราะทุก export ในไฟล์นั้นถือเป็น action ที่เรียกจาก client ได้
/** ลำดับสถานะงานซ่อม: ผู้เช่าแจ้ง → รับเรื่อง → กำลังทำ → รอ/กลับมาทำ → เสร็จ → ผู้เช่ายืนยันปิด */
export const NEXT_STATUS: Record<string, string[]> = {
  pending: ["accepted"],
  accepted: ["in_progress", "waiting"],
  in_progress: ["waiting", "done"],
  waiting: ["in_progress", "done"],
  done: [],
  closed: [],
};

export function statusOptions(current: string): string[] {
  return NEXT_STATUS[current] ?? [];
}