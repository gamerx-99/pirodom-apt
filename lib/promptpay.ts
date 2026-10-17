// PromptPay QR (มาตรฐาน EMVCo ของ ธปท.) — ฟังก์ชันล้วน ไม่มี secret
// เลขรับเงินมาจาก env PROMPTPAY_ID เท่านั้น (รอยืนยันบัญชีจริง Q-06)

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ตามที่ EMVCo กำหนด */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(input)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** แปลงเลข PromptPay เป็น sub-tag ของ AID: 01 = เบอร์มือถือ, 02 = เลขบัตร/ผู้เสียภาษี, 03 = e-Wallet */
function target(id: string): string | null {
  const digits = id.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return field("01", `0066${digits.slice(1)}`);
  if (digits.length === 13) return field("02", digits);
  if (digits.length === 15) return field("03", digits);
  return null;
}

/** คืน payload สำหรับสร้าง QR หรือ null ถ้าเลขรับเงิน/ยอดไม่ถูกต้อง */
export function promptPayPayload(promptPayId: string, amount: number): string | null {
  const account = target(promptPayId);
  if (!account || !Number.isFinite(amount) || amount <= 0) return null;
  const body =
    field("00", "01") +
    field("01", "12") + // 12 = QR ใช้ครั้งเดียวพร้อมยอด
    field("29", field("00", "A000000677010111") + account) +
    field("53", "764") +
    field("54", amount.toFixed(2)) +
    field("58", "TH") +
    "6304";
  return body + crc16(body);
}
