import { randomUUID } from "node:crypto";
import { audit, toNumberOrNull } from "@/lib/phase1";
import { getEnv, isSlipokConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { removePrivateFile, storagePath, uploadPrivateFile } from "@/lib/storage";
import { OPEN_PAYMENT_STATUSES } from "@/lib/payment-status";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = 4_500_000;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type SlipokPayload = {
  success?: boolean;
  code?: number;
  message?: string;
  data?: {
    success?: boolean;
    message?: string;
    transRef?: string;
    amount?: number;
    receivingBank?: string;
    sendingBank?: string;
    transDate?: string;
    transTime?: string;
  };
};

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json({ error: "ไฟล์ใหญ่เกินกำหนด (สูงสุด 4 MB)" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "อ่านข้อมูลอัปโหลดไม่สำเร็จ" }, { status: 400 });
  }

  const invoiceId = String(form.get("invoice_id") ?? "").trim();
  const file = form.get("slip");
  if (!validUuid(invoiceId) || !(file instanceof File)) {
    return Response.json({ error: "ข้อมูลบิลหรือไฟล์สลิปไม่ครบ" }, { status: 400 });
  }
  if (!IMAGE_TYPES[file.type] || file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "แนบ JPG, PNG หรือ WEBP ขนาดไม่เกิน 4 MB" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบด้วย LINE ก่อนส่งสลิป" }, { status: 401 });

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id,lease_id,total,status,due_date")
      .eq("id", invoiceId)
      .maybeSingle();
    if (invoiceError || !invoice) return Response.json({ error: "ไม่พบบิลหรือไม่มีสิทธิ์ส่งสลิป" }, { status: 404 });
    if (invoice.status !== "issued" && invoice.status !== "overdue") {
      return Response.json({ error: "บิลนี้ไม่อยู่ในสถานะรับสลิป" }, { status: 409 });
    }

    const admin = createAdminClient();
    const { data: openPayment, error: openError } = await admin
      .from("payments")
      .select("id")
      .eq("invoice_id", invoice.id)
      .in("status", OPEN_PAYMENT_STATUSES)
      .limit(1)
      .maybeSingle();
    if (openError) return Response.json({ error: "ตรวจสอบรายการส่งสลิปเดิมไม่สำเร็จ" }, { status: 500 });
    if (openPayment) return Response.json({ error: "มีสลิปของบิลนี้รอเจ้าหน้าที่ตรวจอยู่แล้ว" }, { status: 409 });

    const extension = IMAGE_TYPES[file.type];
    const path = storagePath("slips", invoice.lease_id, invoice.id, `${randomUUID()}.${extension}`);
    let slipPath: string;
    try {
      slipPath = await uploadPrivateFile("slips", path, file);
    } catch {
      return Response.json({ error: "อัปโหลดสลิปไม่สำเร็จ" }, { status: 400 });
    }

    const registered = await admin
      .from("payments")
      .insert({ invoice_id: invoice.id, slip_path: slipPath, status: "uploaded", submitted_by: user.id })
      .select("id")
      .single();
    let payment = registered.data;
    const paymentError = registered.error;
    if (paymentError || !payment) {
      // A lost INSERT response does not prove rollback. Look up the unique
      // uploaded path before deleting a file that a committed row may reference.
      const receipt = await admin.from("payments").select("id").eq("slip_path", slipPath).maybeSingle();
      if (receipt.data) {
        payment = receipt.data;
      } else if (paymentError?.code === "23505" && !receipt.error) {
        await removePrivateFile("slips", slipPath).catch(() => undefined);
        return Response.json({ error: "มีสลิปของบิลนี้รอตรวจอยู่แล้ว" }, { status: 409 });
      } else {
        await audit(admin, { actor_id: user.id, action: "payment.upload.record_uncertain", table_name: "payments", after: { invoice_id: invoice.id, slip_path: slipPath } });
        return Response.json({ saved: true, error: "เก็บไฟล์สลิปแล้ว แต่ยืนยันการบันทึกรายการไม่สำเร็จ กรุณาแจ้งเจ้าหน้าที่โดยไม่ต้องส่งสลิปซ้ำ" }, { status: 500 });
      }
    }

    let reviewStatus: "slipok_passed" | "slipok_failed" | "mismatch" | "pending_review" = "pending_review";
    let verifiedAmount: number | null = null;
    let reference: string | null = null;
    let verification: Record<string, unknown> = { status: "pending_review", reason: "slipok_not_configured" };

    if (isSlipokConfigured()) {
      try {
        const branchId = getEnv("SLIPOK_BRANCH_ID")!;
        const apiKey = getEnv("SLIPOK_API_KEY")!;
        const body = new FormData();
        body.append("files", file, file.name || `slip.${extension}`);
        body.append("amount", String(Number(invoice.total)));
        body.append("log", "true");
        const response = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}`, {
          method: "POST",
          headers: { "x-authorization": apiKey },
          body,
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({})) as SlipokPayload;
        const data = payload.data;
        reference = typeof data?.transRef === "string" ? data.transRef.slice(0, 128) : null;
        const amount = toNumberOrNull(data?.amount == null ? null : String(data.amount));
        verifiedAmount = amount == null ? null : amount;
        const code = Number(payload.code);
        const isValid = response.ok && payload.success === true && data?.success === true;
        if (isValid && reference && verifiedAmount === Number(invoice.total)) {
          reviewStatus = "slipok_passed";
        } else if (isValid || [1012, 1013, 1014].includes(code)) {
          reviewStatus = "mismatch";
        } else if ([1005, 1006, 1007, 1008, 1011].includes(code)) {
          reviewStatus = "slipok_failed";
        }
        verification = {
          status: reviewStatus,
          code: Number.isFinite(code) ? code : null,
          amount: verifiedAmount,
          reference,
          receivingBank: data?.receivingBank ?? null,
          sendingBank: data?.sendingBank ?? null,
          transDate: data?.transDate ?? null,
          transTime: data?.transTime ?? null,
          message: typeof payload.message === "string" ? payload.message.slice(0, 160) : null,
        };
      } catch {
        verification = { status: "pending_review", reason: "slipok_unavailable" };
      }
    }

    const { error: verificationError } = await admin.from("payment_verifications").insert({
      payment_id: payment.id,
      provider: "slipok",
      result: JSON.stringify(verification),
      provider_reference: reference,
      raw_response: null,
    });
    if (verificationError) {
      // A lost response may hide a successful insert. Reuse that payment's log
      // before recording a duplicate-reference failure; never overwrite it.
      const { data: existing } = await admin.from("payment_verifications")
        .select("id").eq("payment_id", payment.id).limit(1).maybeSingle();
      if (!existing) {
        if (verificationError.code !== "23505") {
          return Response.json({ saved: true, error: "เก็บสลิปแล้ว แต่บันทึกผลตรวจยังไม่สำเร็จ กรุณาแจ้งเจ้าหน้าที่โดยไม่ต้องส่งสลิปใหม่" }, { status: 500 });
        }
        reviewStatus = "mismatch";
        verification = { status: reviewStatus, reason: "duplicate_reference" };
        const { error: fallbackError } = await admin.from("payment_verifications").insert({
          payment_id: payment.id,
          provider: "slipok",
          result: JSON.stringify(verification),
          provider_reference: null,
          raw_response: null,
        });
        if (fallbackError) {
          return Response.json({ saved: true, error: "เก็บสลิปแล้ว แต่บันทึกผลตรวจยังไม่สำเร็จ กรุณาแจ้งเจ้าหน้าที่โดยไม่ต้องส่งสลิปใหม่" }, { status: 500 });
        }
      }
    }

    // Payment + invoice + audit change together. A failed transaction leaves the
    // saved image/log available for staff to retry WITHOUT uploading or rechecking.
    const { data: recorded, error: recordError } = await admin.rpc("finalize_invoice_payment_verification", {
      p_payment_id: payment.id,
      p_actor_id: user.id,
    });
    if (recordError || !recorded) {
      await audit(admin, {
        actor_id: user.id,
        action: "payment.submit.record_failed",
        table_name: "payments",
        record_id: payment.id,
        after: { invoice_id: invoice.id, intended_status: reviewStatus },
      });
      return Response.json(
        { saved: true, error: "เก็บสลิปและผลตรวจแล้ว เจ้าหน้าที่นำรายการเดิมกลับเข้าคิวได้ กรุณาแจ้งเจ้าหน้าที่โดยไม่ต้องส่งสลิปใหม่" },
        { status: 500 },
      );
    }
    await audit(admin, {
      actor_id: user.id,
      action: "payment.submit",
      table_name: "payments",
      record_id: payment.id,
      after: { invoice_id: invoice.id, status: recorded, amount: verifiedAmount, has_slip: true },
    });

    return Response.json({
      ok: true,
      status: recorded,
      message: recorded === "slipok_passed"
        ? "SlipOK ตรวจเบื้องต้นผ่านแล้ว: รอเจ้าหน้าที่ตรวจและยืนยัน"
        : "รับสลิปแล้ว: รายการอยู่ในคิวให้เจ้าหน้าที่ตรวจสอบ",
    });
  } catch {
    return Response.json({ error: "ส่งสลิปไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
