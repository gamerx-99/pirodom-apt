/**
 * Mock data กลางสำหรับ demo mode (ไม่มี env / ยังไม่มีข้อมูลจริง)
 * ข้อมูลทั้งหมดติดป้าย "ข้อมูลตัวอย่าง" ใน UI — ห้ามใช้สรุปยอดจริง
 */

export type RoomStatus =
  | "vacant"
  | "reserved"
  | "occupied"
  | "moving_out"
  | "maintenance";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "verifying"
  | "pending_review"
  | "paid"
  | "overdue"
  | "void";

export type PaymentStatus =
  | "uploaded"
  | "slipok_passed"
  | "slipok_failed"
  | "mismatch"
  | "approved"
  | "rejected";

export type MaintenanceStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "waiting"
  | "done"
  | "closed";

export interface MockRoom {
  id: string;
  room_no: string;
  unit_type: "residential" | "commercial";
  floor: number | null;
  status: RoomStatus;
  tenant?: string;
}

export interface MockInvoice {
  id: string;
  room_no: string;
  tenant: string;
  period: string;
  issue_date: string;
  due_date: string;
  total: number;
  status: InvoiceStatus;
}

export interface MockPayment {
  id: string;
  room_no: string;
  tenant: string;
  invoice_id: string;
  amount: number;
  status: PaymentStatus;
  created_at: string;
}

export interface MockMaintenance {
  id: string;
  room_no: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  description: string;
  status: MaintenanceStatus;
  created_at: string;
}

export const MOCK_ROOMS: MockRoom[] = [
  { id: "r-101", room_no: "101", unit_type: "residential", floor: 1, status: "occupied", tenant: "คุณสมชาย" },
  { id: "r-102", room_no: "102", unit_type: "residential", floor: 1, status: "occupied", tenant: "คุณสมหญิง" },
  { id: "r-201", room_no: "201", unit_type: "residential", floor: 2, status: "vacant" },
  { id: "r-205", room_no: "205", unit_type: "residential", floor: 2, status: "occupied", tenant: "คุณมานะ" },
  { id: "r-shop", room_no: "ร้านค้า 1", unit_type: "commercial", floor: 1, status: "occupied", tenant: "ร้านค้าตัวอย่าง" },
];

export const MOCK_INVOICES: MockInvoice[] = [
  { id: "inv-1", room_no: "101", tenant: "คุณสมชาย", period: "ต.ค. 2569", issue_date: "25 ก.ย. 2569", due_date: "30 ก.ย. 2569", total: 3850, status: "paid" },
  { id: "inv-2", room_no: "102", tenant: "คุณสมหญิง", period: "ต.ค. 2569", issue_date: "25 ก.ย. 2569", due_date: "30 ก.ย. 2569", total: 3720, status: "issued" },
  { id: "inv-3", room_no: "205", tenant: "คุณมานะ", period: "ต.ค. 2569", issue_date: "5 ต.ค. 2569", due_date: "10 ต.ค. 2569", total: 4100, status: "overdue" },
  { id: "inv-4", room_no: "102", tenant: "คุณสมหญิง", period: "ก.ย. 2569", issue_date: "25 ส.ค. 2569", due_date: "31 ส.ค. 2569", total: 3680, status: "verifying" },
];

export const MOCK_PAYMENTS: MockPayment[] = [
  { id: "pay-1", room_no: "102", tenant: "คุณสมหญิง", invoice_id: "inv-4", amount: 3680, status: "uploaded", created_at: "15 ต.ค. 2569 20:10" },
  { id: "pay-2", room_no: "205", tenant: "คุณมานะ", invoice_id: "inv-3", amount: 4000, status: "mismatch", created_at: "14 ต.ค. 2569 09:30" },
];

export const MOCK_MAINTENANCE: MockMaintenance[] = [
  { id: "m-1", room_no: "101", category: "ไฟฟ้า", priority: "high", description: "ปลั๊กไฟห้องนอนไม่ติด", status: "pending", created_at: "16 ต.ค. 2569 08:00" },
  { id: "m-2", room_no: "205", category: "ประปา", priority: "normal", description: "ก๊อกน้ำซิงก์หยด", status: "in_progress", created_at: "14 ต.ค. 2569 18:20" },
  { id: "m-3", room_no: "102", category: "แอร์", priority: "urgent", description: "แอร์ไม่เย็น มีน้ำหยด", status: "accepted", created_at: "15 ต.ค. 2569 13:00" },
];

export const MOCK_METER_HISTORY = [
  { period: "ส.ค. 2569", prev: 150, curr: 230, units: 80 },
  { period: "ก.ย. 2569", prev: 230, curr: 305, units: 75 },
  { period: "ต.ค. 2569", prev: 305, curr: 392, units: 87 },
];

export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  vacant: "ว่าง",
  reserved: "จองแล้ว",
  occupied: "มีผู้เช่า",
  moving_out: "รอย้ายออก",
  maintenance: "ปรับปรุง",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "ร่าง",
  issued: "ออกบิลแล้ว",
  verifying: "รอตรวจสลิป",
  pending_review: "รอเจ้าหน้าที่ตรวจ",
  paid: "ชำระแล้ว",
  overdue: "เกินกำหนด",
  void: "ยกเลิก",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  uploaded: "รอตรวจ",
  slipok_passed: "ตรวจผ่าน",
  slipok_failed: "ตรวจไม่ผ่าน",
  mismatch: "ข้อมูลไม่ตรง",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธแล้ว",
};

export const MAINT_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  pending: "รอรับเรื่อง",
  accepted: "รับเรื่องแล้ว",
  in_progress: "กำลังดำเนินการ",
  waiting: "รออะไหล่/รอ",
  done: "ซ่อมเสร็จ รอผู้เช่ายืนยัน",
  closed: "ปิดงานแล้ว",
};
