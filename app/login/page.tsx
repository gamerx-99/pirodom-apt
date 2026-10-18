import { redirect } from "next/navigation";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTarget = params?.redirect || "/admin";
  redirect(`/liff?redirect=${encodeURIComponent(redirectTarget)}`);
}
