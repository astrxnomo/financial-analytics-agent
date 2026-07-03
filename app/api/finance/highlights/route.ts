import { getHighlights } from "@/agent/lib/finance";

export async function GET() {
  return Response.json(await getHighlights());
}
