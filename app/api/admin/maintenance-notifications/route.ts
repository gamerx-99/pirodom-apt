import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers });
    }

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      return Response.json({ error: "ตรวจสิทธิ์ไม่สำเร็จ" }, { status: 500, headers });
    }
    if (!profile || !["owner", "admin"].includes(profile.role)) {
      return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403, headers });
    }

    const { data, count, error } = await client
      .from("maintenance_requests")
      .select("id,category,rooms(room_no)", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) {
      return Response.json({ error: "โหลดแจ้งเตือนงานซ่อมไม่สำเร็จ" }, { status: 500, headers });
    }

    const rows = (data ?? []) as unknown as {
      id: string;
      category: string;
      rooms: { room_no: string } | null;
    }[];
    return Response.json(
      {
        count: count ?? 0,
        items: rows.map((row) => ({
          id: row.id,
          category: row.category,
          room: row.rooms?.room_no ?? "—",
        })),
      },
      { headers },
    );
  } catch {
    return Response.json({ error: "โหลดแจ้งเตือนงานซ่อมไม่สำเร็จ" }, { status: 500, headers });
  }
}
