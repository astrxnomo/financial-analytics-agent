import { z } from "zod";
import { getSummary } from "@/agent/lib/finance";

const Q = z.object({ from: z.string(), to: z.string() });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getSummary(parsed.data));
}
