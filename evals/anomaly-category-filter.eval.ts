import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";
import type { Anomaly } from "#lib/finance.types.js";

// Regression test for a real bug: asking for anomalies in specific
// categories used to return all 15 anomalies company-wide (every category,
// every department) instead of just the requested ones. get_anomalies now
// accepts `categories`/`departments` filters that narrow the returned list
// while still computing the mean/stddev baseline from the full dataset (see
// agent/lib/finance.ts's getAnomalies and the test next to it).
export default defineEval({
  description: "Asking for anomalies in specific categories only returns those categories.",
  async test(t) {
    const turn = await t.send(
      "Show me only the unusual spending anomalies in Travel and Office over the last 3 years.",
    );
    turn.expectOk();
    t.succeeded();

    const call = turn.requireToolCall("get_anomalies");
    const rows = call.output as unknown as Anomaly[];
    t.check(
      rows.length > 0,
      satisfies((v: boolean) => v === true, "at least one anomaly returned"),
    );
    t.check(
      rows,
      satisfies(
        (list: Anomaly[]) => list.every((row) => row.category === "Travel" || row.category === "Office"),
        "every returned anomaly is in Travel or Office",
      ),
    );
  },
});
