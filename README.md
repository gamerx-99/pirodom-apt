# ระบบจัดการหอพักผ่าน LINE

เอกสารโครงการ (ปรับปรุง 16 ตุลาคม 2569):

- [Roadmap: ลำดับพัฒนาและเกณฑ์รับงาน](docs/ROADMAP.md)
- [Blueprint: โครงสร้างและกติกาของระบบ](docs/BLUEPRINT.md)
- [Todo: รายการงานและสถานะปัจจุบัน](docs/TODO.md)
- [Prompt ออกแบบรายหน้า: แอดมินและผู้เช่า 14 หน้า](docs/prompts/README.md)
- [บรีฟเดิม](docs/brief.pdf)

Next.js + Supabase + Vercel + LINE Login/LIFF + LINE Messaging API + SlipOK

## เริ่มต้น

1. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า
2. `npm install`
3. `npm run dev`

## คำสั่ง

- `npm run typecheck` / `npm run lint`
- `npm test` ทดสอบ migration + RLS (PGlite ไม่ต้องใช้ Docker)
- `supabase db push` ส่ง migration ขึ้นโปรเจกต์ Supabase
