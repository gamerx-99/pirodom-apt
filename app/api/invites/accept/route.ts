import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, cleanPhone, hashInviteToken, isValidPhone } from "@/lib/phase1";

/**
 * POST /api/invites/accept — ผู้เช่ากดรับคำเชิญหลัง LINE Login
 * body: { token, display_name, phone }
 * กันรับพร้อมกัน: mark used แบบ compare-and-set (used_at is null) สำเร็จได้ครั้งเดียว
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

  const { data: invite } = await admin
    .from("room_invitations")
    .select("id,lease_id,expires_at,used_at,revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invite) return Response.json({ error: "invalid_token" }, { status: 404 });
  if (invite.used_at) return Response.json({ error: "already_used" }, { status: 410 });
  if (invite.revoked_at) return Response.json({ error: "revoked" }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) return Response.json({ error: "expired" }, { status: 410 });

  const { data: lease } = await admin
    .from("leases")
    .select("id,status,room_id")
    .eq("id", invite.lease_id)
    .maybeSingle();
  if (!lease || lease.status !== "active") return Response.json({ error: "lease_closed" }, { status: 410 });

  // ผูกซ้ำเดิม → ok โดยไม่กิน invite (กันกดเบิ้ล)
  const { data: existing } = await admin
    .from("lease_tenants")
    .select("lease_id")
    .eq("lease_id", lease.id)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!existing) {
    const { data: members } = await admin.from("lease_tenants").select("profile_id").eq("lease_id", lease.id);
    const is_primary = !members || members.length === 0;

    await admin.from("profiles").upsert({ id: userId, display_name, phone }, { onConflict: "id" });
    const { error: bindError } = await admin
      .from("lease_tenants")
      .insert({ lease_id: lease.id, profile_id: userId, is_primary });
    // กดพร้อมกัน 2 เครื่องของคนเดียวกัน → unique ชน = ถือว่าสำเร็จแล้ว
    if (bindError && bindError.code !== "23505") {
      return Response.json({ error: "bind_failed" }, { status: 500 });
    }
    // compare-and-set: มีเพียงคำขอแรกที่พลิก used_at จาก null ได้
    const { data: claimed } = await admin
      .from("room_invitations")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", invite.id)
      .is("used_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      return Response.json({ error: "already_used" }, { status: 409 });
    }
    await audit(admin, { actor_id: userId, action: "invite.accept", table_name: "lease_tenants", after: { lease_id: lease.id } });
  } else {
    await admin.from("profiles").upsert({ id: userId, display_name, phone }, { onConflict: "id" });
  }

  return Response.json({ ok: true, lease_id: lease.id, room_id: lease.room_id });
}
