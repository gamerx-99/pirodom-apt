export async function POST() {
  return Response.json(
    { error: "invite_links_retired", message: "คำเชิญแบบลิงก์ถูกปิดแล้ว กรุณาส่งรหัสยืนยันให้ LINE Bot" },
    { status: 410 },
  );
}
