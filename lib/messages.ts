// แม่แบบข้อความที่แอดมินส่งหาผู้เช่าจาก /admin/messages (แทน cron แจ้งเตือนอัตโนมัติ)
// ตัวแปรในวงเล็บปีกกาเติมฝั่ง server ต่อห้อง จากข้อมูลจริงในฐานข้อมูล

export const MESSAGE_MAX_LENGTH = 1000;

export const MESSAGE_TEMPLATES = [
  { key: "custom", label: "พิมพ์เอง", text: "" },
  { key: "due", label: "เตือนชำระค่าเช่า", text: "แจ้งเตือนห้อง {ห้อง}: ยอดค้างชำระ {ยอดค้าง} บาท ครบกำหนด {ครบกำหนด}\nชำระแล้วกรุณาส่งสลิปในเมนูบิลของ LINE" },
  { key: "meter", label: "แจ้งจดมิเตอร์", text: "แจ้งห้อง {ห้อง}: เจ้าหน้าที่จะจดมิเตอร์น้ำ/ไฟประจำเดือน ขออภัยในความไม่สะดวก" },
  { key: "notice", label: "ประกาศทั่วไป", text: "ประกาศจากหอพัก: " },
] as const;

export type MessageVars = { room: string; unpaid: number; nextDue: string | null };

export function fillMessage(text: string, vars: MessageVars): string {
  return text
    .replaceAll("{ห้อง}", vars.room)
    .replaceAll("{ยอดค้าง}", vars.unpaid.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    .replaceAll("{ครบกำหนด}", vars.nextDue ?? "-");
}
