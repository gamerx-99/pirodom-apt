import type { ReactNode } from "react";

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
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
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

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
