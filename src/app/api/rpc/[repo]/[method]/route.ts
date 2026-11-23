import { handleRpc, type RpcParams } from "@/server/rpc/handler";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<RpcParams> },
): Promise<Response> {
  return handleRpc(request, await context.params);
}
