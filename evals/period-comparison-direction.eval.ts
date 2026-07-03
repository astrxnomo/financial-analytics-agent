import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import type { Summary } from "#lib/finance.types.js";

// Regression test for the most serious bug found this session: asked to
// compare two calendar years, the model stated "expenses decreased" for a
// year where expense actually went up (~$480K), even after being told to
// write out the subtraction explicitly — it fabricated a reversed-order
// subtraction on just that one line to make the wrong direction look
// self-consistent. The fix (instructions.md rule 5) tells the model not to
// compute prose deltas at all for period comparisons, just state both raw
// tool-sourced numbers — this eval doesn't hardcode which year had higher
// expense (that's a fact of the seeded data, not something to freeze here);
// it derives the true direction from the same get_summary outputs the model
// saw, and only fails if the reply's stated direction contradicts them.
export default defineEval({
  description:
    "A period-over-period P&L comparison never states an increase/decrease direction that contradicts the tool-sourced totals.",
  async test(t) {
    const turn = await t.send(
      "Give me a full P&L summary for calendar year 2024, and how does that compare to 2025?",
    );
    turn.expectOk();
    t.succeeded();

    const summaryCalls = turn.toolCalls.filter((c) => c.name === "get_summary" && c.status === "completed");
    const summaries = await t.require(
      summaryCalls.map((c) => c.output as unknown as Summary),
      satisfies((rows: Summary[]) => rows.length === 2, "two get_summary calls, one per calendar year"),
    );

    const [earlier, later] = [...summaries].sort((a, b) => a.from.localeCompare(b.from));
    const reply = (t.reply ?? "").toLowerCase();

    for (const [label, earlierValue, laterValue] of [
      ["income", earlier!.income, later!.income],
      ["expense", earlier!.expense, later!.expense],
      ["net", earlier!.net, later!.net],
    ] as const) {
      if (!reply.includes(label)) continue;
      const actuallyIncreased = laterValue > earlierValue;
      const nearLabel = new RegExp(`${label}[^.]{0,40}(increased|decreased|grew|shrank|rose|fell|dropped)`, "i");
      const match = reply.match(nearLabel);
      if (!match) continue;
      const word = match[1]!.toLowerCase();
      const claimsIncrease = ["increased", "grew", "rose"].includes(word);
      const claimsDecrease = ["decreased", "shrank", "fell", "dropped"].includes(word);
      if (claimsIncrease) {
        t.check(
          actuallyIncreased,
          satisfies((v: boolean) => v === true, `"${label} ${word}" matches the tool-sourced totals`),
        );
      } else if (claimsDecrease) {
        t.check(
          !actuallyIncreased,
          satisfies((v: boolean) => v === true, `"${label} ${word}" matches the tool-sourced totals`),
        );
      }
    }
  },
});
