import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSummary } from "#lib/finance.js";

export default defineTool({
  description:
    "Total income, expense, and net for a date range (inclusive). Dates are YYYY-MM-DD.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getSummary(input);
  },
});
