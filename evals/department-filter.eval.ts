import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import type { BudgetRow, TrendPoint } from "#lib/finance.types.js";

// Regression test for a real bug: asking to compare two named departments
// used to return get_trend/get_budget_status data for all five departments,
// diluting the chart and the narrative with three departments nobody asked
// about. get_trend and get_budget_status now accept a `departments` filter
// (see agent/tools/get_trend.ts, get_budget_status.ts) and instructions.md
// tells the model to use it — this eval catches a regression on either side.
export default defineEval({
  description:
    "Comparing two named departments narrows get_trend and get_budget_status to just those two.",
  async test(t) {
    const turn = await t.send(
      "Compare Engineering and Marketing spending growth over the last 12 months and tell me which department is at higher risk of going over budget next quarter.",
    );
    turn.expectOk();
    t.succeeded();

    const allowed = new Set(["Engineering", "Marketing"]);

    const trend = turn.requireToolCall("get_trend");
    t.check(
      trend.output as unknown as TrendPoint[],
      satisfies(
        (rows: TrendPoint[]) => rows.every((row) => allowed.has(row.department ?? "")),
        "trend rows only cover Engineering and Marketing",
      ),
    );

    const budget = turn.requireToolCall("get_budget_status");
    t.check(
      budget.output as unknown as BudgetRow[],
      satisfies(
        (rows: BudgetRow[]) => rows.every((row) => allowed.has(row.department)),
        "budget rows only cover Engineering and Marketing",
      ),
    );
  },
});
