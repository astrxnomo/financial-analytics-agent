import { z } from "zod";
import { getTrend } from "@/agent/lib/finance";

const Q = z.object({
  metric: z.enum(["income", "expense"]),
  groupBy: z.enum(["month", "department"]).default("month"),
  from: z.string(),
  to: z.string(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getTrend(parsed.data));
}
