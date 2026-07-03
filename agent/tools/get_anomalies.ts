import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAnomalies } from "#lib/finance.js";

export default defineTool({
  description:
    "Unusual expense transactions in a date range: those exceeding mean + threshold*stddev within their category. Use for 'unusual', 'anomaly', 'outlier', 'suspicious' questions.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
    threshold: z.number().min(1).max(6).default(2.5).describe("Std-dev multiplier"),
  }),
  async execute(input) {
    return await getAnomalies(input);
  },
});
