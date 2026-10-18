import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: "gray" | "green" | "amber" | "red" | "blue";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 ring-gray-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function Card({
  title,
  desc,
  action,
  children,
}: {
  title?: string;
  desc?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl bg-white p-4 text-gray-900 shadow-sm ring-1 ring-gray-200 sm:p-5">
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
            {desc && <p className="mt-0.5 text-sm text-gray-500">{desc}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-gray-100">
      <p className="text-base font-semibold text-gray-800">{title}</p>
      {desc && <p className="max-w-md text-sm text-gray-500">{desc}</p>}
      {action}
    </div>
  );
}

export function DemoBanner({ text }: { text?: string }) {
  return (
    <div className="mb-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="font-semibold">ข้อมูลตัวอย่าง</span>
      {text ? `: ${text}` : ": ยังไม่เชื่อมฐานข้อมูลจริง ตัวเลขในหน้านี้ใช้เพื่อสาธิตเท่านั้น"}
    </div>
  );
}

const STAT_TONE = {
  default: { value: "text-slate-900", icon: "bg-blue-50 text-blue-600", card: "ring-slate-200" },
  green: { value: "text-emerald-600", icon: "bg-emerald-50 text-emerald-600", card: "ring-slate-200" },
  amber: { value: "text-amber-600", icon: "bg-amber-50 text-amber-600", card: "ring-slate-200" },
  red: { value: "text-rose-600", icon: "bg-rose-50 text-rose-600", card: "ring-2 ring-rose-200" },
  blue: { value: "text-blue-600", icon: "bg-blue-50 text-blue-600", card: "ring-slate-200" },
};

// การ์ดตัวเลขตาม mockup: ป้ายเล็ก + ไอคอนมุมขวา + ตัวเลขใหญ่สีตามสถานะ
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: IconName;
  tone?: keyof typeof STAT_TONE;
}) {
  const t = STAT_TONE[tone];
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 sm:p-5 ${t.card}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}><Icon name={icon} /></span>}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${t.value}`}>{value}</p>
      {sub && <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
