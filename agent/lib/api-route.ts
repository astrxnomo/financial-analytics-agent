import type { ZodType } from "zod";

// Shared by every app/api/finance/*/route.ts handler — parses ?query params
// against a Zod schema and returns either the typed data or a ready-to-return
// 400 Response, so each route stays a one-line call into the shared lib.
export function parseQuery<T>(
  schema: ZodType<T>,
  req: Request,
): { data: T; error?: undefined } | { data?: undefined; error: Response } {
  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return { error: Response.json({ error: parsed.error.flatten() }, { status: 400 }) };
  }
  return { data: parsed.data };
}
