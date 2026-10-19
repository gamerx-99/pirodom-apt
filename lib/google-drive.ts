import { createSign } from "node:crypto";

type ServiceAccount = { client_email: string; private_key: string };

export type LeaseFolders = { folder: string; slips: string; documents: string };

export function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    return sa.client_email && sa.private_key ? { client_email: sa.client_email, private_key: sa.private_key } : null;
  } catch {
    return null;
  }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

// แลก JWT ที่เซ็นด้วย private key ของ service account เป็น access token (ไม่ต้องลง googleapis)
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 600,
  }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64url(signature)}` }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google ไม่ยอมรับ service account (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function createFolder(token: string, name: string, parent: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parent] }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`สร้างโฟลเดอร์ "${name}" ไม่สำเร็จ (${res.status}): ตรวจว่าแชร์โฟลเดอร์หลักให้ service account เป็นผู้แก้ไขแล้ว`);
  return ((await res.json()) as { id: string }).id;
}

/** โฟลเดอร์ของสัญญา 1 ฉบับ ภายในมี "สลิป" และ "เอกสาร" */
export async function createLeaseFolders(saJson: string, rootId: string, name: string): Promise<LeaseFolders> {
  const sa = parseServiceAccount(saJson);
  if (!sa) throw new Error("Service Account JSON ไม่ถูกต้อง");
  const token = await accessToken(sa);
  const folder = await createFolder(token, name, rootId);
  const [slips, documents] = await Promise.all([
    createFolder(token, "สลิป", folder),
    createFolder(token, "เอกสาร", folder),
  ]);
  return { folder, slips, documents };
}
