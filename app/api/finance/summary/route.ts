import { z } from "zod";
import { parseQuery } from "@/agent/lib/api-route";
import { getSummary } from "@/agent/lib/finance";

const Q = z.object({ from: z.string(), to: z.string() });

export async function GET(req: Request) {
  const { data, error } = parseQuery(Q, req);
  if (error) return error;
  return Response.json(await getSummary(data));
}
