import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Recipient = {
  leaseId: string;
  roomNo: string;
  tenants: { profileId: string; name: string | null; lineUserId: string | null }[];
  unpaid: number;
  nextDue: string | null;
};

type Row = {
  id: string;
  rooms: { room_no: string } | null;
  lease_tenants: { profile_id: string; profiles: { display_name: string | null; line_user_id: string | null } | null }[];
  invoices: { total: number; due_date: string; status: string }[];
};

/** ผู้เช่าในสัญญาที่ใช้งานอยู่ พร้อมยอดบิลที่ยังไม่ส่งสลิป (issued/overdue) ต่อห้อง */
export async function loadRecipients(client: SupabaseClient): Promise<Recipient[]> {
  const { data, error } = await client
    .from("leases")
    .select("id,rooms(room_no),lease_tenants(profile_id,profiles(display_name,line_user_id)),invoices(total,due_date,status)")
    .eq("status", "active");
  if (error) throw new Error("โหลดรายชื่อผู้เช่าไม่สำเร็จ");
  return ((data ?? []) as unknown as Row[])
    .map((lease) => {
      const open = lease.invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "overdue");
      return {
        leaseId: lease.id,
        roomNo: lease.rooms?.room_no ?? "-",
        tenants: lease.lease_tenants.map((t) => ({ profileId: t.profile_id, name: t.profiles?.display_name ?? null, lineUserId: t.profiles?.line_user_id ?? null })),
        unpaid: Math.round(open.reduce((sum, invoice) => sum + Number(invoice.total), 0) * 100) / 100,
        nextDue: open.map((invoice) => invoice.due_date).sort()[0] ?? null,
      };
    })
    .filter((recipient) => recipient.tenants.length > 0)
    .sort((a, b) => a.roomNo.localeCompare(b.roomNo, "th", { numeric: true }));
}
