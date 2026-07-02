import { defineTool } from "eve/tools";
import { z } from "zod";
import { getBudgetStatus } from "#lib/finance.js";

export default defineTool({
  description:
    "Per-department budget vs actual expense for one month, with variance and pctUsed. Use for 'over budget', 'budget status' questions. Pass any date in the target month (YYYY-MM-DD).",
  inputSchema: z.object({
    month: z.string().describe("Any date in the target month, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getBudgetStatus(input);
  },
});
