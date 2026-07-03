import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getTrend } from "@/agent/lib/finance";

const Q = z.object({
  metric: z.enum(["income", "expense"]),
  groupBy: z.enum(["month", "department"]).default("month"),
  from: z.string(),
  to: z.string(),
});

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getTrend(data));
}
