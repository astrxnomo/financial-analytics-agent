import { defineTool } from "eve/tools";
import { z } from "zod";
import { getCashflow } from "#lib/finance.js";

export default defineTool({
  description:
    "Monthly income vs. expense with net and cumulative net position. Use for 'cash flow', 'burn', 'are we profitable', 'net position over time' questions.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getCashflow(input);
  },
});
