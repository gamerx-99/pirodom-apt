import { createClient } from "@/lib/supabase/server";
import { OPEN_PAYMENT_STATUSES } from "@/lib/payment-status";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401, headers });
    const { data: profile, error: profileError } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profileError) return Response.json({ error: "ตรวจสิทธิ์ไม่สำเร็จ" }, { status: 500, headers });
    if (!profile || !["owner", "admin"].includes(profile.role)) {
      return Response.json({ error: "ไม่มีสิทธิ์เข้าถึง" }, { status: 403, headers });
    }
    // The queue remains the source of truth until a slip is reviewed. This also
    // covers existing submissions and newly appointed staff, without read flags.
    const { data, count, error } = await client.from("payments")
      .select("id,status,invoices(period,leases(rooms(room_no)))", { count: "exact" })
      .in("status", OPEN_PAYMENT_STATUSES)
      .order("created_at", { ascending: false }).limit(3);
    if (error) return Response.json({ error: "โหลดแจ้งเตือนสลิปไม่สำเร็จ" }, { status: 500, headers });
    const rows = (data ?? []) as unknown as {
      id: string; status: string;
      invoices: { period: string; leases: { rooms: { room_no: string } | null } | null } | null;
    }[];
    return Response.json({ count: count ?? 0, items: rows.map((row) => ({
      id: row.id, status: row.status,
      period: row.invoices?.period.slice(0, 7) ?? "—",
      room: row.invoices?.leases?.rooms?.room_no ?? "—",
    })) }, { headers });
  } catch {
    return Response.json({ error: "โหลดแจ้งเตือนสลิปไม่สำเร็จ" }, { status: 500, headers });
  }
}
