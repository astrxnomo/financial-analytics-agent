import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getAnomalies } from "@/agent/lib/finance";

const Q = z.object({
  from: z.string(),
  to: z.string(),
  threshold: z.coerce.number().min(1).max(6).optional(),
  departments: z
    .string()
    .optional()
    .transform((s) => s?.split(",").map((d) => d.trim()).filter(Boolean)),
  categories: z
    .string()
    .optional()
    .transform((s) => s?.split(",").map((c) => c.trim()).filter(Boolean)),
});

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getAnomalies(data));
}
