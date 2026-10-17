import { isSlipokConfigured, notConfiguredResponse } from "@/lib/env";

// TODO Phase 3: รับสลิป -> เก็บ Private Storage -> เรียก SlipOK -> เทียบยอด/บัญชีผู้รับ/สลิปซ้ำ
export async function POST() {
  if (!isSlipokConfigured()) {
    return notConfiguredResponse(["SLIPOK_API_KEY", "SLIPOK_BRANCH_ID"]);
  }
  return new Response("not implemented", { status: 501 });
}

