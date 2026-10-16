# ระบบจัดการหอพักผ่าน LINE

บรีฟและ Roadmap: [docs/brief.pdf](docs/brief.pdf)

Next.js + Supabase + Vercel + LINE Login/LIFF + LINE Messaging API + SlipOK

## เริ่มต้น

1. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า
2. `npm install`
3. `npm run dev`

## คำสั่ง

- `npm run typecheck` / `npm run lint`
- `npm test` ทดสอบ migration + RLS (PGlite ไม่ต้องใช้ Docker)
- `supabase db push` ส่ง migration ขึ้นโปรเจกต์ Supabase
