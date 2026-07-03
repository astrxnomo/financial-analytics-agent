import { defineTool } from "eve/tools";
import { z } from "zod";
import { getDataOverview } from "#lib/finance.js";

export default defineTool({
  description:
    "Meta-stats about the underlying dataset itself: date range covered, and counts of departments, categories (revenue vs. expense), transactions, and budget rows. Use for questions about the data itself — 'how many transactions/records do we have', 'how much data is there', 'how many departments/categories are tracked'. Not for financial totals like income or expense — use get_summary for those.",
  inputSchema: z.object({}),
  async execute() {
    return await getDataOverview();
  },
});
