import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getAnomalies } from "@/agent/lib/finance";

const Q = z.object({
  from: z.string(),
  to: z.string(),
  threshold: z.coerce.number().min(1).max(6).optional(),
});

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getAnomalies(data));
}
