import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEnv, isSupabaseAdminConfigured, isSupabaseConfigured, notConfiguredResponse } from "@/lib/env";
import { verifyLineIdToken } from "@/lib/line-auth";

type AdminClient = ReturnType<typeof createAdminClient>;

/** ค้น auth user จาก email — listUsers คืนทีละหน้า จึงต้องไล่จนเจอ (ไม่ใช่อ่านหน้าแรกอย่างเดียว) */
async function findAuthUserByEmail(admin: AdminClient, address: string) {
  const target = address.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

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

    // บัญชีที่จะเข้าสู่ระบบต้องเป็นบัญชีเดียวกับ profile ที่ผูก LINE id นี้ไว้
    // ถ้าผูกไว้กับบัญชีอื่น (เช่น owner ที่สมัครด้วยอีเมล) ต้องออก login link ของบัญชีนั้น
    // ไม่ใช่ของอีเมลสังเคราะห์ ไม่เช่นนั้น session จะตกไปที่บัญชีที่ไม่ได้ผูกไว้
    let profileId = existing?.id ?? null;
    let signInEmail = email;
    if (byLine) {
      const { data: linked, error: linkedError } = await admin.auth.admin.getUserById(byLine.id);
      if (linkedError || !linked.user?.email) {
        throw new Error(linkedError?.message ?? "อ่านบัญชีที่ผูก LINE ไม่ได้");
      }
      signInEmail = linked.user.email;
    }
    if (!profileId) {
      profileId = (await findAuthUserByEmail(admin, email))?.id ?? created.data.user?.id ?? null;
    }
    if (!profileId) {
      throw new Error("หา auth user ไม่เจอ");
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
        id: profileId,
        line_user_id: lineUserId,
        display_name: claims.name ?? null,
        role: "tenant",
      });
    }

    // verify ฝั่ง server เพื่อตั้ง session cookie
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: signInEmail,
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
      .eq("id", profileId)
      .maybeSingle();

    return Response.json({ ok: true, profile });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return Response.json({ error: "bridge_failed", message }, { status: 500 });
  }
}
