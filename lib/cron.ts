import { timingSafeEqual } from "node:crypto";
import { getEnv } from "./env";

// ไม่มี secret ถือว่ายังไม่ตั้งค่า ให้ route ตอบ 503
export function isCronRequest(request: Request): boolean {
  const secret = getEnv("CRON_SECRET");
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

