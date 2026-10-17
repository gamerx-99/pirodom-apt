"use server";

import { revalidatePath } from "next/cache";
import { audit, requireStaff, toNumberOrNull } from "@/lib/phase1";
import { todayTH } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type BillingResult = { ok: boolean; message?: string; error?: string };

type Lease = {
  id: string;
  room_id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  water_fee: number;
  electric_rate: number;
  status: string;
  room: { room_no: string } | null;
};

type Meter = {
  id: string;
  room_id: string;
  period: string;
  prev_value: number;
  curr_value: number;
  units: number;
};

const fail = (error: string): BillingResult => ({ ok: false, error });
const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function monthBounds(month: string): { period: string; end: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNo] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, monthNo, 0)).toISOString().slice(0, 10);
  return { period: `${month}-01`, end };
}

/** Save a reviewable draft using contract rates and the meter row selected by staff. */
export async function createInvoiceDraft(
  _previous: BillingResult | null,
  form: FormData,
): Promise<BillingResult> {
  try {
    const sessionClient = await createClient();
    const { userId } = await requireStaff(sessionClient);
    const leaseId = String(form.get("lease_id") ?? "").trim();
    const month = String(form.get("period") ?? "").trim();
    const dueDate = String(form.get("due_date") ?? "").trim();
    const meterId = String(form.get("meter_reading_id") ?? "").trim();
    const extraRaw = String(form.get("extra_amount") ?? "").trim();
    const extraParsed = extraRaw === "" ? 0 : toNumberOrNull(extraRaw);
    const extra = extraParsed ?? 0;
    const extraDescription = String(form.get("extra_description") ?? "").trim().slice(0, 160);
    const discountRaw = String(form.get("discount_amount") ?? "").trim();
    const discountParsed = discountRaw === "" ? 0 : toNumberOrNull(discountRaw);
    const discount = discountParsed ?? 0;
    const discountDescription = String(form.get("discount_description") ?? "").trim().slice(0, 160);
    const bounds = monthBounds(month);

    if (!leaseId || !meterId) return fail("กรุณาเลือกสัญญาและงวดมิเตอร์");
    if (!bounds) return fail("เลือกรอบเดือนให้ถูกต้อง");
    if (!validDate(dueDate)) return fail("กรอกวันครบกำหนดให้ถูกต้อง");
    if (extraParsed === null || discountParsed === null) return fail("รายการเพิ่มและส่วนลดต้องเป็นตัวเลข");
    if (extra < 0 || discount < 0) return fail("รายการเพิ่มและส่วนลดต้องเป็นจำนวนตั้งแต่ 0 บาทขึ้นไป");
    if (extra > 0 && !extraDescription) return fail("กรุณาระบุเหตุผลของรายการเพิ่ม");
    if (discount > 0 && !discountDescription) return fail("กรุณาระบุเหตุผลของส่วนลด");

    const admin = createAdminClient();
    const { data: rawLease, error: leaseError } = await admin
      .from("leases")
      .select("id,room_id,start_date,end_date,rent_amount,water_fee,electric_rate,status,rooms(room_no),lease_tenants(profile_id)")
      .eq("id", leaseId)
      .maybeSingle();
    if (leaseError || !rawLease) return fail("ไม่พบสัญญาที่เลือก");
    const lease = rawLease as unknown as Lease & { lease_tenants: { profile_id: string }[] };
    if (lease.status !== "active" || lease.lease_tenants.length === 0) {
      return fail("ออกบิลร่างได้เฉพาะสัญญาที่ใช้งานและมีผู้เช่าผูกอยู่");
    }
    if (lease.start_date > bounds.period || (lease.end_date && lease.end_date < bounds.end)) {
      return fail("งวดนี้ไม่ครอบคลุมเต็มเดือนตามสัญญา: ระบบยังไม่คำนวณเดือนแรกหรือเดือนสุดท้ายแทนผู้ดูแล");
    }

    const { data: existing, error: existingError } = await admin
      .from("invoices")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("period", bounds.period)
      .maybeSingle();
    if (existingError) return fail("ตรวจบิลซ้ำไม่สำเร็จ");
    if (existing) return fail("สัญญานี้มีบิลของงวดดังกล่าวแล้ว");

    const { data: rawMeter, error: meterError } = await admin
      .from("meter_readings")
      .select("id,room_id,period,prev_value,curr_value,units")
      .eq("id", meterId)
      .eq("room_id", lease.room_id)
      .maybeSingle();
    if (meterError || !rawMeter) return fail("ไม่พบข้อมูลมิเตอร์ของห้องตามที่เลือก");
    const meter = rawMeter as unknown as Meter;
    const rent = roundMoney(Number(lease.rent_amount));
    const water = roundMoney(Number(lease.water_fee));
    const units = Number(meter.units);
    const rate = roundMoney(Number(lease.electric_rate));
    const electric = roundMoney(units * rate);
    const total = roundMoney(rent + water + electric + extra - discount);
    if (![rent, water, units, rate, electric, total].every(Number.isFinite) || total < 0) {
      return fail("ยอดรวมไม่ถูกต้อง: ตรวจสอบอัตราและรายการในสัญญาก่อน");
    }
    if (rent < 0 || water < 0 || rate < 0) return fail("อัตราค่าเช่า ค่าน้ำ และค่าไฟในสัญญาต้องไม่ติดลบ");

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        lease_id: lease.id,
        period: bounds.period,
        issue_date: todayTH(),
        due_date: dueDate,
        total,
        status: "draft",
      })
      .select("id")
      .single();
    if (invoiceError) {
      return fail(invoiceError.code === "23505" ? "สัญญานี้มีบิลของงวดดังกล่าวแล้ว" : "สร้างบิลร่างไม่สำเร็จ");
    }

    const items = [
      { invoice_id: invoice.id, type: "rent", description: "ค่าเช่าตามสัญญา", qty: 1, unit_price: rent, amount: rent },
      { invoice_id: invoice.id, type: "water", description: "ค่าน้ำเหมาจ่ายตามสัญญา", qty: 1, unit_price: water, amount: water },
      {
        invoice_id: invoice.id,
        type: "electric",
        description: `ค่าไฟ ${units} หน่วย · มิเตอร์งวด ${meter.period} (${meter.prev_value} → ${meter.curr_value})`,
        qty: units,
        unit_price: rate,
        amount: electric,
        meter_reading_id: meter.id,
      },
      ...(extra > 0 ? [{ invoice_id: invoice.id, type: "extra", description: extraDescription, qty: 1, unit_price: extra, amount: extra }] : []),
      ...(discount > 0 ? [{ invoice_id: invoice.id, type: "discount", description: discountDescription, qty: 1, unit_price: discount, amount: -discount }] : []),
    ];
    const { error: itemError } = await admin.from("invoice_items").insert(items);
    if (itemError) {
      await admin.from("invoices").delete().eq("id", invoice.id).eq("status", "draft");
      return fail("บันทึกรายการบิลไม่สำเร็จ จึงยกเลิกร่างที่สร้างไม่ครบแล้ว");
    }

    const { error: totalError } = await admin
      .from("invoices")
      .update({ total })
      .eq("id", invoice.id)
      .eq("status", "draft");
    if (totalError) {
      await admin.from("invoices").delete().eq("id", invoice.id).eq("status", "draft");
      return fail("สรุปยอดบิลไม่สำเร็จ จึงยกเลิกร่างที่สร้างไม่ครบแล้ว");
    }

    await audit(admin, {
      actor_id: userId,
      action: "invoice.draft.create",
      table_name: "invoices",
      record_id: invoice.id,
      after: { lease_id: lease.id, room_no: lease.room?.room_no, period: bounds.period, due_date: dueDate, total, meter_reading_id: meter.id },
    });
    revalidatePath("/admin/billing");
    revalidatePath("/liff");
    return { ok: true, message: `สร้างบิลร่างห้อง ${lease.room?.room_no ?? ""} แล้ว ตรวจยอดก่อนออกบิล` };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "สร้างบิลร่างไม่สำเร็จ");
  }
}

export async function issueInvoiceDraft(form: FormData): Promise<void> {
  const sessionClient = await createClient();
  const { userId } = await requireStaff(sessionClient);
  const invoiceId = String(form.get("invoice_id") ?? "").trim();
  if (!invoiceId) throw new Error("ไม่พบรหัสบิล");

  const admin = createAdminClient();
  const { data: invoice, error: readError } = await admin
    .from("invoices")
    .select("id,lease_id,period,due_date,total,status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (readError || !invoice) throw new Error("ไม่พบบิลนี้");
  if (invoice.status !== "draft") throw new Error("ออกบิลได้เฉพาะรายการร่าง");
  const { data: items, error: itemError } = await admin
    .from("invoice_items")
    .select("amount")
    .eq("invoice_id", invoiceId);
  if (itemError || !items?.length) throw new Error("บิลนี้ไม่มีรายการคิดเงิน");
  const sum = roundMoney(items.reduce((value, item) => value + Number(item.amount), 0));
  if (sum !== Number(invoice.total)) throw new Error("ยอดรวมไม่ตรงกับรายการในบิล: กรุณาสร้างร่างใหม่");

  const { data: updated, error } = await admin
    .from("invoices")
    .update({ status: "issued" })
    .eq("id", invoiceId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error || !updated) throw new Error("ออกบิลไม่สำเร็จ: รายการอาจถูกเปลี่ยนจากอีกหน้าต่างแล้ว");

  await audit(admin, {
    actor_id: userId,
    action: "invoice.issue",
    table_name: "invoices",
    record_id: invoiceId,
    before: { status: "draft" },
    after: { status: "issued", lease_id: invoice.lease_id, period: invoice.period, due_date: invoice.due_date, total: invoice.total },
  });
  revalidatePath("/admin/billing");
  revalidatePath("/liff");
}
