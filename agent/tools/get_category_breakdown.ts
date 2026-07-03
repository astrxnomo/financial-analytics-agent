import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCategoryBreakdown } from "#lib/finance.js";

export default defineTool({
  description:
    "Monthly totals per category (spend mix or revenue mix over time). Use for 'what do we spend on', 'breakdown by category', 'composition', 'where does the money go' questions. Optionally filter to one department.",
  inputSchema: z.object({
    metric: z.enum(["income", "expense"]).default("expense"),
    department: z
      .string()
      .optional()
      .describe("Exact department name to filter by, e.g. 'Engineering'"),
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getCategoryBreakdown(input);
  },
});
