import { defineTool } from "eve/tools";
import { z } from "zod";
import { CATEGORY_BREAKDOWN_TOP_N, getCategoryBreakdown } from "#lib/finance.js";

export default defineTool({
  description:
    "Monthly totals per category (spend mix or revenue mix over time). Use for 'what do we spend on', 'breakdown by category', 'composition', 'where does the money go' questions. Optionally filter to one department and/or one category — pass `category` when the user asks about a single named category (e.g. 'is the Cloud Infrastructure spike recurring') so the chart isolates that series instead of showing every category. The result includes `otherCategories`: the exact list the chart's 'Other' band contains for this range — quote it directly if asked what's in 'Other' rather than re-deriving it from `slices`.",
  inputSchema: z.object({
    metric: z.enum(["income", "expense"]).default("expense"),
    department: z
      .string()
      .optional()
      .describe("Exact department name to filter by, e.g. 'Engineering'"),
    category: z
      .string()
      .optional()
      .describe("Exact category name to filter by, e.g. 'Cloud Infrastructure'"),
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    const slices = await getCategoryBreakdown(input);
    const totals = new Map<string, number>();
    for (const s of slices) totals.set(s.category, (totals.get(s.category) ?? 0) + s.value);
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const otherCategories = ranked.slice(CATEGORY_BREAKDOWN_TOP_N);
    return { slices, otherCategories };
  },
});
