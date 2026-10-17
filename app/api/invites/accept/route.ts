import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, cleanPhone, hashInviteToken, isValidPhone } from "@/lib/phase1";

const STATUS_BY_CODE: Record<string, number> = {
  invalid_token: 404,
  revoked: 410,
  already_used: 409,
  expired: 410,
  lease_closed: 410,
};

/**
 * POST /api/invites/accept — ผู้เช่ากดรับคำเชิญหลัง LINE Login
 * body: { token, display_name, phone }
 * ผูกผู้เช่ากับสัญญาและกินคำเชิญอยู่ในฟังก์ชัน accept_invite ที่เดียว
 * (ล็อกแถวคำเชิญก่อน) ลิงก์จึงรับได้ครั้งเดียวแม้กดพร้อมกันหลายคน
 */
export async function POST(request: Request) {
  let body: { token?: string; display_name?: string; phone?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const token = String(body.token ?? "");
  const display_name = String(body.display_name ?? "").trim().slice(0, 120);
  const phone = cleanPhone(String(body.phone ?? ""));
  if (!token || token.length > 200) return Response.json({ error: "invalid_token" }, { status: 400 });
  if (!display_name) return Response.json({ error: "name_required" }, { status: 400 });
  if (!isValidPhone(phone)) return Response.json({ error: "invalid_phone" }, { status: 400 });

  let userId: string;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
    userId = user.id;
  } catch {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const { data: result, error } = await admin.rpc("accept_invite", {
    p_token_hash: hashInviteToken(token),
    p_user_id: userId,
    p_display_name: display_name,
    p_phone: phone,
  });
  if (error) return Response.json({ error: "accept_failed" }, { status: 500 });

  const row = Array.isArray(result) ? result[0] : null;
  if (!row?.ok) {
    const code = String(row?.code ?? "accept_failed");
    return Response.json({ error: code }, { status: STATUS_BY_CODE[code] ?? 400 });
  }

  const leaseId = String(row.out_lease_id);
  await audit(admin, {
    actor_id: userId,
    action: "invite.accept",
    table_name: "lease_tenants",
    record_id: leaseId,
    after: { lease_id: leaseId },
  });

  return Response.json({ ok: true, lease_id: leaseId, room_id: String(row.out_room_id) });
}
