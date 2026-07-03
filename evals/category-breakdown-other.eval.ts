import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

// Regression test for a real bug: asked what's in the chart's "Other" band,
// the model used to recompute the top-N-by-total ranking itself from raw
// monthly rows and dropped a category ("Advertising") doing the mental
// arithmetic. get_category_breakdown now returns a precomputed
// `otherCategories` field (agent/tools/get_category_breakdown.ts) for the
// model to quote directly — this eval checks the reply actually mentions
// every category the tool said was folded into "Other".
//
// Note: CATEGORY_BREAKDOWN_TOP_N currently covers all 8 seeded expense
// categories (see finance.types.ts), so "Other" is empty for today's
// dataset — the loop below has nothing to check and the eval passes
// vacuously. It starts asserting for real the moment a 9th expense category
// is seeded, which is exactly when the bug it guards against becomes
// reachable again. (t.skip() can't be used here: it must be called before
// sending any message, and whether there's anything to check is only known
// after the tool call comes back.)
export default defineEval({
  description:
    "\"What's in Other\" cites every category from the tool's otherCategories field, not a re-derived (and possibly incomplete) list.",
  async test(t) {
    const turn = await t.send(
      'What\'s our biggest expense category, and what\'s included in the "Other" category in our spend mix?',
    );
    turn.expectOk();
    t.succeeded();

    const call = turn.requireToolCall("get_category_breakdown");
    const { otherCategories } = call.output as { otherCategories: string[] };

    for (const category of otherCategories) {
      t.check(t.reply, includes(category));
    }
  },
});
