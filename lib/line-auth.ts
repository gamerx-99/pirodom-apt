import "server-only";
import { getEnv } from "./env";

export interface LineIdTokenClaims {
  iss: string;
  sub: string; // LINE user ID (เช่น U1234...)
  aud: string; // Channel ID
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
}

// ตรวจ LIFF ID token ผ่าน LINE verify endpoint ตรง
export async function verifyLineIdToken(idToken: string): Promise<LineIdTokenClaims> {
  const channelId = getEnv("LINE_LOGIN_CHANNEL_ID");
  if (!channelId) {
    throw new Error(
      "ยังไม่มี LINE_LOGIN_CHANNEL_ID: ใส่ Channel ID ของ LINE Login แล้วลองใหม่",
    );
  }
  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("ID token ไม่ผ่านการตรวจกับ LINE");
  }
  const claims = (await res.json()) as LineIdTokenClaims;
  if (!claims.sub || claims.aud !== channelId) {
    throw new Error("ID token ไม่ตรงกับ Channel นี้");
  }
  return claims;
}
