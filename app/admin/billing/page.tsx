import { Badge, Card, DemoBanner, EmptyState } from "@/app/components/ui";
import { INVOICE_STATUS_LABEL, MOCK_INVOICES } from "@/lib/mock";
import { formatDateTH, formatTHB, invoiceStatusForDisplay, todayTH } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDraftForm, type DraftLeaseInput } from "./draft-form";
import { deleteInvoiceDraft, issueInvoiceDraft } from "./actions";

type Invoice = {
  id: string;
  period: string;
  issue_date: string | null;
  due_date: string;
  total: number;
  status: string;
  leases: {
    rooms: { room_no: string } | null;
    lease_tenants: { profiles: { display_name: string | null } | null }[];
  } | null;
  invoice_items?: { id: string; type: string; description: string | null; amount: number }[];
};

const toneFor = (status: string) =>
  status === "paid" ? "green" : status === "overdue" ? "red" : "amber";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">บิล</h1>
          <p className="text-sm text-gray-500">รายการบิลและสถานะการชำระ</p>
        </div>
        <DemoBanner text="รายการด้านล่างเป็นข้อมูลตัวอย่าง ไม่ใช่ยอดเรียกเก็บจริง" />
        <InvoiceTable invoices={MOCK_INVOICES.map((invoice) => ({
          ...invoice,
          period: invoice.period,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          total: invoice.total,
          status: invoice.status,
        }))} />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data, error }, { data: rawLeases, error: leaseError }, { data: rawReadings, error: readingError }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,period,issue_date,due_date,total,status,leases(rooms(room_no),lease_tenants(profiles(display_name))),invoice_items(id,type,description,amount)")
      .neq("status", "void")
      .order("due_date", { ascending: true }),
    supabase
      .from("leases")
      .select("id,room_id,start_date,end_date,rent_amount,water_fee,electric_rate,due_day,rooms(room_no),lease_tenants(profile_id)")
      .eq("status", "active")
      .order("start_date", { ascending: true }),
    supabase
      .from("meter_readings")
      .select("id,room_id,period,prev_value,curr_value,units")
      .order("period", { ascending: false })
      .limit(500),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">บิล</h1>
        <Card title="โหลดรายการบิลไม่สำเร็จ">
          <p className="text-sm text-red-700">กรุณาลองเปิดหน้านี้อีกครั้ง</p>
        </Card>
      </div>
    );
  }

  const invoices = (data ?? []) as unknown as Invoice[];
  const readingsByRoom = new Map<string, DraftLeaseInput["readings"]>();
  for (const reading of (rawReadings ?? []) as unknown as {
    id: string; room_id: string; period: string; prev_value: number; curr_value: number; units: number;
  }[]) {
    const current = readingsByRoom.get(reading.room_id) ?? [];
    current.push({ id: reading.id, period: reading.period, prev: Number(reading.prev_value), curr: Number(reading.curr_value), units: Number(reading.units) });
    readingsByRoom.set(reading.room_id, current);
  }
  const draftLeases = (rawLeases ?? []) as unknown as {
    id: string; room_id: string; start_date: string; end_date: string | null;
    rent_amount: number; water_fee: number; electric_rate: number; due_day: number;
    rooms: { room_no: string } | null; lease_tenants: { profile_id: string }[];
  }[];
  const canPrepareDrafts = !leaseError && !readingError;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">บิล</h1>
        <p className="text-sm text-gray-500">ตรวจสอบยอดและติดตามสถานะการชำระจากข้อมูลจริง</p>
      </div>
      <Card title="สร้างบิลร่าง" desc="เลือกงวดมิเตอร์และวันครบกำหนดให้ตรงกับสัญญา ระบบจะบันทึกรายการยอดไว้ให้ตรวจทานก่อนออกบิล">
        <p className="mb-3 text-sm text-amber-800">ระบบยังไม่ตั้งรอบร้านค้าแทนผู้ดูแล และไม่เฉลี่ยค่าเช่าเดือนแรกหรือเดือนสุดท้ายโดยอัตโนมัติ</p>
        {!canPrepareDrafts ? (
          <p className="text-sm text-red-700">โหลดข้อมูลสัญญาหรือมิเตอร์ไม่สำเร็จ กรุณาเปิดหน้านี้อีกครั้ง</p>
        ) : draftLeases.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีสัญญาที่ใช้งานอยู่</p>
        ) : (
          <div className="space-y-2">
            {draftLeases.map((lease) => (
              <InvoiceDraftForm
                key={lease.id}
                defaultMonth={todayTH().slice(0, 7)}
                lease={{
                  id: lease.id,
                  room_no: lease.rooms?.room_no ?? "?",
                  start_date: lease.start_date,
                  end_date: lease.end_date,
                  rent_amount: Number(lease.rent_amount),
                  water_fee: Number(lease.water_fee),
                  electric_rate: Number(lease.electric_rate),
                  due_day: Number(lease.due_day),
                  tenant_count: lease.lease_tenants?.length ?? 0,
                  readings: readingsByRoom.get(lease.room_id) ?? [],
                }}
              />
            ))}
          </div>
        )}
      </Card>
      {invoices.length === 0 ? (
        <EmptyState title="ยังไม่มีบิล" desc="รายการบิลจะแสดงที่นี่เมื่อมีการออกบิลจากระบบ" />
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
      <p className="text-xs text-gray-400">บิลที่ออกแล้วจะขึ้น “ค้างค่าชำระ” หลังพ้นวันครบกำหนด และยังไม่ได้บันทึกว่าชำระแล้ว</p>
    </div>
  );
}

function InvoiceTable({ invoices }: { invoices: (Invoice | (typeof MOCK_INVOICES)[number])[] }) {
  const today = todayTH();
  return (
    <Card title={`บิลทั้งหมด ${invoices.length}`} desc="เรียงตามวันครบกำหนด">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-3">ห้อง</th>
              <th className="py-2 pr-3">ผู้เช่า</th>
              <th className="py-2 pr-3">งวด</th>
              <th className="py-2 pr-3">ครบกำหนด</th>
              <th className="py-2 pr-3 text-right">ยอด</th>
              <th className="py-2 pr-3">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const row = invoice as Invoice & { room_no?: string; tenant?: string };
              const status = invoiceStatusForDisplay(invoice.status, invoice.due_date, today);
              const roomNo = row.room_no ?? row.leases?.rooms?.room_no ?? "—";
              const tenant = row.tenant ?? row.leases?.lease_tenants
                ?.map((tenantRow) => tenantRow.profiles?.display_name)
                .filter(Boolean)
                .join(", ") ?? "—";
              return (
                <tr key={invoice.id} className="border-t border-gray-100">
                  <td className="py-2 pr-3 font-medium">{roomNo}</td>
                  <td className="py-2 pr-3">{tenant}</td>
                  <td className="py-2 pr-3">{invoice.period.slice(0, 7)}</td>
                  <td className="py-2 pr-3">{formatDateTH(invoice.due_date)}</td>
                  <td className="py-2 pr-3 text-right">{formatTHB(Number(invoice.total))}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={toneFor(status)}>
                      {INVOICE_STATUS_LABEL[status as keyof typeof INVOICE_STATUS_LABEL] ?? status}
                    </Badge>
                    {invoice.status === "draft" && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-teal-700">ตรวจรายการและออกบิล</summary>
                        <ul className="mt-2 space-y-1 text-xs text-gray-600">
                          {(invoice as Invoice).invoice_items?.map((item) => (
                            <li key={item.id} className="flex justify-between gap-2">
                              <span>{item.description || item.type}</span><span>{formatTHB(Number(item.amount))}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <form action={issueInvoiceDraft}>
                            <input type="hidden" name="invoice_id" value={invoice.id} />
                            <button className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800">
                              ออกบิลหลังตรวจรายการ
                            </button>
                          </form>
                          <form action={deleteInvoiceDraft}>
                            <input type="hidden" name="invoice_id" value={invoice.id} />
                            <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50">
                              ลบร่างเพื่อสร้างใหม่
                            </button>
                          </form>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
