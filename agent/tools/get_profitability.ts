import { defineTool } from "eve/tools";
import { z } from "zod";
import { getProfitability } from "#lib/finance.js";

export default defineTool({
  description:
    "Income vs. expense and net profit per department for a date range, with margin (net/income). Use for 'which department is most/least profitable', 'profit by team', 'which teams are net contributors vs cost centers', 'margin by department' questions — the one view that pairs a department's revenue against its spend. Rows come back sorted most-profitable-first. Pass `departments` to restrict to specific teams. Only Sales and Engineering book revenue; the other departments are cost centers and correctly show net-negative with a null margin — that's expected, not a data gap.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
    departments: z
      .array(z.string())
      .optional()
      .describe(
        "Exact department names to restrict to, e.g. ['Sales', 'Engineering']. Omit to include all departments.",
      ),
  }),
  async execute(input) {
    return await getProfitability(input);
  },
});
