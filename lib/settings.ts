import "server-only";
import { cache } from "react";
import { getEnv, isSupabaseAdminConfigured } from "./env";
import { createAdminClient } from "./supabase/admin";

/** ค่าที่เจ้าของกรอกเองได้ที่ /admin/settings — ค่าในฐานข้อมูลชนะ env, ไม่มีทั้งคู่ = ยังไม่ตั้งค่า */
export const SETTING_KEYS = [
  "SLIPOK_API_KEY",
  "SLIPOK_BRANCH_ID",
  "PROMPTPAY_ID",
  "PROMPTPAY_ACCOUNT_NAME",
  "GOOGLE_DRIVE_API_KEY",
  "GOOGLE_DRIVE_FOLDER_ID",
  "LINE_LOGIN_CHANNEL_ID",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** คีย์ลับ: ไม่ส่งค่ากลับไปหน้าเว็บ แสดงแค่ว่าตั้งแล้ว */
export const SECRET_KEYS: readonly SettingKey[] = ["SLIPOK_API_KEY", "GOOGLE_DRIVE_API_KEY", "LINE_CHANNEL_SECRET", "LINE_CHANNEL_ACCESS_TOKEN"];

export const getSettings = cache(async (): Promise<Partial<Record<SettingKey, string>>> => {
  const out: Partial<Record<SettingKey, string>> = {};
  for (const key of SETTING_KEYS) {
    const v = getEnv(key);
    if (v) out[key] = v;
  }
  if (!isSupabaseAdminConfigured()) return out;
  try {
    const { data } = await createAdminClient().from("app_settings").select("key,value").in("key", SETTING_KEYS);
    for (const row of data ?? []) {
      if (row.value) out[row.key as SettingKey] = row.value;
    }
  } catch {
    // อ่านฐานข้อมูลไม่ได้ ใช้ env ไปก่อน
  }
  return out;
});

export async function getSetting(key: SettingKey): Promise<string | undefined> {
  return (await getSettings())[key];
}

export async function isLineConfigured(): Promise<boolean> {
  const s = await getSettings();
  return !!s.LINE_CHANNEL_SECRET && !!s.LINE_CHANNEL_ACCESS_TOKEN && !!s.LINE_LOGIN_CHANNEL_ID;
}

export async function isSlipokConfigured(): Promise<boolean> {
  const s = await getSettings();
  return !!s.SLIPOK_API_KEY && !!s.SLIPOK_BRANCH_ID;
}
