import { defineTool } from "eve/tools";
import { z } from "zod";
import { getTrend } from "#lib/finance.js";

export default defineTool({
  description:
    "Monthly time series of income or expense, optionally split by department. Use for 'trend', 'over time', 'growth', 'by department' questions. Pass `departments` to restrict to the specific department(s) named in the question instead of returning all of them.",
  inputSchema: z.object({
    metric: z.enum(["income", "expense"]),
    groupBy: z.enum(["month", "department"]).default("month"),
    departments: z
      .array(z.string())
      .optional()
      .describe(
        "Exact department names to restrict to, e.g. ['Engineering', 'Marketing']. Omit to include all departments.",
      ),
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getTrend(input);
  },
});
