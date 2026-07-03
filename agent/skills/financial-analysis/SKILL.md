---
description: Use when a question asks for a financial ratio, rate, or derived metric that isn't a raw tool output — margin, burn rate, runway, MoM/YoY growth rate, CAGR, budget variance percent, or how "unusual" an anomaly's deviation actually is.
---

# Financial analysis: ratios and derived metrics

The finance tools (`get_summary`, `get_trend`, `get_budget_status`,
`get_anomalies`, `get_category_breakdown`, `get_cashflow`) return raw totals.
When a question asks for a ratio or rate built from those totals, compute it
yourself from the tool's numbers — call the tool first, then apply the
formula below. Never invent a ratio without a tool result behind it.

## Margins

- **Net margin** = `net / income` (from `get_summary` or `get_cashflow`).
  Express as a percentage. Negative net margin means the period ran at a
  loss.
- There is no cost-of-goods-sold or gross-margin split in this dataset (only
  `income` vs `expense` at the top level) — don't present net margin as
  "gross margin"; they aren't the same thing and this data can't distinguish
  COGS from operating expense.

## Growth rates

- **Month-over-month (MoM)** = `(this period − previous period) / previous
  period`, using consecutive points from a `get_trend` series.
- **Year-over-year (YoY)** = same formula, comparing the same calendar month
  a year apart in the series.
- **CAGR** (compound annual growth rate, for multi-year spans) =
  `(end / start) ^ (1 / years) − 1`. Use this instead of a simple
  start-to-end percentage when the span is more than ~18 months — a raw
  percentage over 3 years overstates how fast something grew per year.
- State the formula's inputs in plain language when you give a rate (e.g.
  "from $X in [month] to $Y in [month]"), not just the resulting percentage —
  the number alone isn't verifiable by the reader.

## Budget variance

- `get_budget_status` already returns `variance` (`actual − budget`) and
  `pctUsed` (`actual / budget`) per department — don't recompute these,
  just phrase them: "X% of budget used" or "$Y over/under budget."
  `pctUsed − 1` is the variance as a percentage of budget.

## Burn rate and runway

- **Burn rate** = the period's `net` from `get_summary`/`get_cashflow` when
  it's negative, expressed as a monthly figure (divide a multi-month range's
  net by the number of months).
- **Runway** (months of cash left at the current burn rate) requires a
  starting cash balance, which this dataset does not have — there is no
  `cash_on_hand` figure anywhere in the schema. If asked for runway, say
  plainly that it isn't computable without a cash balance, and offer the
  burn rate instead rather than fabricating a runway estimate.

## Period-over-period comparisons

Don't compute a delta here — see instructions.md rule 5 ("No prose deltas for
period comparisons"). Testing showed that computing `later − earlier` and
naming a direction is exactly where the model silently gets it backwards
(asserting a figure "decreased" for a period where it actually increased),
even when explicitly told to check the subtraction's sign first. State both
raw tool-sourced numbers in order instead and let the reader compare them.

## Anomaly severity

- `get_anomalies` returns `categoryMean` and `categoryStdDev` alongside each
  flagged `amount`. The deviation in standard deviations is
  `(amount − categoryMean) / categoryStdDev` — the UI already labels this as
  "Nσ" per row. When asked how unusual a specific anomaly is, frame it in
  those terms: roughly, 2σ is a notable but not extreme outlier, 3σ+ is rare
  under normal variation. Don't claim a precise probability — the underlying
  distribution of real expense data isn't verified to be normal, so a
  literal p-value would overstate precision this data can't support.
