import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEnv, isSupabaseAdminConfigured, isSupabaseConfigured, notConfiguredResponse } from "@/lib/env";
import { verifyLineIdToken } from "@/lib/line-auth";

// สะพาน LINE → Supabase session (role คงเดิม ไม่ให้ยกระดับตัวเอง)
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return notConfiguredResponse(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  }
  if (!isSupabaseAdminConfigured()) {
    return notConfiguredResponse(["SUPABASE_SERVICE_ROLE_KEY"]);
  }
  const channelId = getEnv("LINE_LOGIN_CHANNEL_ID");
  if (!channelId) {
    return notConfiguredResponse(["LINE_LOGIN_CHANNEL_ID"]);
  }

  let idToken: string | undefined;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    if (typeof body.idToken === "string" && body.idToken.length > 0) idToken = body.idToken;
  } catch {
    // ตกไปตอบ 400 ด้านล่าง
  }
  if (!idToken) {
    return Response.json({ error: "missing_id_token" }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyLineIdToken(idToken);
  } catch {
    return Response.json({ error: "invalid_id_token" }, { status: 401 });
  }

  const lineUserId = claims.sub;
  // email สังเคราะห์ (deterministic) — ไม่พึ่ง email scope ของ LIFF
  const email = `line_${lineUserId.toLowerCase()}@line.local`;

  try {
    const admin = createAdminClient();

    // มีแล้วถือว่าสำเร็จ (กันสร้างซ้ำ)
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId, display_name: claims.name ?? null },
    });
    if (created.error && !/already|exists|registered/i.test(created.error.message)) {
      throw new Error(created.error.message);
    }

    // อ่าน profile 2 ทาง: ผูกด้วย LINE id นี้อยู่แล้ว หรือ auth id ตรงกับที่จะผูก
    // role ที่มีอยู่ต้องคงเดิมเสมอ — สะพานนี้ไม่มีสิทธิ์ยกระดับหรือลดระดับใคร
    const [{ data: byLine }, { data: byId }] = await Promise.all([
      admin.from("profiles").select("id, role").eq("line_user_id", lineUserId).maybeSingle(),
      admin
        .from("profiles")
        .select("id, role, line_user_id")
        .eq("id", created.data.user?.id ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle(),
    ]);
    const existing = byLine ?? byId ?? null;

    const userId = existing?.id ?? created.data.user?.id ?? null;
    // user มีอยู่แล้วแต่ profile ยังไม่มี ให้ค้น id จาก email
    let resolvedId = userId;
    if (!resolvedId) {
      const { data: listed } = await admin.auth.admin.listUsers();
      resolvedId = listed.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    }
    if (!resolvedId) {
      throw new Error("หา auth user ไม่เจอ");
    }

    // LINE id นี้ผูกกับบัญชีอื่นอยู่แล้ว — ไม่ย้ายสิทธิ์ให้บัญชีใหม่
    if (byLine && byLine.id !== resolvedId) {
      return Response.json({ error: "line_already_linked" }, { status: 409 });
    }

    if (existing) {
      // แตะแค่ข้อมูลแสดงผล ห้ามแตะ role เด็ดขาด
      await admin
        .from("profiles")
        .update({ line_user_id: lineUserId, display_name: claims.name ?? undefined })
        .eq("id", existing.id);
    } else {
      // ตั้ง tenant เฉพาะแถวที่สร้างใหม่ครั้งแรกเท่านั้น
      await admin.from("profiles").insert({
        id: resolvedId,
        line_user_id: lineUserId,
        display_name: claims.name ?? null,
        role: "tenant",
      });
    }

    // verify ฝั่ง server เพื่อตั้ง session cookie
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkError || !link.properties.hashed_token) {
      throw new Error(linkError?.message ?? "ออก login link ไม่ได้");
    }
    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: "email",
    });
    if (verifyError) {
      throw new Error(verifyError.message);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, line_user_id, display_name, role")
      .eq("id", resolvedId)
      .maybeSingle();

    return Response.json({ ok: true, profile });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return Response.json({ error: "bridge_failed", message }, { status: 500 });
  }
}
