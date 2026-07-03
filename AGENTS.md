# eve Agent App

This project uses the eve framework. Before writing code, read the relevant guide
from the installed eve package docs. In most installs, those docs are at
`node_modules/eve/docs/`. In workspaces or local package installs, resolve the
installed `eve` package location first and read its `docs/` directory. If
package docs are unavailable, use https://eve.dev/docs as a fallback.

## What this project is

Financial Analytics Agent — a senior-financial-analyst eve agent ("Northwind
Labs" analyst) that answers natural-language finance questions with real
charts rendered in a Next.js web chat, backed by seeded Postgres data. Full
design rationale lives in
`docs/superpowers/specs/2026-07-02-financial-analytics-agent-design.md`; the
original build plan (mostly executed) is in
`docs/superpowers/plans/2026-07-02-financial-analytics-agent.md`.

## Architecture

One Next.js app hosts three things at the same origin (no CORS, no base-URL
env vars):

1. **Web Chat UI** (`app/_components/agent-chat.tsx` + `agent-chat/*`) —
   `useEveAgent` (React) with a custom tool-result renderer
   (`app/_components/tool-result/*`) that turns tool JSON into Recharts
   charts.
2. **Finance REST API** (`app/api/finance/*`) — thin, documented, read-only
   route handlers over Postgres, one per analytic.
3. **The eve agent** (`agent/`) — mounted via `withEve()` in
   `next.config.ts`.

The analytics SQL lives once, in `agent/lib/finance.ts`. Both the REST routes
and the agent's authored tools (`agent/tools/*`) call into that shared lib
directly — the agent never crosses an HTTP boundary to reach its own data, so
it works standalone under `eve dev --no-ui` with no Next.js process running.

```
Browser (Web Chat + chart renderer)
   │  /eve/v1/*            (useEveAgent → eve channel)
   ▼
eve agent ── authored tools (agent/tools/*) ──┐
   │                                          ▼
   │                              agent/lib/finance.ts  ──►  Postgres (Neon)
   │                                          ▲
app/api/finance/* ────────────────────────────┘   (REST API shares the same lib)
```

## Data model

Postgres (Neon via Vercel Marketplace). Schema: `db/schema.sql`. Tables:

- `departments` — Sales, Marketing, Engineering, Operations, Finance (fixed
  set of 5; several places assume exactly 5 — see Gotchas below).
- `categories` — `kind` is `'revenue'` or `'expense'`. Revenue: Product
  Revenue, Services Revenue, Subscription Revenue. Expense: Payroll, SaaS,
  Advertising, Travel, Office, Cloud Infrastructure, Contractors, Recruiting.
- `transactions` — `date`, `amount` (numeric), `department_id`,
  `category_id`, `type` (`'income'` | `'expense'`), `description`.
- `budgets` — `department_id`, `month` (first-of-month date), `amount`. One
  row per department per month.

`db/seed.ts` generates ~3 years of deterministic synthetic data (fixed RNG
seed via `agent/lib/rng.ts`'s `mulberry32`, so reseeding reproduces the same
numbers exactly). It's not just noise — it's authored with specific stories
so every chart type has something real to show:

- Yearly seasonality + a slow multi-year growth trend on revenue.
- Subscription revenue compounding faster than the rest of the business, with
  a recurring ~yearly churn dip.
- Marketing Advertising spend spiking on a recurring campaign cadence.
- A Cloud Infrastructure step-change (platform migration) plus two
  autoscaling/data-transfer incident months, roughly a year apart.
- Two Contractors project ramps (bell-curve spend, not flat) at different
  points in the 3-year window.
- Two Recruiting hiring pushes a year apart.
- One-off Office (relocation) and Travel (conference) spikes, so anomalies
  aren't always in the same one or two departments/categories.

If you regenerate or extend the seed, run `pnpm db:migrate` then
`pnpm db:seed`, then `pnpm exec vitest run agent/lib/finance.test.ts` (needs
`DATABASE_URL` in `.env.local`) to confirm the shared lib still returns
sane numbers against the new data.

## Analytics lib and tools (kept 1:1)

`agent/lib/finance.ts` exports `getSummary`, `getTrend`,
`getCategoryBreakdown`, `getCashflow`, `getBudgetStatus`, `getAnomalies`,
`getHighlights`, and `getDataOverview`. Each of the first six has a matching
authored tool under `agent/tools/*` (`get_summary`, `get_trend`,
`get_category_breakdown`, `get_cashflow`, `get_budget_status`,
`get_anomalies`, plus `get_data_overview` for the last) that is a thin
`defineTool` + Zod wrapper returning the lib output verbatim, and a matching
REST route under `app/api/finance/*` built on the shared `parseQuery` helper
(`agent/lib/api-route.ts` — parses `?query` against a Zod schema, returns
either the typed data or a ready `400 Response`). `getHighlights` has no
agent tool — it only powers `app/api/finance/highlights` (consumed by
`useFinanceHighlights` in `app/_components/agent-chat/use-finance-highlights.ts`
to ground the suggested-question chips in real seeded data, no extra model
round-trip).

When adding a new analytic, touch: `finance.types.ts` (types), `finance.ts`
(query), `agent/tools/<name>.ts` (tool), `app/api/finance/<name-kebab>/route.ts`
(REST, via `parseQuery`), and a new file under `app/_components/tool-result/`
(chart) registered in `tool-result/index.tsx`'s `TOOL_NAMES` set and
`ToolResult` switch.

## Chart rendering

`app/_components/tool-result/` is one file per chart type
(`trend-chart.tsx`, `budget-chart.tsx`, `category-breakdown-chart.tsx`,
`cashflow-chart.tsx`, `anomaly-list.tsx`, `summary-tiles.tsx`), plus shared
primitives: `chart-tooltip.tsx` (the color-explicit, order-aware
`ChartTooltip`), `panel.tsx` (`Panel`, `ChartHeader`, `EmptyState`,
`LegendSwatch`, and `ChartPanel` — the compact/expand-to-dialog wrapper).
`index.tsx` is the only file anything outside this folder imports from
(`ToolResult`, `isFinanceTool`, `ToolResultSkeleton`). `app/_components/charts.ts`
holds the shared palette (CSS custom properties from `app/globals.css`,
dataviz-skill sourced) and formatters (`fmtMoney`, `fmtDate`, `fmtSigma`,
`monthRange`, etc.). Charts degrade gracefully for edge shapes — e.g. a
single-period `get_trend` result renders bars instead of a pointless one-dot
line; a single-period `get_category_breakdown` renders a donut instead of a
stacked area.

## Agent config

- `agent/instructions.md` — static analyst persona, tool-selection rules, and
  output-style rules (no markdown tables — the chart already shows the
  numbers). Deliberately has **no** literal dates in it.
- `agent/instructions/dates.ts` — a `defineDynamic` resolver (fires on
  `session.started`) that computes "today" from `new Date()` and the real
  data range from `getHighlights()` fresh every session, then appends that as
  a short instructions block. This is the fix for the obvious failure mode of
  a hardcoded "today is ..." string in `instructions.md`: that text is baked
  into the compiled manifest at build time and never changes again, so it
  goes stale the day after every deploy. Root `instructions.md` content is
  always prepended before sorted `agent/instructions/*` entries (eve
  convention), so this appends after the static rules. If you add more
  session-dependent facts, prefer extending this resolver over writing a
  literal into `instructions.md`.
- `agent/agent.ts` — model is Mistral (`devstral-latest`) via `@ai-sdk/mistral`
  direct, not the AI Gateway string form; `modelContextWindowTokens` is
  manually maintained because of that.
- `agent/channels/eve.ts` — HTTP channel auth is `[vercelOidc(), localDev(),
  none()]`, i.e. open with no auth required. Swap for a real auth provider
  before this handles non-synthetic financial data.

## Gotchas

- Several things hardcode "5 departments": `agent/lib/finance.test.ts`
  (`getBudgetStatus` row count) and any narrative in `agent/instructions.md`.
  Adding/removing a department needs a matching sweep.
- Suggested questions are split across two files that must stay in sync:
  `buildQuestions` + `QUESTION_TOPICS` in
  `app/_components/agent-chat/use-finance-highlights.ts`, and
  `QUESTION_INDEX_BY_TOOL` in `app/_components/agent-chat/session-helpers.ts`.
  All three are index-aligned — appending a question means appending to all
  three, in the same order.
- Money is Postgres `numeric`; `finance.ts`'s `num()` helper converts to JS
  `number` at the lib boundary. Never pass raw `numeric` strings/`Decimal` up
  to tools or charts.
- `.env.local` holds `DATABASE_URL` (and AI Gateway/Mistral credentials) and
  is gitignored (`.env*` in `.gitignore`) — never commit it.

## Package manager

This project uses **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml` at the
root) — not npm or yarn. Use `pnpm install`, `pnpm add`, `pnpm <script>`.

## Commands

- `pnpm dev` — Next.js dev server (drives eve via `withEve()`).
- `pnpm exec eve dev --no-ui` — headless agent-only verification, no Next.js.
- `pnpm db:migrate` / `pnpm db:seed` — apply schema / reseed.
- `pnpm typecheck` — `tsc`, no emit.
- `pnpm test` (`vitest run`) — unit + DB-gated integration tests.
