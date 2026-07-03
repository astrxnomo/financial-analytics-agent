import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAnomalies } from "#lib/finance.js";

export default defineTool({
  description:
    "Unusual expense transactions in a date range: those exceeding mean + threshold*stddev within their category. Use for 'unusual', 'anomaly', 'outlier', 'suspicious' questions. Pass `departments` and/or `categories` when the user names specific ones, so the list only shows anomalies relevant to their question — the mean/stddev baseline is still computed from the full dataset either way, only the returned list is narrowed.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
    threshold: z.number().min(1).max(6).default(2.5).describe("Std-dev multiplier"),
    departments: z
      .array(z.string())
      .optional()
      .describe("Exact department names to restrict the returned list to, e.g. ['Engineering']."),
    categories: z
      .array(z.string())
      .optional()
      .describe("Exact category names to restrict the returned list to, e.g. ['Travel', 'Office']."),
  }),
  async execute(input) {
    return await getAnomalies(input);
  },
});
