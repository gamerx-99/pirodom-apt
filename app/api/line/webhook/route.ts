import { isLineWebhookConfigured, notConfiguredResponse } from "@/lib/env";
import { verifyLineSignature } from "@/lib/line";

export async function POST(request: Request) {
  if (!isLineWebhookConfigured()) {
    return notConfiguredResponse(["LINE_CHANNEL_SECRET"]);
  }
  const body = await request.text();
  if (!verifyLineSignature(body, request.headers.get("x-line-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }
  // TODO Phase 5: จัดการ events จาก LINE
  return new Response("ok");
}

