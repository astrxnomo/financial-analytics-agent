import { z } from "zod";
import { getCategoryBreakdown } from "@/agent/lib/finance";

const Q = z.object({
  metric: z.enum(["income", "expense"]).default("expense"),
  department: z.string().optional(),
  from: z.string(),
  to: z.string(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getCategoryBreakdown(parsed.data));
}
