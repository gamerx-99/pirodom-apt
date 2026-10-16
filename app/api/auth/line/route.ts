// TODO Phase 0/1: รับ LIFF ID token -> ตรวจกับ LINE -> หา/สร้าง profile (line_user_id)
// -> ออก session ของ Supabase เพื่อให้ RLS รู้ auth.uid() ของผู้เช่า
export async function POST() {
  return new Response("not implemented", { status: 501 });
}
