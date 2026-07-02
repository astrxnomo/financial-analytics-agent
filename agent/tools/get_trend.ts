import { defineTool } from "eve/tools";
import { z } from "zod";
import { getTrend } from "#lib/finance.js";

export default defineTool({
  description:
    "Monthly time series of income or expense, optionally split by department. Use for 'trend', 'over time', 'growth', 'by department' questions.",
  inputSchema: z.object({
    metric: z.enum(["income", "expense"]),
    groupBy: z.enum(["month", "department"]).default("month"),
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getTrend(input);
  },
});
