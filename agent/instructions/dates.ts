import { defineDynamic, defineInstructions } from "eve/instructions";
import { getHighlights } from "#lib/finance.js";

// Resolved once per session (not baked into the build) so "today" and the
// seeded data range never go stale — no date to remember to update by hand
// as months pass or the seed is regenerated.
export default defineDynamic({
  events: {
    "session.started": async () => {
      const today = new Date().toISOString().slice(0, 10);
      let coverage = "Data coverage is unknown right now — call `get_summary` or `get_trend` with a wide range to discover it before assuming any dates.";
      try {
        const h = await getHighlights();
        coverage = `Transactions and budgets exist from ${h.dataFrom} through ${h.dataTo}. The latest closed month is ${h.latestMonth}.`;
      } catch {
        // DB unreachable at session start — the fallback line above still lets
        // the model behave sensibly instead of guessing a date range.
      }
      return defineInstructions({
        markdown: `# Current date and data coverage\n\nToday is ${today}. ${coverage}`,
      });
    },
  },
});
