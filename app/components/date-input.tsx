"use client";

import { useState } from "react";
import { formatDMY, maskDMY, parseDMY } from "@/lib/date-input";

/** ช่องวันที่ DD/MM/YYYY ส่งค่า YYYY-MM-DD ผ่าน hidden input ชื่อเดิม (ใช้แทน input type="date") */
export function DateInput({
  name,
  required,
  defaultValue,
  value,
  onChange,
  className,
}: {
  name: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (iso: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => formatDMY(value ?? defaultValue));
  const iso = parseDMY(text);
  const invalid = text !== "" && !iso;
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        placeholder="วว/ดด/ปปปป"
        value={text}
        required={required}
        pattern="\d{1,2}/\d{1,2}/\d{4}"
        title="กรอกวันที่แบบ วว/ดด/ปปปป เช่น 18/10/2026"
        aria-invalid={invalid}
        onChange={(e) => {
          const next = maskDMY(e.target.value);
          setText(next);
          const parsed = parseDMY(next);
          if (parsed) onChange?.(parsed);
        }}
        className={`${className ?? ""} ${invalid ? "border-red-400" : ""}`}
      />
      <input type="hidden" name={name} value={iso ?? ""} />
      {invalid && <span className="mt-1 block text-xs text-red-700">วันที่ไม่ถูกต้อง</span>}
    </>
  );
}
