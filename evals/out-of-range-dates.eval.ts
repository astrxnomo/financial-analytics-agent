import { defineEval } from "eve/evals";

// Asking for a period entirely after the seeded data range must not
// fabricate numbers — the agent should say plainly that coverage doesn't
// reach that far (instructions.md's Coverage note) rather than calling a
// tool with a range it has no data for and narrating an invented trend.
export default defineEval({
  description: "A date range entirely beyond the seeded data doesn't produce fabricated figures.",
  async test(t) {
    const turn = await t.send("Show me the revenue trend for all of 2027 and 2028.");
    turn.expectOk();
    t.succeeded();
    t.notCalledTool("get_trend");
  },
});
