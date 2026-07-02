# Financial Analytics Agent — Design

**Date:** 2026-07-02
**Status:** Approved (design), pending implementation plan

## Purpose

A portfolio-grade agent that acts as a senior financial analyst for a fictional
company. Users ask natural-language questions about revenue, expenses, budgets,
and anomalies, and the agent answers with **real charts rendered in the web
chat**, not just text. Each answer pairs a visualization with a short
interpretation (trend, likely cause, recommendation).

The goal is a demo that a company looks at and thinks "this could point at our
real data tomorrow."

## Example interactions

- "How did marketing spend grow in Q2 vs Q1?" → bar/line chart + interpretation
- "Which department went over budget this month?" → budget-vs-actual chart
- "Show me the revenue trend for the last 6 months" → time-series line chart
- "Any unusual transactions this week?" → table/callout of anomalies

## Architecture (single Next.js project)

One Next.js app, deployed as one Vercel project, hosts three things:

1. **Web Chat UI** — `useEveAgent` (React) with a custom tool-result renderer
   that draws charts.
2. **Finance REST API** — `app/api/finance/*` route handlers over Postgres.
3. **The eve agent** — mounted via `withEve()` in `next.config.ts`, same origin
   (no CORS, no URL env vars).

The agent reaches the Finance API through an **eve OpenAPI connection**
(`agent/connections/finance-api.ts`), which auto-generates one tool per
operation. This showcases eve's OpenAPI connection feature and the "agent
consumes its own API" pattern.

```
Browser (Web Chat + chart renderer)
   │  /eve/v1/*            (useEveAgent → eve channel)
   ▼
eve agent  ──OpenAPI connection──►  /api/finance/*  ──►  Postgres (Neon)
   │                                     ▲
   └── instructions: behave as analyst   │ seeded with ~18 months synthetic data
```

## Data layer

Postgres (Neon via Vercel Marketplace). Tables:

- `departments` — `id`, `name` (Sales, Marketing, Engineering, Ops, Finance, ...)
- `categories` — `id`, `name`, `kind` ('expense' | 'revenue')
  (SaaS, Payroll, Travel, Ads, Product Revenue, Services Revenue, ...)
- `transactions` — `id`, `date`, `amount` (numeric), `department_id`,
  `category_id`, `type` ('income' | 'expense'), `description`
- `budgets` — `id`, `department_id`, `month` (date, first-of-month), `amount`

A seed script generates ~18 months of synthetic-but-realistic data:
- Monthly seasonality and a mild growth trend on revenue.
- Recurring expenses (payroll, SaaS) plus variable ones (ads, travel).
- A handful of deliberate outliers so anomaly detection has something to find.

Seeding is deterministic (fixed RNG seed) so the demo is reproducible.

## Finance REST API

Route handlers under `app/api/finance/`. All read-only (the demo does not mutate
finance data from chat, which keeps the surface safe and the demo predictable).

| Endpoint                | Query params                          | Returns |
| ----------------------- | ------------------------------------- | ------- |
| `GET /api/finance/summary`       | `from`, `to`                   | totals: income, expense, net, over range |
| `GET /api/finance/trend`         | `metric` (income\|expense), `groupBy` (month\|department), `from`, `to` | time-series rows `{ period, department?, value }` — feeds charts |
| `GET /api/finance/budget-status` | `month`                        | per-department `{ department, budget, actual, variance, pctUsed }` |
| `GET /api/finance/anomalies`     | `from`, `to`, `threshold?` (stddev, default 2.5) | outlier transactions with the category baseline they deviate from |

The API is documented by a **hand-authored OpenAPI 3.x spec** pinned in the repo
(`app/api/finance/openapi.ts` or a `.json`), used both as the contract for the
eve connection and as living documentation.

### Analytics logic

- **trend**: `SUM(amount)` grouped by month (`date_trunc`) and optionally
  department, filtered by `type`.
- **budget-status**: join `budgets` for the month against summed `transactions`
  expenses per department; `variance = actual - budget`,
  `pctUsed = actual / budget`.
- **anomalies**: per category, compute mean and stddev of expense amounts over
  the range; flag transactions whose amount exceeds `mean + threshold*stddev`.

## eve connection

`agent/connections/finance-api.ts` — `defineOpenAPIConnection`:
- `spec`: the pinned OpenAPI object/URL.
- `baseUrl`: same-origin `/api/finance` (resolved at runtime).
- No auth needed for the demo (public read-only API on the same deploy); if we
  later lock it down, add `auth.getToken` or route it behind app auth.

Generated tools: `finance-api__getSummary`, `finance-api__getTrend`,
`finance-api__getBudgetStatus`, `finance-api__getAnomalies`.

## Chart rendering in the web chat

The web chat renders `data.messages` parts from `useEveAgent`. Tool results
arrive as `dynamic-tool` parts carrying the tool name and JSON output.

A custom renderer inspects the tool name:
- `finance-api__getTrend` → line/bar chart (Recharts) of the series.
- `finance-api__getBudgetStatus` → grouped bar (budget vs actual) with an
  over-budget highlight.
- `finance-api__getAnomalies` → compact table/callout list.
- `finance-api__getSummary` → KPI stat tiles (income / expense / net).

Charts follow the `dataviz` design system (consistent palette, light/dark,
accessible) so the whole UI reads as one polished product. The agent's text
part renders normally alongside the chart, giving the interpretation.

## Agent behavior (`agent/instructions.md`)

- Act as a senior financial analyst for the fictional company.
- Always call the finance tools to get real numbers before answering; never
  fabricate figures.
- After a chart-producing tool call, add 1–2 sentences interpreting it
  (direction of the trend, likely driver, a recommendation when relevant).
- Pick the right tool for the question (trend vs budget vs anomalies vs summary).
- Be concise; the chart carries the detail.

## Model

**Mistral**, via the Vercel AI Gateway using the plain `provider/model` string
form: `mistral/mistral-large-latest` (capable at tool-calling and analytical
Q&A). Set in `agent/agent.ts` (`model: "mistral/mistral-large-latest"`),
replacing the scaffold's `anthropic/claude-sonnet-5`. Routing through the
gateway means no Mistral API key is managed by hand; the gateway credential
(`AI_GATEWAY_API_KEY` / Vercel OIDC) covers it. Easy to swap to
`mistral/mistral-small-latest` for lower cost if the analytical quality holds.

## Channels

- **HTTP** (`agent/channels/eve.ts`) — default, already scaffolded. For the
  public demo, relax auth to `none()` (or keep app auth) before deploy.
- **Web Chat** — added with `eve channels add web` + `withEve()` wiring; the
  primary surface because of the dashboards.
- **Slack** — added after first deploy via `eve channels add slack` (Vercel
  Connect handles the bot token and webhook verification). Slack answers are
  text summaries; interactive charts stay in Web Chat. Out of scope for the
  first implementation pass but the design leaves room for it.

## Deployment

Single Vercel project. Neon Postgres provisioned via Vercel Marketplace;
connection string arrives as an env var (`vercel env pull` for local dev). Seed
script run once against the provisioned database.

## Out of scope (YAGNI for first pass)

- Writing/mutating finance data from chat.
- Real external market data or bank integrations.
- Multi-company / multi-tenant data.
- Slack channel (designed for, implemented later).
- User authentication beyond the demo-appropriate default.

## Success criteria

1. `npm run typecheck` passes.
2. `eve dev --no-ui` starts; a session created over the HTTP API can ask
   "revenue trend for the last 6 months" and the agent calls
   `finance-api__getTrend` and returns a series.
3. In the Web Chat, that same question renders an actual line chart plus a
   one-line interpretation.
4. Budget and anomaly questions render their respective visualizations.
