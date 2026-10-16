export default async function Page({ params }: PageProps<"/liff/bills/[id]">) {
  const { id } = await params;
  return <h1>รายละเอียดบิล {id} และอัปโหลดสลิป</h1>;
}
