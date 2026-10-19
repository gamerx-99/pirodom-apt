import { DemoBanner, StatCard } from "@/app/components/ui";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { SECRET_KEYS, getSettings, isLineConfigured, isSlipokConfigured, type SettingKey } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AdminManagement, type StaffMember } from "./admin-management";
import { SettingsForm } from "./settings-form";

const GROUPS: { title: string; desc: string; fields: { key: SettingKey; label: string; hint?: string }[] }[] = [
  {
    title: "PromptPay (QR บนบิล)",
    desc: "ผู้เช่าสแกนจ่ายตามยอดบิล",
    fields: [
      { key: "PROMPTPAY_ID", label: "เบอร์ PromptPay / เลขประจำตัว", hint: "เบอร์มือถือ 10 หลัก หรือเลข 13 หลัก" },
      { key: "PROMPTPAY_ACCOUNT_NAME", label: "ชื่อบัญชีที่แสดงใต้ QR" },
    ],
  },
  {
    title: "SlipOK (ตรวจสลิปอัตโนมัติ)",
    desc: "ดูได้ที่หน้า API ของ SlipOK: ไม่ตั้งค่า = สลิปเข้าคิวให้แอดมินตรวจเอง",
    fields: [
      { key: "SLIPOK_BRANCH_ID", label: "Branch ID" },
      { key: "SLIPOK_API_KEY", label: "API Key" },
    ],
  },
  {
    title: "Google Drive",
    desc: "สร้างโฟลเดอร์ของแต่ละสัญญาอัตโนมัติเมื่อเปิดสัญญาใหม่ (มีโฟลเดอร์สลิปและเอกสารข้างใน)",
    fields: [
      { key: "GOOGLE_SERVICE_ACCOUNT_JSON", label: "Service Account (ไฟล์ JSON)", hint: "Google Cloud Console > IAM > Service Accounts > Keys > Add key (JSON) เปิด Drive API แล้ววางเนื้อหาไฟล์ทั้งไฟล์" },
      { key: "GOOGLE_DRIVE_FOLDER_ID", label: "Folder ID หลัก", hint: "ส่วนท้ายของลิงก์ drive.google.com/drive/folders/<ID> และต้องแชร์โฟลเดอร์นี้ให้อีเมล service account เป็นผู้แก้ไข" },
    ],
  },
  {
    title: "LINE",
    desc: "จาก LINE Developers: LINE Login และ Messaging API ต้องอยู่ Provider เดียวกัน",
    fields: [
      { key: "LINE_LOGIN_CHANNEL_ID", label: "LINE Login Channel ID" },
      { key: "LINE_CHANNEL_SECRET", label: "Messaging API Channel secret" },
      { key: "LINE_CHANNEL_ACCESS_TOKEN", label: "Messaging API Channel access token" },
    ],
  },
];

const DEMO_STAFF: StaffMember[] = [
  {
    id: "demo-owner",
    display_name: "เจ้าของหอพัก (Demo)",
    line_user_id: "U0123456789abcdef0123456789owner",
    role: "owner",
    phone: "081-234-5678",
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-admin",
    display_name: "ผู้จัดการหอพัก (Demo)",
    line_user_id: "U0123456789abcdef0123456789admin",
    role: "admin",
    phone: "089-876-5432",
    created_at: new Date().toISOString(),
  },
];

export default async function Page() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ตั้งค่าระบบ</h1>
          <p className="text-sm text-gray-500">บัญชีรับเงินและการเชื่อมต่อ: บันทึกแล้วมีผลทันที ไม่ต้อง deploy ใหม่</p>
        </div>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: บันทึกการตั้งค่าได้เมื่อเชื่อมต่อระบบแล้ว" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="PromptPay" value="ยังไม่ตั้งค่า" sub="รับเงินสแกน QR บนบิล" icon="receipt" />
          <StatCard label="SlipOK" value="ยังไม่ตั้งค่า" sub="สลิปจะเข้าคิวให้ตรวจมือ" icon="check" tone="amber" />
          <StatCard label="LINE" value="ยังไม่ครบ" sub="ยังไม่ได้ผูกโทเคน LINE" icon="message" tone="amber" />
        </div>
        <AdminManagement staffList={DEMO_STAFF} demo />
      </div>
    );
  }

  const [settings, line, slipok, supabase] = await Promise.all([
    getSettings(),
    isLineConfigured(),
    isSlipokConfigured(),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminClient = createAdminClient();

  const [{ data: staffProfiles }, { data: candidateProfiles }] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, line_user_id, display_name, phone, role, created_at")
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: true }),
    adminClient
      .from("profiles")
      .select("id, line_user_id, display_name, phone")
      .eq("role", "tenant")
      .not("line_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const staffList: StaffMember[] = (staffProfiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    line_user_id: p.line_user_id,
    phone: p.phone,
    role: p.role,
    created_at: p.created_at,
  }));

  const currentUserProfile = staffProfiles?.find((p) => p.id === user?.id);
  const currentUserRole = currentUserProfile?.role ?? "admin";

  const groups = GROUPS.map((g) => ({
    ...g,
    fields: g.fields.map((f) => {
      const secret = SECRET_KEYS.includes(f.key);
      // ค่าลับไม่ส่งไปหน้าเว็บ
      return { ...f, secret, isSet: !!settings[f.key], value: secret ? undefined : settings[f.key] };
    }),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">ตั้งค่าระบบ</h1>
        <p className="text-sm text-gray-500">บัญชีรับเงินและการเชื่อมต่อ: บันทึกแล้วมีผลทันที ไม่ต้อง deploy ใหม่</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="PromptPay"
          value={settings.PROMPTPAY_ID ? "พร้อม" : "ยังไม่ตั้งค่า"}
          sub={settings.PROMPTPAY_ACCOUNT_NAME || (settings.PROMPTPAY_ID ? `ID: ${settings.PROMPTPAY_ID}` : "สแกน QR บนบิล")}
          icon="receipt"
          tone={settings.PROMPTPAY_ID ? "green" : "default"}
        />
        <StatCard
          label="SlipOK"
          value={slipok ? "พร้อม" : "ยังไม่ตั้งค่า"}
          sub={slipok ? "ตรวจสลิปอัตโนมัติเปิดอยู่" : "สลิปจะเข้าคิวให้ตรวจมือ"}
          icon="check"
          tone={slipok ? "green" : "amber"}
        />
        <StatCard
          label="LINE"
          value={line ? "พร้อม" : "ยังไม่ครบ"}
          sub={line ? "เชื่อมต่อ Messaging API แล้ว" : "ยังไม่ได้ผูกโทเคน LINE"}
          icon="message"
          tone={line ? "green" : "amber"}
        />
      </div>

      <AdminManagement
        staffList={staffList}
        candidateUsers={candidateProfiles ?? []}
        currentUserId={user?.id}
        currentUserRole={currentUserRole}
      />

      <SettingsForm groups={groups} />
    </div>
  );
}
