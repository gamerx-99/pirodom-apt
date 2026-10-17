 // ตรวจ token สดทุก request — ยกเว้น static-shell validation (Cache Components)
 export const instant = false;
import Link from "next/link";
import { Card } from "@/app/components/ui";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/phase1";
import { JoinForm } from "./join-form";

function Problem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ยืนยันการผูกบัญชี</h1>
      </div>
      <Card title={title} desc="ขอลิงก์ใหม่จากผู้ดูแลหอพัก">
        <p className="text-sm text-gray-500">{desc}</p>
        <Link href="/liff" className="mt-2 block text-sm font-semibold text-teal-700">ไปหน้าหลัก</Link>
      </Card>
    </div>
  );
}

type LeaseInfo = {
  id: string;
  start_date: string;
  status: string;
  rooms: { room_no: string; unit_type: string } | null;
} | null;

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 200) {
    return <Problem title="ลิงก์ไม่ถูกต้อง" desc="ลิงก์เชิญไม่สมบูรณ์" />;
  }
  if (!isSupabaseConfigured()) {
    return <Problem title="ระบบยังไม่พร้อม" desc="ยังไม่ได้เชื่อมต่อฐานข้อมูล: กรุณาขอลิงก์ใหม่จากผู้ดูแลเมื่อระบบพร้อมใช้งาน" />;
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return <Problem title="ระบบยังไม่พร้อม" desc="ยังไม่ได้เชื่อมต่อฐานข้อมูล: กรุณาขอลิงก์ใหม่จากผู้ดูแลเมื่อระบบพร้อมใช้งาน" />;
  }

  // ตรวจ token ฝั่ง server เท่านั้น — ไม่ log token ดิบ
  const { data: invite } = await admin
    .from("room_invitations")
    .select("lease_id,expires_at,used_at,revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invite) return <Problem title="ลิงก์ไม่ถูกต้อง" desc="ไม่พบคำเชิญนี้" />;
  if (invite.used_at) return <Problem title="ลิงก์ถูกใช้ไปแล้ว" desc="ลิงก์นี้ถูกใช้งานไปแล้ว กรุณาติดต่อผู้ดูแลเพื่อขอรับลิงก์ใหม่" />;
  if (invite.revoked_at) return <Problem title="ลิงก์ถูกเพิกถอน" desc="คำเชิญนี้ถูกยกเลิกแล้ว กรุณาติดต่อผู้ดูแลเพื่อขอรับลิงก์ใหม่" />;
  if (new Date(invite.expires_at) < new Date()) {
    return <Problem title="ลิงก์หมดอายุ" desc="ลิงก์หมดอายุ (มีอายุ 7 วัน) กรุณาติดต่อผู้ดูแลเพื่อขอรับลิงก์ใหม่" />;
  }

  const { data: leaseRaw } = await admin
    .from("leases")
    .select("id,start_date,status, rooms(room_no,unit_type)")
    .eq("id", invite.lease_id)
    .maybeSingle();
  const lease = leaseRaw as unknown as LeaseInfo;
  if (!lease || lease.status !== "active") {
    return <Problem title="สัญญานี้ปิดแล้ว" desc="ติดต่อผู้ดูแลเพื่อออกคำเชิญจากสัญญาปัจจุบัน" />;
  }

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ยืนยันการผูกบัญชี</h1>
        <p className="text-sm text-gray-500">คำเชิญถูกต้อง: ลิงก์มีอายุ 7 วันและใช้งานได้ครั้งเดียว</p>
      </div>
      <Card title="ห้องที่เชิญ" desc={`เริ่มสัญญา ${lease.start_date}`}>
        <p className="text-sm">
          ห้อง {lease.rooms?.room_no ?? "?"} · {lease.rooms?.unit_type === "commercial" ? "ร้านค้า" : "ห้องพัก"}
        </p>
      </Card>
      <Card title="ยืนยันตัวตน">
        <JoinForm token={token} />
      </Card>
    </div>
  );
}
