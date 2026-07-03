import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getBudgetStatus } from "@/agent/lib/finance";

const Q = z.object({ month: z.string() });

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getBudgetStatus(data));
}
