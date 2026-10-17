// ส่งข้อความ LINE push — แยกจาก DB เพื่อทดสอบได้โดยไม่ต่อเครือข่าย
// ห้าม throw: ผลการส่งต้องไม่ทำให้งานเงินที่สำเร็จแล้วกลายเป็นล้มเหลว

export type PushResult = { status: "sent" | "failed" | "skipped"; error?: string };

export function paymentResultText(input: {
  result: "approved" | "rejected";
  roomNo: string | null;
  period: string;
  total: number;
  reason?: string | null;
}): string {
  const bill = `บิลห้อง ${input.roomNo ?? "-"} งวด ${input.period.slice(0, 7)} ยอด ${input.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`;
  return input.result === "approved"
    ? `${bill}\nเจ้าหน้าที่ยืนยันการชำระแล้ว ขอบคุณที่ชำระตรงตามบิล`
    : `${bill}\nสลิปไม่ผ่านการตรวจ: ${input.reason || "ไม่ระบุเหตุผล"}\nกรุณาเปิดบิลใน LINE แล้วส่งสลิปใหม่`;
}

export async function pushLineText(
  token: string | undefined,
  to: string | null | undefined,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PushResult> {
  if (!token) return { status: "skipped", error: "LINE_CHANNEL_ACCESS_TOKEN not configured" };
  if (!to) return { status: "skipped", error: "profile has no LINE user id" };
  try {
    const response = await fetchImpl("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) return { status: "sent" };
    const detail = await response.text().catch(() => "");
    return { status: "failed", error: `HTTP ${response.status} ${detail}`.slice(0, 300) };
  } catch (error) {
    return { status: "failed", error: (error instanceof Error ? error.message : "push failed").slice(0, 300) };
  }
}
