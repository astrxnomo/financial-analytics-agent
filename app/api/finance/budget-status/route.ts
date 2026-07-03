import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getBudgetStatus } from "@/agent/lib/finance";

const Q = z.object({
  month: z.string(),
  departments: z
    .string()
    .optional()
    .transform((s) => s?.split(",").map((d) => d.trim()).filter(Boolean)),
});

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getBudgetStatus(data));
}
