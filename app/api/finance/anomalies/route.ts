import { z } from "zod";
import { getAnomalies } from "@/agent/lib/finance";

const Q = z.object({
  from: z.string(),
  to: z.string(),
  threshold: z.coerce.number().min(1).max(6).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getAnomalies(parsed.data));
}
