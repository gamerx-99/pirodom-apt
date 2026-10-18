import { Badge, Card, DemoBanner } from "@/app/components/ui";
import { isSupabaseAdminConfigured } from "@/lib/env";
import { SECRET_KEYS, getSettings, isLineConfigured, isSlipokConfigured, type SettingKey } from "@/lib/settings";
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
    title: "LINE",
    desc: "จาก LINE Developers: LINE Login และ Messaging API ต้องอยู่ Provider เดียวกัน",
    fields: [
      { key: "LINE_LOGIN_CHANNEL_ID", label: "LINE Login Channel ID" },
      { key: "LINE_CHANNEL_SECRET", label: "Messaging API Channel secret" },
      { key: "LINE_CHANNEL_ACCESS_TOKEN", label: "Messaging API Channel access token" },
    ],
  },
];

export default async function Page() {
  if (!isSupabaseAdminConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่า</h1>
        <DemoBanner text="ยังไม่ได้เชื่อมต่อฐานข้อมูล: บันทึกการตั้งค่าได้เมื่อเชื่อมต่อระบบแล้ว" />
      </div>
    );
  }
  const settings = await getSettings();
  const [line, slipok] = await Promise.all([isLineConfigured(), isSlipokConfigured()]);
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
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่า</h1>
        <p className="text-sm text-gray-500">บัญชีรับเงินและการเชื่อมต่อ: บันทึกแล้วมีผลทันที ไม่ต้อง deploy ใหม่</p>
      </div>
      <Card title="สถานะการเชื่อมต่อ">
        <div className="flex flex-wrap gap-2">
          <Badge tone={settings.PROMPTPAY_ID ? "green" : "gray"}>PromptPay: {settings.PROMPTPAY_ID ? "พร้อม" : "ยังไม่ตั้งค่า"}</Badge>
          <Badge tone={slipok ? "green" : "gray"}>SlipOK: {slipok ? "พร้อม" : "ยังไม่ตั้งค่า"}</Badge>
          <Badge tone={line ? "green" : "gray"}>LINE: {line ? "พร้อม" : "ยังไม่ครบ"}</Badge>
        </div>
      </Card>
      <SettingsForm groups={groups} />
    </div>
  );
}
