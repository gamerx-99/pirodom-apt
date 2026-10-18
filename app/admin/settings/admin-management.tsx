"use client";

import { useActionState, useState } from "react";
import { Badge, Card } from "@/app/components/ui";
import { formatDateTH } from "@/lib/format";
import { createAdmin, removeAdmin } from "./actions";

export type StaffMember = {
  id: string;
  display_name: string | null;
  line_user_id: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

export type CandidateUser = {
  id: string;
  display_name: string | null;
  line_user_id: string | null;
  phone: string | null;
};

export function AdminManagement({
  staffList,
  candidateUsers = [],
  currentUserId,
  currentUserRole,
  demo = false,
}: {
  staffList: StaffMember[];
  candidateUsers?: CandidateUser[];
  currentUserId?: string;
  currentUserRole?: string;
  demo?: boolean;
}) {
  const [createState, createAction, createPending] = useActionState(createAdmin, null);
  const [removeState, removeAction, removePending] = useActionState(removeAdmin, null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [lineUserId, setLineUserId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  const inputStyle =
    "mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

  function handleSelectCandidate(userId: string) {
    setSelectedCandidate(userId);
    const found = candidateUsers.find((c) => c.id === userId);
    if (found) {
      setLineUserId(found.line_user_id ?? "");
      setDisplayName(found.display_name ?? "");
      setPhone(found.phone ?? "");
    }
  }

  return (
    <Card
      title="ผู้ดูแลระบบ (Admin & Staff)"
      desc="จัดการสิทธิ์เข้าใช้งานระบบจัดการหอพักด้วยบัญชี LINE"
      action={
        !demo && (
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {isFormOpen ? "ปิดฟอร์ม" : "+ เพิ่มผู้ดูแลด้วย LINE"}
          </button>
        )
      }
    >
      <div className="space-y-4">
        {demo && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            โหมดตัวอย่าง: ข้อมูลผู้ดูแลจำลองขึ้นเพื่อแสดงผล การเพิ่มหรือลบแอดมินจริงจะพร้อมใช้งานเมื่อเชื่อมต่อ Supabase
          </p>
        )}

        {/* ข้อความแจ้งเตือนผลลัพธ์ */}
        {createState && !createState.ok && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {createState.error}
          </p>
        )}
        {createState?.ok && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {createState.message}
          </p>
        )}
        {removeState && !removeState.ok && (
          <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {removeState.error}
          </p>
        )}
        {removeState?.ok && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
            {removeState.message}
          </p>
        )}

        {/* ฟอร์มเพิ่มผู้ดูแลระบบด้วย LINE */}
        {isFormOpen && !demo && (
          <form
            action={createAction}
            className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:p-5"
          >
            <h3 className="text-sm font-bold text-slate-900">แต่งตั้งผู้ดูแลระบบด้วย LINE</h3>
            <p className="text-xs text-slate-500">
              ผู้ที่ได้รับการแต่งตั้งจะสามารถเข้าสู่ระบบหลังบ้านด้วยบัญชี LINE ของตนเองได้ทันที
            </p>

            {/* ตัวเลือกแบบด่วน: เลือกจากผู้ใช้ LINE ที่เคยล็อกอินแล้ว */}
            {candidateUsers.length > 0 && (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-700">
                  เลือกจากผู้ใช้ LINE ในระบบ (ทางเลือก):
                  <select
                    value={selectedCandidate}
                    onChange={(e) => handleSelectCandidate(e.target.value)}
                    className={`${inputStyle} bg-white`}
                  >
                    <option value="">-- พิมพ์ LINE User ID เอง หรือเลือกจากรายชื่อนี้ --</option>
                    {candidateUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name ?? "ไม่ระบุชื่อ"} (LINE: {u.line_user_id?.slice(0, 8)}…)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                LINE User ID (ขึ้นต้นด้วย U ความยาว 33 ตัวอักษร) <span className="text-rose-500">*</span>
                <input
                  name="line_user_id"
                  type="text"
                  required
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  placeholder="เช่น U0123456789abcdef0123456789abcdef"
                  className={`${inputStyle} font-mono`}
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                ชื่อ-นามสกุล / ชื่อผู้ดูแล <span className="text-rose-500">*</span>
                <input
                  name="display_name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="เช่น ผู้จัดการ สมชาย"
                  className={inputStyle}
                />
              </label>

              <label className="text-xs font-medium text-slate-700">
                เบอร์โทรศัพท์ (ถ้ามี)
                <input
                  name="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08XXXXXXXX"
                  className={inputStyle}
                />
              </label>

              <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                บทบาท (Role)
                <select
                  name="role"
                  defaultValue="admin"
                  className={`${inputStyle} bg-white`}
                >
                  <option value="admin">แอดมิน (Admin - จัดการบิล สัญญา มิเตอร์ ห้องพัก)</option>
                  {currentUserRole === "owner" && (
                    <option value="owner">เจ้าของหอพัก (Owner - สิทธิ์เต็มทุกระบบ)</option>
                  )}
                </select>
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setLineUserId("");
                  setDisplayName("");
                  setPhone("");
                  setSelectedCandidate("");
                }}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={createPending}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createPending ? "กำลังบันทึก…" : "บันทึกและแต่งตั้งแอดมิน"}
              </button>
            </div>
          </form>
        )}

        {/* ตารางรายชื่อผู้ดูแล */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-medium text-slate-400">
              <tr>
                <th className="pb-2">ชื่อผู้ดูแล</th>
                <th className="pb-2">LINE User ID</th>
                <th className="pb-2">บทบาท</th>
                <th className="pb-2">เบอร์ติดต่อ</th>
                <th className="pb-2">วันที่แต่งตั้ง</th>
                {!demo && <th className="pb-2 text-right">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {staffList.map((member) => {
                const isSelf = member.id === currentUserId;
                const isOwner = member.role === "owner";
                const canRemove = !demo && !isSelf && (currentUserRole === "owner" || !isOwner);

                return (
                  <tr key={member.id} className="text-slate-800">
                    <td className="py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                          {(member.display_name ?? "U").charAt(0).toUpperCase()}
                        </span>
                        <span>{member.display_name ?? "ไม่ระบุชื่อ"}</span>
                        {isSelf && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            คุณ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-500">
                      {member.line_user_id ? (
                        <span>{member.line_user_id}</span>
                      ) : (
                        <span className="text-slate-400">ยังไม่ผูก LINE</span>
                      )}
                    </td>
                    <td className="py-3">
                      <Badge tone={isOwner ? "blue" : "green"}>
                        {isOwner ? "เจ้าของหอพัก" : "แอดมิน"}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-500">{member.phone ?? "-"}</td>
                    <td className="py-3 text-xs text-slate-400">
                      {member.created_at ? formatDateTH(member.created_at) : "-"}
                    </td>
                    {!demo && (
                      <td className="py-3 text-right">
                        {canRemove ? (
                          <form
                            action={removeAction}
                            onSubmit={(e) => {
                              if (!confirm(`ต้องการถอดสิทธิ์ผู้ดูแล "${member.display_name ?? member.line_user_id}" หรือไม่?`)) {
                                e.preventDefault();
                              }
                            }}
                            className="inline-block"
                          >
                            <input type="hidden" name="target_id" value={member.id} />
                            <button
                              type="submit"
                              disabled={removePending}
                              className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              ถอดสิทธิ์
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
