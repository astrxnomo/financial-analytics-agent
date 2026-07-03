import { defineTool } from "eve/tools";
import { z } from "zod";
import { getBudgetStatus } from "#lib/finance.js";

export default defineTool({
  description:
    "Per-department budget vs actual expense for one month, with variance and pctUsed. Use for 'over budget', 'budget status' questions. Pass any date in the target month (YYYY-MM-DD). Pass `departments` to restrict to the specific department(s) named in the question instead of returning all of them.",
  inputSchema: z.object({
    month: z.string().describe("Any date in the target month, YYYY-MM-DD"),
    departments: z
      .array(z.string())
      .optional()
      .describe(
        "Exact department names to restrict to, e.g. ['Engineering', 'Marketing']. Omit to include all departments.",
      ),
  }),
  async execute(input) {
    return await getBudgetStatus(input);
  },
});
