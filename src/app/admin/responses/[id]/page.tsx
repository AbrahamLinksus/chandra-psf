import { ResponseDetailScreen } from "@/features/admin-responses/ResponseDetailScreen";

export default async function AdminResponseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResponseDetailScreen id={id} />;
}
