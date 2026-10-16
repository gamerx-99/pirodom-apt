// Vercel Cron ส่ง Authorization: Bearer <CRON_SECRET> มาให้
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}
