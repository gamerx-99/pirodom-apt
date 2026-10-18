# Todo — ระบบจัดการหอพักผ่าน LINE

ปรับปรุง 18 ตุลาคม 2569 (2026-10-18) · ฐานตรวจ: commit `1006034` และ working tree ล่าสุด (Anti-Slop 46/46 + UI Room Management + Production Env Refresh + LINE 3-Tier Auth & Admin Management by LINE ID)

อ่านคู่กับ [Roadmap](ROADMAP.md) (เกณฑ์จบเฟส) และ [Blueprint](BLUEPRINT.md) (โครงสร้างระบบ)

**วิธีใช้:** ติ๊ก checkbox เมื่องานผ่านเกณฑ์และมีหลักฐาน — ไม่นับจากจำนวนไฟล์หรือหน้าที่สร้าง
สถานะกำกับท้ายรายการ: `ยังไม่เริ่ม` (เริ่มได้ทันที) · `เจ้าของกรอกเอง` (ไม่บล็อก ลูกค้าใส่หลังส่งมอบ) · `รอตรวจ` (โค้ดเสร็จ รอทดสอบ/ตรวจจริง)

 **ผลตรวจรอบล่าสุด 18/10/2569:** `npm test` ผ่าน 100% (PGlite + ชุด Phase 1 + Rooms FK + PromptPay CRC + Notifications) · `npx tsc --noEmit` ผ่าน (0 errors) · `npm run lint` ผ่าน (0 errors, 0 warnings) · Live Cloud migrations 15 ไฟล์ apply แล้ว (รวม `20261018000009_atomic_admin_demotion.sql`) · Production env บน Vercel refreshed และ webhook test 200 ok


---

## 0. งานด่วน: จัดการ working tree ก่อนพัฒนาต่อ

 - [x] **Commit งานค้าง** — ทำแล้ว 17/10/2569: commit 3 ชุด (`fc3f957` docs, `7251dd0` phase0 core, `896ebb2` UI demo) — working tree สะอาด
 - [x] **เรื่อง `docs/brief.pdf`** — 17/10/2569: ผู้ใช้ลบเองโดยตั้งใจ เพราะใช้ BLUEPRINT.md และ ROADMAP.md แทนแล้ว
 - [x] **ลิงก์เสียใน README** — ทำแล้ว 17/10/2569: สร้าง `docs/prompts/README.md` (ดัชนี 14 หน้า → `ui/` + route)
 - [x] **เพิ่ม `tmp/` ใน `.gitignore`** — ทำแล้ว 17/10/2569: เพิ่ม `tmp/` แล้ว (`tmp/` มีแค่โฟลเดอร์เปล่า `pdfs/` ไม่มีไฟล์ขยะ)

## 1. ข้อมูลจากบรีฟ — สถานะ: ไม่มีข้อบล็อก (ปรับ 18/10/2569)

หลัก: ทำตามบรีฟ; จุดที่บรีฟไม่ระบุทำเป็นค่าที่เจ้าของตั้งเอง ไม่ตั้งคำถามกลับ ส่งมอบระบบคลีนแล้วลูกค้ากรอกข้อมูลเอง

- [x] **Q-01** ผู้ให้บริการตรวจสลิป — ผู้ใช้ยืนยันว่า Okslip ในบรีฟหมายถึง SlipOK (D-031); ยังต้องใช้ข้อมูลบัญชีและตั้งค่า Q-06 ก่อนตรวจสลิปจริง
- [x] **Q-02** ยูนิต ราคา ผู้เช่า สัญญาจริง — เจ้าของกรอกเองที่ `/admin/rooms` และ `/admin/leases` หลังส่งมอบ
- [x] **Q-03** รอบบิล — ผู้ใช้ตัดสิน 18/10/2569: ไม่ fix รอบกลาง ตั้งวันครบกำหนดรายห้อง/รายสัญญา (`rooms.due_day` → `leases.due_day`) บิลขึ้นแล้วจ่ายก็จบ
- [x] **Q-04** วันจดมิเตอร์ — ผู้ใช้ตัดสิน 18/10/2569: ไม่ fix วันจด จดวันไหนก็ได้ แล้วเลือกแถวมิเตอร์ต่อบิล (มีอยู่แล้ว)
- [x] **Q-05** ค่าปรับ/ส่วนลด/ยอดชำระ — ผู้ใช้ตัดสิน 18/10/2569: รับชำระเฉพาะเต็มยอดบิล (ไม่รับบางส่วน/เกิน ตรงกับ DB ปัจจุบัน); ค่าปรับ/ส่วนลดใส่เป็นรายการเพิ่ม/ส่วนลดในบิลร่างพร้อมเหตุผล
- [x] **Q-06** บัญชีรับเงิน/PromptPay, SlipOK, LINE — เจ้าของกรอกเองที่ `/admin/settings` (commit `2a7a78f`); บน production ตั้งค่าครบ สถานะ "พร้อม" ทั้ง 3 (UAT 18/10/2569)
- [x] **Q-07** เอกสารสัญญา — เจ้าของอัปโหลดเองที่ `/admin/documents`
- [x] **Q-08** เจ้าของบัญชี Cloud — ตกลงกันตอนส่งมอบระหว่างผู้พัฒนากับลูกค้า ไม่บล็อกงานพัฒนา (ปัจจุบันใช้บัญชีผู้พัฒนา)

> ไม่ฝังค่าถาวรที่บรีฟไม่ได้ระบุ: ทำเป็นค่าตั้งค่ารายห้อง/รายบิล/หน้าตั้งค่าแทน

---

## Phase 0: ตัวตนและสภาพแวดล้อม — สถานะ: กำลังทำ (โค้ดเกือบครบ รอทดสอบจริง)

**ทำแล้ว (มีหลักฐานในโค้ด):**
- [x] โครง Next.js 16 + React 19 + Supabase SSR + LIFF SDK + ตัวช่วย env guard — [`lib/env.ts`](../lib/env.ts)
- [x] Migration + RLS + column grants + Storage policies — [`supabase/migrations/`](../supabase/migrations/)
- [x] ทดสอบ RLS บน PGlite ผ่าน — `npm test` (17/10/2569)
- [x] โค้ด LINE Login bridge: ตรวจ ID token ฝั่ง Server → ผูก profile → ตั้ง Supabase session — [`app/api/auth/line/route.ts`](../app/api/auth/line/route.ts), [`lib/line-auth.ts`](../lib/line-auth.ts)
- [x] Admin guard ฝั่ง server: ไม่มี session → redirect /liff, role ไม่ใช่ owner/admin → 403 — [`app/admin/layout.tsx`](../app/admin/layout.tsx) (โหมดเดโมเมื่อไม่มี env)
- [x] ระบบคัดกรองสิทธิ์ 3 ระดับ (3-Tier Auth Routing): 1) Admin/Owner → `/admin` ทันที 2) ผู้เช่ามีสัญญา active → `/liff` แสดงห้องพัก บิล มิเตอร์ เอกสาร แจ้งซ่อม 3) ผู้ใช้อื่นๆ หรือยังไม่ผูกห้อง → แสดงการ์ด "ไม่สามารถตรวจสอบห้องพักของคุณได้กรุณาติดต่อ 053-276631" พร้อมปุ่มโทรออกและสลับบัญชี — [`app/liff/page.tsx`](../app/liff/page.tsx), [`app/liff/layout.tsx`](../app/liff/layout.tsx)
- [x] จัดการผู้ดูแลระบบด้วย LINE User ID ในหน้า Settings (`/admin/settings`): แสดงตารางผู้ดูแลพร้อม LINE ID, ฟอร์มแต่งตั้งด้วย LINE User ID (Regex `U...` 33 หลัก) หรือเลือกเลื่อนขั้นจากรายชื่อผู้ใช้ LINE ในระบบ, ป้องกันการถอดสิทธิ์ Owner คนสุดท้าย, ตัดระบบ email/password ออกทั้งหมด — [`app/admin/settings/`](../app/admin/settings)
- [x] ระบบออกจากระบบและสลับบัญชี LINE: เคลียร์ Supabase session ทางเซิร์ฟเวอร์ และดักจับ query `?logout=true` เพื่อสั่ง `liff.logout()` บน Client ล้าง token LINE ออกจากเบราว์เซอร์จริง — [`app/api/auth/logout/route.ts`](../app/api/auth/logout/route.ts), [`app/liff/layout.tsx`](../app/liff/layout.tsx)
- [x] แก้ไข LINE OAuth 400 Bad Request: ปรับปรุง redirectUri ให้เป็น clean path `/liff` และเก็บ redirect target ใน sessionStorage ป้องกัน query string ขัดกับ Endpoint URL ที่ลงทะเบียนไว้

**เหลือต้องทำ (เกณฑ์จบเฟสยังไม่ผ่าน):**
- [ ] กรอก LIFF ID + Channel ID จริง และทดสอบ login ด้วย token จริงบนอุปกรณ์ — `รอตรวจ`
- [ ] ทดสอบ Admin guard กับ Supabase env จริง: role ทุกแบบ + ออกจากระบบ + session หมดอายุ — `รอตรวจ`
- [ ] ตรวจ migration/RLS/GRANT/Storage บนฐานข้อมูล Supabase ทดสอบจริง (PGlite ยังจำลอง Auth/Storage) — `รอตรวจ`
  - 17/10/2569 ผู้ใช้อนุมัติและลง migration ครบ 6 ไฟล์บน `jxvlexoqwqynctlpgafi` แล้ว: 16 ตารางเปิด RLS, 4 private buckets, 10 Storage policies; live SQL role/claim tests ผ่าน 30 assertions และ rollback fixtures หมด; RPC grants ตรวจผ่าน — ยังเหลือ authenticated HTTP/Storage upload/signed URL และ advisor WARN 8 รายการ ดู [หลักฐานล่าสุด](SUPABASE-PHASE0-AUDIT.md)
  - 17/10/2569 ผู้ใช้อนุมัติและ apply migrations ที่ค้าง 7 ไฟล์บน Cloud แล้ว: `20261017132926_accept_invite_code_once` และ `20261018000002`–`20261018000007`; ใช้ `supabase db push --linked --include-all --skip-vault --yes` เพราะ invite-code migration มี timestamp ก่อน `20261018000000`/`000001` ที่ลงไปแล้ว; migration ledger และ RPC/trigger smoke query ผ่าน
- [x] ยืนยันวิธีเข้าใช้ของเจ้าของ/แอดมิน: ผู้ใช้ยืนยันบัญชี LINE “C - Game” คือบัญชี lannatc แล้ว; ตั้ง owner พร้อม audit และผู้ใช้ส่งภาพเข้า Admin ได้จริง (17/10/2569)
- [x] รีเฟรช Production env บน Vercel ครบ 10 ตัวแปรแอป (รวม `LINE_CHANNEL_SECRET`, `NEXT_PUBLIC_APP_URL`) และตั้ง Secret สำหรับคีย์ลับ; deployment บน `pirodom-apt.vercel.app` สถานะ READY; signed webhook ตรวจสอบผ่าน HTTP 200 ok (17/10/2569 ดู [หลักฐาน](PRODUCTION-ENV-REFRESH.md))
- [ ] แยก env ทดสอบ/จริง และ secret management — `ยังไม่เริ่ม`
- [x] เผยแพร่บน Vercel หลัง independent review — production deployment จาก `8dece5e` เป็น READY (17/10/2569)
- [ ] จัดขั้นตอนติดตาม error และซ้อม rollback — ยังไม่ทำ
- [x] หน้า `/admin` อ่านภาพรวมห้อง บิล คิวสลิป และงานซ่อมจากฐานข้อมูลเมื่อเชื่อม Supabase; โหมดไม่มี DB แสดงป้ายข้อมูลตัวอย่าง — ตรวจ local typecheck/lint/test/build ผ่าน, **ยังไม่ deploy การแก้ล่าสุด**

**เกณฑ์จบ:** ผู้เช่า login ได้ตัวตนที่ RLS ใช้ได้จริง, ผู้ไม่มีสิทธิ์เข้า Admin/เรียก API สำคัญไม่ได้, มีหลักฐานจากสภาพแวดล้อมทดสอบจริง (ไม่ใช่แค่ build ผ่าน)

## Phase 1: ห้อง สัญญา ผูกผู้เช่า — สถานะ: ผ่านเกณฑ์จบเฟสแล้ว (CLOSED 17/10/2569)

ปิดเฟส 1 เมื่อ 17/10/2569 (commit `378e902`) อิงหลักฐานผู้เช่าจริงรายงานการยอมรับ (เพื่อนใช้ LINE บัญชีจริงแยกจากเจ้าของ รับคำเชิญสำเร็จ เห็นห้อง 101/สัญญา และคำเชิญขึ้น "ใช้แล้ว") ผนวกกับการทดสอบสิทธิ์ Live SQL / RLS บน Supabase Cloud ครบ 30 assertions ดูรายละเอียดใน [บันทึกการปิดเฟส 1](PHASE1-VERIFICATION.md)

- [x] Server operations + UI CRUD ห้อง (residential/commercial) — แทน mock ใน [`app/admin/rooms`](../app/admin/rooms/page.tsx)
- [x] เพิ่มระบบแก้ไขและลบห้องพัก (Room Edit & Delete) สำหรับเจ้าของ/แอดมิน: ตรวจสิทธิ์ server-side, พิมพ์เลขห้องเพื่อยืนยันการลบ, ตรวจสอบ Foreign Keys ป้องกันการลบห้องที่มีประวัติสัญญา/มิเตอร์/งานซ่อม พร้อมชุดทดสอบรีเกรสชันใน `npm test` (17/10/2569 ดู [เอกสาร UI-ROOMS-FIX](UI-ROOMS-FIX.md))
- [x] CRUD สัญญา + ผู้เช่าร่วม/ผู้เช่าหลัก + ย้ายออก/ถอนสิทธิ์ — [`app/admin/leases/`](../app/admin/leases/page.tsx) (ค่าเงินกรอกตามจริง ไม่ hardcode)
- [x] เปลี่ยนลิงก์เป็นรหัสสุ่ม 12 ตัว: แสดงครั้งเดียว, เก็บเฉพาะ hash, อายุ 7 วัน — โค้ด commit `b258580`; RPC ลง Cloud แล้ว
- [x] LINE Bot รับรหัสในข้อความส่วนตัว, ใช้ LINE user ID จาก signed webhook, ผูกผ่าน `accept_invite_code` แบบ transaction — โค้ดและ migration ลง Cloud แล้ว
- [x] ทดสอบ flow จริง: แอดมินออกรหัส/คำเชิญ → ผู้เช่าเปิดรับคำเชิญ → บัญชีถูกผูก → เข้า LIFF เห็นเฉพาะสัญญาตนเอง — ผ่านการตรวจรับจริง (ผู้ใช้ยืนยันเพื่อนใช้ LINE บัญชีจริงเข้าห้อง 101 เห็นสัญญาและคำเชิญขึ้นใช้แล้ว ดู [PHASE1-VERIFICATION.md](PHASE1-VERIFICATION.md))
- [x] ยืนยัน LINE Login/LIFF และ Messaging API channels อยู่ใน LINE Developers Provider เดียวกัน — ผู้ใช้ยืนยัน 17/10/2569
- [x] ปิด API รับลิงก์เก่า (410) และหน้า `/liff/join/[token]` แจ้งวิธีขอรหัสใหม่
- [x] ปิดสัญญา / ยกเลิกคำเชิญ / ถอนสิทธิ์เมื่อย้ายออก — `endLease` เพิกถอนคำเชิญค้าง + คืนห้องว่าง; migration `revoked_at` + กัน active ซ้อน
- [x] Dashboard ผู้เช่า [`/liff`](../app/liff/page.tsx) อ่านข้อมูลจริง + กรณีไม่มีห้อง/ไม่มีบิล

**เกณฑ์จบ:** ผ่านแล้ว (ปิด Phase 1 เมื่อ 17/10/2569)

## Phase 2: มิเตอร์และการออกบิล — สถานะ: กำลังทำ (เครื่องมือสร้าง/ตรวจ/ออกบิลร่างทำแล้ว; ยังไม่ปิดเกณฑ์ยอดและ UAT)

- [x] หน้าจดมิเตอร์หลายห้อง + แนบรูป + ตรวจเลขลดลง/ใช้ผิดปกติ — [`app/admin/meters/`](../app/admin/meters/page.tsx) — โค้ดและ migration อยู่ใน commit `c9b2112`; มีชุด `supabase/tests/path-a.test.mjs`; ยังไม่ใช่หลักฐาน UAT บนอุปกรณ์/Cloud
- [x] กติกา Q-03–Q-05 — ยืดหยุ่นรายห้อง/รายบิล, รับเต็มยอดเท่านั้น, ค่าปรับ/ส่วนลดใส่เองในบิลร่าง (ตัดสิน 18/10/2569)
- [x] เอนจินฝั่ง Server สร้างบิลร่างเต็มเดือน: ค่าเช่า + น้ำเหมาจ่าย + หน่วยไฟ×อัตรา + รายการเพิ่ม − ส่วนลดที่ผู้ดูแลกรอกเอง — [`app/admin/billing/actions.ts`](../app/admin/billing/actions.ts)
- [x] เก็บ snapshot รายการในบิล; migration เพิ่มการอ้างอิงแถวมิเตอร์และล็อกยอด/รายการหลังออกบิล — `20261018000003_billing_snapshots.sql` (apply กับ Cloud แล้ว)
- [x] ตรวจยอดรวมและออกบิลจากร่างด้วยมือ, unique lease/period กันซ้ำ, audit log, ล็อกบิลชำระแล้ว; `mark-overdue` อัปเดตสถานะหลังพ้นวันครบกำหนดโดยไม่คิดค่าปรับ
- [x] Admin แสดงบิลจริงและ LIFF อ่านรายละเอียดรายการจาก Supabase — [`app/admin/billing/`](../app/admin/billing/page.tsx), [`app/liff/bills/`](../app/liff/bills)

**เกณฑ์จบ:** ยอดตรงกับตัวอย่างที่ลูกค้ายืนยัน ครอบคลุมสิ้นเดือน/ก.พ./รอบวันที่ 10/รอบร้านค้า/มิเตอร์ไม่ครบ — งานซ้ำไม่สร้างบิลซ้ำ

## Phase 3: รับชำระและตรวจสลิป — สถานะ: กำลังทำ (flow และคิวตรวจเขียนแล้ว; รอ env/ข้อมูลจริงและ UAT)

- [x] Adapter SlipOK ฝั่ง Server — [`app/api/slipok/verify/route.ts`](../app/api/slipok/verify/route.ts); ผลไม่ตรง/ตรวจไม่ได้เข้าคิวตรวจมือ; รอ credentials และตรวจบัญชีจริง
- [x] QR PromptPay ตามบัญชีรับเงิน: โค้ดเสร็จสมบูรณ์แล้วใน [`lib/promptpay.ts`](../lib/promptpay.ts) (มาตรฐาน EMVCo + คำนวณ CRC16-CCITT ถูกต้อง, ผ่านเทสต์ `tests/promptpay.test.mjs`) แสดงบนหน้าบิลที่รอชำระ; เลขรับเงินอ่านจากหน้าตั้งค่า (`app_settings`) ก่อน แล้วจึง env (commit `2a7a78f`); ตั้งค่าบน production แล้ว — เหลือทดสอบสแกนจ่ายจริง
- [x] อัปโหลดสลิป → Private Storage + ตรวจชนิดไฟล์/ขนาดฝั่ง Server (รูป 4 MB)
- [x] เทียบยอดและ reference; unique reference + unique open payment + RPC transaction กันอนุมัติซ้ำ — migration `20261018000004_payment_workflow.sql` (apply กับ Cloud แล้ว)
- [x] คิวตรวจแอดมิน: อนุมัติยอดเต็ม/ปฏิเสธพร้อมเหตุผล + audit log — [`app/admin/payments/`](../app/admin/payments/page.tsx)
- [x] Provider ล่ม/ไม่มี env/ข้อมูลไม่ตรง → pending/manual review; ห้าม auto mark paid
- [x] กู้คืนจาก `payment_verifications` ของรายการเดิมโดยไม่อัปโหลดหรือเรียก SlipOK ซ้ำ; สถานะ payment/บิล/audit บันทึกใน transaction เดียว และยังให้แอดมินตรวจยืนยันก่อน paid — ดู [การเก็บสลิปและแจ้งเตือน](PAYMENT-RECOVERY.md); migration `20261018000006` apply กับ Cloud แล้ว (commit `a58f02f`)
- [x] เก็บรายการสลิป/ผู้ส่ง/log ใน Database และรูปใน Private Storage; แจ้งเตือนเว็บแอดมินพร้อมห้อง/งวดและลิงก์ไปคิวตรวจ อัปเดตทุก 15 วินาทีขณะเปิดหน้า — migrations apply แล้ว; แจ้งเตือนในเว็บทำงานแล้ว (commit `a58f02f`)
- [x] แจ้งผลผู้เช่า + สถานะล่าสุด: ส่ง LINE push notification อัตโนมัติหลังแอดมินอนุมัติหรือปฏิเสธสลิป พร้อมระบบ dedup และส่งซ้ำด้วยมือจากประวัติ (commit `f1bf4bb`, migration `20261018000007` apply บน Cloud แล้ว; รอ UAT ส่งข้อความจริงสู่บัญชี LINE ผู้เช่า)

**เกณฑ์จบ:** โค้ดและ migration บน Cloud ครบแล้ว — ยังเหลือ end-to-end UAT กับ SlipOK/บัญชีรับเงินจริง และทดสอบ LINE notification กับผู้เช่าจริง

## Phase 4: เอกสารและงานซ่อม — สถานะ: โค้ดหลักมีแล้ว; รอตรวจสิทธิ์และ UAT จริง

- [x] อัปโหลด/เปิด PDF/รูปผ่าน Private bucket และ Signed URL ที่ผูกสัญญา — [`app/admin/documents/`](../app/admin/documents/page.tsx), [`app/liff/documents/`](../app/liff/documents/page.tsx)
- [ ] แยกเอกสารห้องพัก/ร้านค้าตามเอกสารที่ยืนยัน — `เจ้าของกรอกเอง`
- [x] แจ้งซ่อมหลายรูป + หมวด + ความเร่งด่วน + timeline — [`app/liff/maintenance/`](../app/liff/maintenance/page.tsx)
- [x] แอดมินเปลี่ยนสถานะ/แนบรูปผล + ผู้เช่ายืนยันปิดงาน — [`app/admin/maintenance/`](../app/admin/maintenance/page.tsx)
- [x] แจ้งเตือนงานซ่อมใหม่ในเว็บแอดมิน: API จำกัด owner/admin, แสดงห้อง/หมวดงาน และรีเฟรชทุก 15 วินาที; เพิ่มเทสต์ auth/error/queue — local ผ่าน; cross-tenant Storage policy tests ผ่านในชุด `npm test`
- [ ] ทดสอบสิทธิ์ไฟล์/เอกสารข้ามผู้เช่าด้วยบัญชีจริงและ Signed URL บน Cloud — `รอตรวจ` (ชุด local จำลอง RLS ไม่แทน UAT จริง)

**เกณฑ์จบ:** ยังไม่ผ่าน — ยังต้องทดสอบบัญชีแยกกันและ Signed URL บนอุปกรณ์/Storage จริง; Q-07 ยังไม่ตอบ

## Phase 5: ส่งข้อความ รวมระบบ และ UAT — สถานะ: บางส่วน

- [x] ยกเลิก cron ตามที่ผู้ใช้เลือก A (17/10/2569): ลบ route, helper, vercel.json และ CRON_SECRET; สถานะเกินกำหนดคำนวณจากวันครบกำหนดตอนแสดงผล
- [x] หน้า `/admin/messages`: เลือกทุกห้อง/รายห้อง/ห้องที่มีบิลรอชำระ แม่แบบและตัวอย่าง ข้อความ LINE ประวัติและส่งซ้ำ — โค้ด commit `b258580`; migration Cloud ลงแล้ว; ยังรอ UAT จริง ([คู่มือ](ADMIN-MESSAGES.md))
- [ ] ทดสอบส่ง LINE จริงจากหน้า `/admin/messages` และตรวจประวัติ/สถานะส่ง (Q-06)
- [x] Webhook LINE สำหรับยืนยัน invite code — [`app/api/line/webhook/route.ts`](../app/api/line/webhook/route.ts), [`lib/line-invites.ts`](../lib/line-invites.ts); migration `20261017132926` ลง Cloud แล้ว; ยังต้องทดสอบ event redelivery/LINE จริง
- [ ] LINE notifications: ผลตรวจสลิปมี dedup, ส่งซ้ำด้วยมือจากประวัติ; migration `20261018000007` ลงแล้ว; รอตรวจ LINE จริง ไม่มี retry อัตโนมัติ
- [ ] ตรวจ RLS/Storage/API authorization/การเงิน/session บนสภาพแวดล้อมทดสอบจริง — `ยังไม่เริ่ม`
- [ ] UAT ผู้เช่าจริง 2–3 ห้อง (วงจร สัญญา → บิล → ชำระ → ซ่อม) — `ยังไม่เริ่ม` (รอผู้ร่วมทดสอบ)
- [ ] ซ้อม backup/restore + จัดทำคู่มือเจ้าของ/ผู้เช่า — `ยังไม่เริ่ม`

**เกณฑ์จบ:** มีหลักฐาน UAT ที่ลูกค้ายอมรับ — deployment สำเร็จอย่างเดียว**ไม่ทดแทน** UAT

## เปิดใช้งาน (Go-live)

- [x] ขออนุมัติและ apply migrations บน Cloud (17/10/2569)
- [x] เผยแพร่ production หลัง independent review ผ่าน — deployment จาก `8dece5e` READY (17/10/2569)
- [ ] ใส่ข้อมูลจริงครบก่อนเชิญผู้เช่า (ไม่เปลี่ยนทั้งระบบโดยไม่มีข้อมูลตั้งต้น)
- [ ] เดือนแรกเทียบยอดกับวิธีเดิม + ตรวจยอดทุกรอบ (เรียกเก็บ/รับแล้ว/ค้าง/สลิปซ้ำ/แจ้งเตือนตกหล่น)
- [ ] หลังใช้ 1–2 รอบบิล จึงทบทวนการอนุมัติอัตโนมัติร่วมกับลูกค้า

### การปรับปรุงคุณภาพและส่วนต่อประสาน (Anti-Slop & UI Quality) — สถานะ: ผ่านเกณฑ์ 100% (17-18/10/2569)

- [x] **Anti-Slop Copywriting & Text Audit #001 (แก้ครบ 46/46 รายการ):**
  - ขจัด Em Dash (`—`) ตามกฎเหล็ก R-02 ในข้อความ UI ทั้งหมด (LIFF, Admin, Error Dictionaries, Toasts) เปลี่ยนเป็น `:` หรือจัดประโยคภาษาไทยธรรมชาติ
  - ตัดรหัสคำถามบรีฟและบันทึกนักพัฒนาที่หลุดสู่ UI (R-38/R-36): ตัด `(Q-07)`, `(Q-02)`, `(รอ Q-04)`, `"ตามบรีฟ"`, `"Supabase"`
  - ปรับสำนวนให้สุภาพ เป็นมืออาชีพ (เช่น `เปิดไม่ได้ (ไฟล์อาจหาย)` → `ไม่สามารถเปิดไฟล์ได้`, ลบสัญลักษณ์ `≠` ในหน้าบิล, ปรับชื่อผู้ให้บริการเป็น SlipOK ตามมติ D-031)
  - รายงานผลฉบับเต็มบันทึกใน [`anti-slop/audit-001-2026-10-17.md`](../anti-slop/audit-001-2026-10-17.md)
- [x] **การอ่านง่ายและคอนทราสต์ใน OS Dark Mode (UI Readability & Contrast):**
  - ลบการสลับ foreground สีเข้มของ OS Dark Mode บนแอปธีมสว่าง กำหนดสีข้อความ ฟอร์ม และ placeholder ชัดเจน คอนทราสต์ขั้นต่ำ 4.55:1
  - ปรับ Responsive Layout ของ Admin Navigation เป็นแถบเลื่อนแนวนอนบนจอมือถือ และขยายคอนเทนเนอร์ผู้เช่า LIFF เป็น 768px รองรับ Safe Area
  - รายละเอียดบันทึกใน [`docs/UI-ROOMS-FIX.md`](UI-ROOMS-FIX.md)
- [x] **การจัดรูปแบบช่องวันที่ (Date Format Compatibility):**
  - แก้ไขช่องกรอกวันที่ให้แสดงผลเป็นรูปแบบ DD/MM/YYYY สม่ำเสมอทุกเบราว์เซอร์ (commit `1006034`)

## Phase 6: ต่อยอดหลังเปิดใช้ (ไม่ผูก MVP)

| ระดับ | งาน | เงื่อนไขก่อนเริ่ม |
|---|---|---|
| สูง | ใบเสร็จ PDF · รายงานรายรับ/Excel · ย้ายออก/คืนเงินประกัน | ยอดรับชำระนิ่ง + ยืนยันรูปแบบเอกสาร/กติกาคืนเงิน |
| กลาง | ตรวจสภาพห้องพร้อมรูป · Rich Menu · สิทธิ์ Staff/ช่าง | ยืนยันผู้ใช้และสิทธิ์ของงานใหม่ |
| ต่ำ | วิเคราะห์ไฟผิดปกติ · หลายอาคาร · PWA · Payment Gateway | ประเมินความจำเป็น + อนุมัติขอบเขตเพิ่ม |

---

## ลำดับที่แนะนำต่อจากนี้

1. **Deploy & ตรวจรับ UI บนอุปกรณ์จริง:** ขออนุมัติผู้ใช้ deploy source โค้ดล่าสุดขึ้น Vercel (`maehongson/pirodom-apt`) เพื่อตรวจรับระบบ Room Edit/Delete และการปรับปรุง Anti-Slop บนอุปกรณ์จริง
2. **UAT การชำระเงินและตรวจสลิป (Phase 3):** ยืนยันข้อมูลบัญชี PromptPay จริง (Q-06) และ SlipOK credentials เพื่อทดสอบสแกนจ่ายจริงและตรวจสลิปอัตโนมัติ
3. **กรณีพิเศษการเงิน (Phase 2):** Q-03/Q-04 ปิดแล้ว (ยืดหยุ่นรายห้อง/รายบิล); Q-05 ปิดแล้ว: รับเต็มยอดเท่านั้น
4. **UI ตาม mockup:** branch `ui/mockup-blue` (`ffb85f9`) ทำเมนูข้าง/ภาพรวม/ห้องแล้ว โทนขาว-ดำ-น้ำเงินตามลูกค้า หน้าที่เหลือ Gemini รับต่อ ยังไม่ merge
5. **ข้อมูลทดสอบบน production:** UAT 18/10 สร้างห้อง 103 + สัญญา active บน Cloud จริง ต้องปิด/ลบก่อนใส่ข้อมูลจริง

## ตรวจสอบย้อนหลัง (Evidence log)

| วันที่ | สิ่งที่ตรวจ | ผล |
|---|---|---|
| 2026-10-16 | ตรวจครั้งแรกตาม ROADMAP §7 | test/typecheck/lint ผ่าน (commit `1a93b88`) |
| 2026-10-17 | `npm run typecheck` · `npm run lint` · `npm run build` (working tree ก่อนหน้า) | ผ่าน — ตอนนั้นไม่ได้รัน test suite; migrations ยังไม่ apply และไม่มีการทดสอบ end-to-end บน Cloud/อุปกรณ์จริง |
| 2026-10-17 (เย็น) | ข้อ 0 ครบ + Phase 1 โค้ดครบ (rooms/leases/invites/join/dashboard) + `npm run build` ครั้งแรก | test/typecheck/lint/build ผ่านทั้งหมด — หลักฐานตามเวลานั้น; ดู [Cloud migration release evidence](SUPABASE-RELEASE-20261017.md) สำหรับสถานะปัจจุบัน |
| 2026-10-17 (หลักฐาน flow ลิงก์เดิม) | ผู้ใช้ยืนยันเพื่อนรับลิงก์ด้วย LINE ต่างบัญชี เห็นห้อง/สัญญาจริง และคำเชิญขึ้นใช้แล้ว | เป็นหลักฐานย้อนหลังเท่านั้น; flow ปัจจุบันเปลี่ยนเป็น Bot code และต้อง UAT ใหม่ |
| 2026-10-17 (เปลี่ยนวิธีเชิญ) | แอดมินออกรหัส 12 ตัวเก็บเฉพาะ hash; LINE webhook ตรวจ signature รับ code ผ่านข้อความส่วนตัวและผูกบัญชีด้วย RPC `accept_invite_code`; API ลิงก์เก่า 410 | โค้ดเริ่มที่ `b258580`; migration apply และตรวจ ledger/RPC แล้ว; ยังไม่ทดสอบ Bot-to-LIFF จริง; ดู [หลักฐาน Cloud](SUPABASE-RELEASE-20261017.md) |
| 2026-10-17 (release verification) | Production deployment ของ 8dece5e เป็น READY; production alias webhook ตอบ 401 invalid signature เมื่อรับ signature ปลอมโดยไม่มีการเขียน DB; bypass token rotation เสร็จ | หลักฐานเพิ่มเติม: handoff ล่าสุดบน IGAMER — real invite-code → Bot → LIFF UAT, payment UAT, broader security/UAT, monitoring/rollback และข้อมูลธุรกิจยังค้าง |
| 2026-10-17 (dashboard live data) | `/admin` ใช้ query จาก Supabase สำหรับจำนวนห้อง/บิล/สลิปรอตรวจ/งานซ่อม; query error แสดงสถานะผิดพลาดแทนข้อมูลตัวอย่าง | `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` ผ่าน; แก้ใน working tree ยังไม่ commit/push/deploy |
| 2026-10-17 (maintenance alert) | แถบแอดมินแจ้งงานซ่อมใหม่จาก API ที่อนุญาตเฉพาะ owner/admin และรีเฟรชทุก 15 วินาที; Storage path tests ครอบคลุมผู้เช่าคนอื่น/สัญญาเก่า | `npm test`, lint, typecheck, build ผ่าน; เทสต์ Cloud/บัญชีจริงยังไม่ทำ; แก้ใน working tree |
| 2026-10-17 (Phase 1 Acceptance) | ผู้ใช้ทดสอบจริง: เชิญเพื่อน LINE บัญชีจริงเข้าห้อง 101 สำเร็จ คำเชิญขึ้นใช้แล้ว; ปิด Phase 1 | บันทึกใน `docs/PHASE1-VERIFICATION.md` และ commit `378e902` |
| 2026-10-17 (Billing & Payments) | Snapshot บิล, unique period, PromptPay QR, payment recovery, LINE push notification, web admin alerts | commit `5b28cc0`–`f1bf4bb`, migrations 7 ไฟล์ apply บน Cloud แล้ว |
| 2026-10-17 (Production Env Refresh) | รีเฟรช Production env 10 ตัวบน Vercel pirodom-apt; deploy dpl_9bQbbms8GDDp3dB7cDa2P6WYMJnd READY | Signed webhook 200 ok, LINE platform webhook test 200 ok (ดู `docs/PRODUCTION-ENV-REFRESH.md`) |
| 2026-10-17 (UI Rooms & Dark Mode) | ปรับปรุงคอนทราสต์ dark mode, responsive layout, เพิ่มระบบแก้ไข/ลบห้องพร้อมยืนยันและ FK check | `npm test` ผ่าน (รวมชุดทดสอบห้อง), typecheck/lint/build ผ่าน 24 หน้า (ดู `docs/UI-ROOMS-FIX.md`) |
| 2026-10-18 (Date Format) | ช่องกรอกวันที่แสดงผล DD/MM/YYYY สม่ำเสมอทุกเบราว์เซอร์ | commit `1006034` |
| 2026-10-18 (Anti-Slop Text Polish) | แก้ไขข้อความ 46/46 รายการตาม audit-001: ขจัด em dash, ตัดรหัสบรีฟ Q-07/Q-02/Q-04, ปรับสำนวน | `npm run lint` ผ่าน (0 warnings), `npx tsc --noEmit` ผ่าน (0 errors) |
| 2026-10-18 (Live Production UAT: Settings, Rooms, Leases) | ทดสอบบน https://pirodom-apt.vercel.app: 1) /admin/settings บันทึก PromptPay/SlipOK/LINE สำเร็จ สถานะ "พร้อม" 2) แก้ราคาห้อง 101 (มีสัญญา) ถูกบล็อกด้วย trigger rooms_lock_prices, ห้อง 103 (ว่าง) แก้ราคาได้ 3) สร้างสัญญาเลือกห้อง 103 ดึงราคาและเงื่อนไขอัตโนมัติครบถ้วน | ผ่าน 100% ครบทั้ง 3 จุด มีภาพบันทึกหลักฐานยืนยัน |
| 2026-10-18 (Settings + ราคาห้อง) | หน้าตั้งค่า SlipOK/PromptPay/LINE เก็บใน `app_settings` (service role เท่านั้น); ราคาตั้งต้นรายห้อง ล็อกด้วย trigger ระหว่างมีสัญญา; สัญญาดึงราคาจากห้อง | commit `2a7a78f`; migration `20261018000008` ลง Cloud แล้ว; deploy READY; test/typecheck/lint/build ผ่าน |
| 2026-10-18 (UI mockup) | ธีมขาว-ดำ-น้ำเงิน, ฟอนต์ Inter+Prompt, เมนูข้างดำมีไอคอน, ภาพรวม, ห้องแยกตามชั้น | branch `ui/mockup-blue` commit `ffb85f9`; ตรวจภาพโหมดตัวอย่าง desktop/มือถือ; build ผ่าน; ยังไม่ merge |
| 2026-10-18 (LINE 3-Tier Auth & Admin by LINE ID) | เงื่อนไขล็อกอิน 3 ระดับ (Admin → `/admin`, ผู้เช่า → ห้องพัก, อื่นๆ → แจ้งโทร 053-276631), จัดการแอดมินด้วย LINE User ID ใน Settings, ยกเลิก email/password | โค้ดเสร็จสมบูรณ์, `npm test` ผ่าน 100%, `npx tsc --noEmit` 0 errors |
| 2026-10-18 (Logout LIFF Session & Clean Diff) | แก้ไขการออกจากระบบให้ล้าง LIFF session ด้วย `liff.logout()`, แก้ lint warning location-assign, เพิ่ม `.devpit/` ใน `.gitignore`, เคลียร์ whitespace diff | `npm run lint` ผ่าน (0 errors, 0 warnings), `npm test` ผ่าน 100% |
| 2026-10-18 (LINE 400 Investigation) | ตรวจสอบ Error 400 Bad Request ด้วย Browser Subagent พบสาเหตุเกิดจากทดสอบบน `http://localhost:3000/liff` ที่ยังไม่ได้ลงทะเบียนใน Callback URL ของ LINE Console | บันทึกภาพถ่ายหน้าจอและแนวทางแก้ไขใน Knowledge Base |
| 2026-10-18 (Apply Migration 0009 & Role Invariant) | ตรวจสอบ migration `20261018000009` (`set_staff_role`) พบ apply บน Live Cloud เรียบร้อย (15/15 files in sync), test/typecheck/lint ผ่าน 100% | ผ่าน 100% |
