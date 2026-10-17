import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

// ไม่มี secret ถือว่ายังไม่ตั้งค่า ให้ route ตอบ 503 แทน 401
export function verifyLineSignature(body: string, signature: string | null): boolean {
  const secret = getEnv("LINE_CHANNEL_SECRET");
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

