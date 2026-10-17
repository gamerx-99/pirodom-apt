import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken, normalizeInviteCode } from "@/lib/phase1";

type AdminClient = ReturnType<typeof createAdminClient>;

export type InviteAcceptance =
  | { ok: true; displayName: string; roomNo: string | null }
  | { ok: false; code: InviteRejectCode };
type InviteRejectCode = "invalid_code" | "expired" | "revoked" | "already_used" | "lease_closed";

async function findAuthUserByEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("อ่านบัญชี LINE ไม่สำเร็จ");
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function getOrCreateLineProfile(admin: AdminClient, lineUserId: string, lineName: string) {
  const { data: linked, error: linkedError } = await admin
    .from("profiles")
    .select("id,line_user_id,display_name,phone")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (linkedError) throw new Error("อ่านบัญชี LINE ไม่สำเร็จ");
  if (linked) return { id: linked.id as string, displayName: (linked.display_name as string | null) || lineName, phone: linked.phone as string | null };

  const email = `line_${lineUserId.toLowerCase()}@line.local`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { line_user_id: lineUserId, display_name: lineName },
  });
  if (createError && !/already|exists|registered/i.test(createError.message)) throw new Error("สร้างบัญชี LINE ไม่สำเร็จ");
  const authUser = created.user ?? await findAuthUserByEmail(admin, email);
  if (!authUser) throw new Error("หา auth user ไม่เจอ");

  const { data: byId, error: byIdError } = await admin
    .from("profiles")
    .select("id,line_user_id,display_name,phone")
    .eq("id", authUser.id)
    .maybeSingle();
  if (byIdError) throw new Error("อ่านบัญชี LINE ไม่สำเร็จ");
  if (byId?.line_user_id && byId.line_user_id !== lineUserId) throw new Error("บัญชีนี้เชื่อม LINE อื่นอยู่แล้ว");

  if (byId) {
    const { error } = await admin.from("profiles").update({ line_user_id: lineUserId, display_name: lineName }).eq("id", authUser.id);
    if (error) throw new Error("เชื่อมบัญชี LINE ไม่สำเร็จ");
    return { id: authUser.id, displayName: (byId.display_name as string | null) || lineName, phone: byId.phone as string | null };
  }

  const { error: insertError } = await admin.from("profiles").insert({
    id: authUser.id,
    line_user_id: lineUserId,
    display_name: lineName,
    role: "tenant",
  });
  if (insertError) {
    // Webhook redelivery or two messages can race to initialize the same LINE account.
    const { data: raced } = await admin.from("profiles").select("id,line_user_id,display_name,phone").eq("line_user_id", lineUserId).maybeSingle();
    if (raced) return { id: raced.id as string, displayName: (raced.display_name as string | null) || lineName, phone: raced.phone as string | null };
    throw new Error("สร้างข้อมูล LINE ไม่สำเร็จ");
  }
  return { id: authUser.id, displayName: lineName, phone: null as string | null };
}

export async function acceptInviteCodeFromLine(
  admin: AdminClient,
  input: { code: string; lineUserId: string; lineName: string },
): Promise<InviteAcceptance> {
  const code = normalizeInviteCode(input.code);
  if (!code) return { ok: false, code: "invalid_code" };

  const codeHash = hashInviteToken(code);
  const { data: invite, error: inviteError } = await admin
    .from("room_invitations")
    .select("id,lease_id,expires_at,used_at,revoked_at")
    .eq("token_hash", codeHash)
    .maybeSingle();
  if (inviteError) throw new Error("ตรวจรหัสไม่สำเร็จ");
  if (!invite) return { ok: false, code: "invalid_code" };

  // Used codes may be retried by the same LINE account after a webhook redelivery.
  const { data: existing, error: existingError } = await admin.from("profiles").select("id,line_user_id").eq("line_user_id", input.lineUserId).maybeSingle();
  if (existingError) throw new Error("อ่านบัญชี LINE ไม่สำเร็จ");
  const isRetry = Boolean(invite.used_at);
  if (isRetry && !existing) return { ok: false, code: "already_used" };
  if (!isRetry) {
    if (invite.revoked_at) return { ok: false, code: "revoked" };
    if (invite.expires_at && new Date(invite.expires_at as string).getTime() < Date.now()) return { ok: false, code: "expired" };
    const { data: lease, error: leaseError } = await admin.from("leases").select("status").eq("id", invite.lease_id).maybeSingle();
    if (leaseError) throw new Error("ตรวจสัญญาไม่สำเร็จ");
    if (lease?.status !== "active") return { ok: false, code: "lease_closed" };
  }

  const profile = await getOrCreateLineProfile(admin, input.lineUserId, input.lineName);
  const { data: result, error } = await admin.rpc("accept_invite_code", {
    p_code_hash: codeHash,
    p_user_id: profile.id,
    p_display_name: profile.displayName,
    p_phone: profile.phone,
  });
  if (error) throw new Error("ผูกบัญชีผู้เช่าไม่สำเร็จ");
  const row = Array.isArray(result) ? result[0] : null;
  if (!row?.ok) {
    const codeFromDb = String(row?.code ?? "invalid_code");
    if (["invalid_token", "invalid_code", "revoked", "already_used", "expired", "lease_closed"].includes(codeFromDb)) {
      const rejectionCodes: Record<string, InviteRejectCode> = {
        invalid_token: "invalid_code",
        invalid_code: "invalid_code",
        revoked: "revoked",
        already_used: "already_used",
        expired: "expired",
        lease_closed: "lease_closed",
      };
      return { ok: false, code: rejectionCodes[codeFromDb] };
    }
    throw new Error("ผูกบัญชีผู้เช่าไม่สำเร็จ");
  }
  const audit = {
    actor_id: profile.id,
    action: "invite.accept.line_bot",
    table_name: "room_invitations",
    record_id: String(invite.id),
  };
  const { data: priorAudit, error: auditLookupError } = await admin.from("audit_logs").select("id")
    .eq("actor_id", audit.actor_id)
    .eq("action", audit.action)
    .eq("record_id", audit.record_id)
    .maybeSingle();
  if (auditLookupError) throw new Error("บันทึกประวัติการผูกบัญชีไม่สำเร็จ");
  if (!priorAudit) {
    const { error: auditInsertError } = await admin.from("audit_logs").insert({
      ...audit,
      after: { lease_id: String(row.out_lease_id), profile_id: profile.id },
    });
    if (auditInsertError) throw new Error("บันทึกประวัติการผูกบัญชีไม่สำเร็จ");
  }
  const { data: room } = await admin.from("rooms").select("room_no").eq("id", String(row.out_room_id)).maybeSingle();
  return { ok: true, displayName: profile.displayName, roomNo: (room?.room_no as string | undefined) ?? null };
}
