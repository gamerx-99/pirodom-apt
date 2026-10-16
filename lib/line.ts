import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// ตรวจ X-Line-Signature ของ webhook (HMAC-SHA256 ด้วย Channel Secret)
export function verifyLineSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", process.env.LINE_CHANNEL_SECRET!).update(body).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
