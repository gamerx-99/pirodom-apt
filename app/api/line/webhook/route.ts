import { isSupabaseAdminConfigured, getEnv, missingEnv, notConfiguredResponse } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { verifyLineSignature } from "@/lib/line";
import { acceptInviteCodeFromLine } from "@/lib/line-invites";
import { createAdminClient } from "@/lib/supabase/admin";

type LineMessageEvent = {
  type?: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

async function reply(replyToken: string, text: string) {
  const token = await getSetting("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) throw new Error("LINE channel access token is not configured");
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`LINE reply failed (${response.status})`);
}

async function lineDisplayName(userId: string): Promise<string> {
  const token = await getSetting("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) throw new Error("LINE channel access token is not configured");
  const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return "ผู้เช่าจาก LINE";
  const profile = (await response.json()) as { displayName?: string };
  return profile.displayName?.trim().slice(0, 120) || "ผู้เช่าจาก LINE";
}

function isUidCommand(text: string): boolean {
  return /^(?:\/?uid|ตรวจสอบ\s*uid|เช็ค\s*uid|ขอ\s*uid)$/i.test(text.trim());
}

async function handleEvent(admin: ReturnType<typeof createAdminClient>, event: LineMessageEvent) {
  if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) return;
  const text = event.message.text ?? "";
  if (isUidCommand(text)) {
    if (event.source?.type !== "user") {
      await reply(event.replyToken, "เพื่อความเป็นส่วนตัว กรุณาส่งคำสั่งตรวจสอบ UID ในแชทส่วนตัวกับ LINE OA");
      return;
    }
    if (!event.source.userId) {
      await reply(event.replyToken, "LINE ไม่ได้ส่ง UID มาให้ กรุณาลองใหม่ในแชทส่วนตัวกับ LINE OA");
      return;
    }
    await reply(event.replyToken, `LINE User ID ของคุณคือ:\n${event.source.userId}`);
    return;
  }
  if (event.source?.type !== "user") {
    await reply(event.replyToken, "กรุณาส่งรหัสยืนยันในแชทส่วนตัวกับ LINE Bot ของหอพัก");
    return;
  }
  if (!event.source.userId) {
    await reply(event.replyToken, "LINE ยังไม่ส่งข้อมูลยืนยันตัวตนให้ Bot กรุณาอนุญาตการเข้าถึงข้อมูลโปรไฟล์ของ LINE OA แล้วลองใหม่ หรือติดต่อผู้ดูแล");
    return;
  }
  const code = text;
  const displayName = await lineDisplayName(event.source.userId);
  const result = await acceptInviteCodeFromLine(admin, {
    code,
    lineUserId: event.source.userId,
    lineName: displayName,
  });
  if (!result.ok) {
    const message = result.code === "expired"
      ? "รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่จากผู้ดูแล"
      : result.code === "revoked"
        ? "รหัสยืนยันนี้ถูกยกเลิกแล้ว กรุณาติดต่อผู้ดูแล"
        : result.code === "already_used"
          ? "รหัสนี้ถูกใช้แล้ว กรุณาติดต่อผู้ดูแลหากยังเข้าใช้งานไม่ได้"
          : result.code === "lease_closed"
            ? "สัญญานี้สิ้นสุดแล้ว กรุณาติดต่อผู้ดูแล"
            : "ไม่พบรหัสยืนยันนี้ กรุณาตรวจสอบรหัสหรือขอรหัสใหม่จากผู้ดูแล";
    await reply(event.replyToken, message);
    return;
  }
  const room = result.roomNo ? ` ห้อง ${result.roomNo}` : "";
  const liffId = getEnv("NEXT_PUBLIC_LIFF_ID");
  const nextStep = liffId
    ? `เปิดระบบผู้เช่าได้ที่ https://liff.line.me/${encodeURIComponent(liffId)}`
    : "เปิดเมนูระบบผู้เช่าของหอพักเพื่อเข้าสู่ LIFF";
  await reply(event.replyToken, `ยืนยันตัวตนและผูกบัญชีสำเร็จ${room} ${nextStep}`);
}

export async function POST(request: Request) {
  if (!(await getSetting("LINE_CHANNEL_SECRET"))) return notConfiguredResponse(["LINE_CHANNEL_SECRET"]);
  const body = await request.text();
  if (!(await verifyLineSignature(body, request.headers.get("x-line-signature")))) {
    return new Response("invalid signature", { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return notConfiguredResponse(missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]));
  }
  if (!(await getSetting("LINE_CHANNEL_ACCESS_TOKEN"))) return notConfiguredResponse(["LINE_CHANNEL_ACCESS_TOKEN"]);

  let payload: { events?: LineMessageEvent[] };
  try {
    payload = JSON.parse(body) as { events?: LineMessageEvent[] };
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const events = payload.events ?? [];
  if (!Array.isArray(events)) return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    const admin = createAdminClient();
    for (const event of events) await handleEvent(admin, event);
    return new Response("ok");
  } catch {
    // Respond 500 so LINE can redeliver; accepting the same code from the same LINE account is idempotent.
    return Response.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
