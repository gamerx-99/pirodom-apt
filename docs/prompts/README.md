# Prompt ออกแบบรายหน้า — แอดมินและผู้เช่า 14 หน้า

ไฟล์นี้แก้ลิงก์เสีย `docs/prompts/README.md` ที่ README อ้างถึง (TODO ข้อ 0)

ต้นแบบภาพ/โค้ดอยู่ใน `ui/` (HTML + `screen.png` ต่อหน้า) ส่วน route เป้าหมายอยู่ใน `app/`

## แอดมิน 8 หน้า

| # | หน้า | Route | ต้นแบบใน `ui/` |
|---|---|---|---|
| 1 | Dashboard | `app/admin/page.tsx` | `ui/2_modern/`, `ui/mobile_view/`, `ui/dormitory_operations_core/` |
| 2 | ห้องพัก/ร้านค้า | `app/admin/rooms/page.tsx` | `ui/admin_rooms/` |
| 3 | สัญญา + เชิญผู้เช่า | `app/admin/leases/page.tsx` | `ui/admin_leases/` |
| 4 | จดมิเตอร์ | `app/admin/meters/page.tsx` | `ui/admin_meters/` |
| 5 | บิล | `app/admin/billing/page.tsx` | `ui/admin_billing/` |
| 6 | ตรวจชำระ | `app/admin/payments/page.tsx` | `ui/admin_payments/` |
| 7 | งานซ่อม | `app/admin/maintenance/page.tsx` | `ui/admin_maintenance/` |
| 8 | ตั้งค่า | `app/admin/settings/page.tsx` | `ui/admin_settings/` |

## ผู้เช่า (LIFF) 6 หน้า

| # | หน้า | Route | ต้นแบบใน `ui/` |
|---|---|---|---|
| 9 | Dashboard ผู้เช่า | `app/liff/page.tsx` | `ui/line_liff_dashboard/` |
| 10 | บิล + ส่งสลิป | `app/liff/bills/[id]/page.tsx` | `ui/line_liff_bill_payment/` |
| 11 | ประวัติมิเตอร์ | `app/liff/meters/page.tsx` | `ui/line_liff_meters/` |
| 12 | รับคำเชิญ/ผูกบัญชี | `app/liff/join/[token]/page.tsx` | `ui/line_liff_join/` |
| 13 | เอกสาร | `app/liff/documents/page.tsx` | `ui/siamese_modern_dormitory_operational_core/` |
| 14 | แจ้งซ่อม | `app/liff/maintenance/page.tsx` | `ui/dormitory_operations_core/` |

> หมายเหตุ: `ui/` เป็น mockup ประกอบการพัฒนา ไม่ใช่ข้อกำหนดสุดท้าย
> กติกาจริงดูที่ [Blueprint](../BLUEPRINT.md) และเกณฑ์จบเฟสดูที่ [Roadmap](../ROADMAP.md)
