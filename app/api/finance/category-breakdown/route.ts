import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getCategoryBreakdown } from "@/agent/lib/finance";

const Q = z.object({
  metric: z.enum(["income", "expense"]).default("expense"),
  department: z.string().optional(),
  from: z.string(),
  to: z.string(),
});

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getCategoryBreakdown(data));
}
