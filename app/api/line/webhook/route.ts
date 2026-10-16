import { verifyLineSignature } from "@/lib/line";

export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyLineSignature(body, request.headers.get("x-line-signature"))) {
    return new Response("invalid signature", { status: 401 });
  }
  // TODO Phase 5: จัดการ events จาก LINE
  return new Response("ok");
}
