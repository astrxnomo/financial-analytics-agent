# Financial Analytics Agent

A senior-financial-analyst AI agent for a fictional company (**Northwind Labs**) that answers
natural-language questions about revenue, budgets, and spending anomalies with **real charts
rendered inline** in a Next.js web chat — solving the "ask the spreadsheet a question" problem
without a BI dashboard or a data analyst in the loop.

**[Live demo →](https://financial-analytics-agent.vercel.app/)**

> Ask *"Which department went over budget this month, and by how much?"* or *"How has subscription
> revenue grown compared to the rest of the business?"* — the agent decides which tools to call,
> runs the SQL, draws an interactive chart, and adds a one-line read: trend → likely cause →
> recommendation.

---

## What it is

One Next.js app hosts three things at the same origin (no CORS, no base-URL env vars):

1. **Web Chat UI** — `useEveAgent` (React) with a custom tool-result renderer that turns tool JSON
   into Recharts charts.
2. **Finance REST API** — thin, documented, read-only route handlers over Postgres, one per analytic.
3. **The eve agent** — mounted via `withEve()` in `next.config.ts`.

The analytics SQL lives once, in `agent/lib/finance.ts`. Both the REST routes and the agent's
authored tools call into that shared lib directly — **the agent never crosses an HTTP boundary to
reach its own data**, so it works standalone under `eve dev --no-ui` with no Next.js process running.

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

## Features

- **Eight analytics, natural-language Q&A** — each backed by a typed tool and a documented REST
  route: revenue/expense trend (by month or department), budget vs. actual with variance, anomaly
  detection (category-relative std-dev outliers), category/spend-mix breakdown, cash flow with
  cumulative net, profitability by department (income vs. expense and net/margin per team), a
  plain-totals summary, and a dataset-overview endpoint for meta questions.
- **On-demand financial-analysis skill** — an eve skill (loaded only when a question needs it, not
  on every turn) teaches the model margin, MoM/YoY growth, CAGR, and budget-variance formulas — and
  explicitly refuses a runway estimate rather than fabricate one, since the schema has no
  cash-balance figure to support it.
- **Authored synthetic dataset, not random noise** — three years of deterministic Postgres data
  (fixed RNG seed, reproduces identically on every reseed) built around real stories: seasonality
  and growth on revenue, a compounding subscription line with a recurring churn dip, ad-campaign
  spend spikes, a platform-migration cost step-change plus two infrastructure incidents, contractor
  project ramps, hiring pushes, and one-off office/travel spikes — so every chart type has something
  genuine to show.
- **Data-grounded suggested questions** — the empty-state chips are built from a live
  `/api/finance/highlights` call (biggest anomaly, most-over-budget department, fastest-growing
  revenue category) computed with real SQL, so the first thing a visitor sees reflects the actual
  seeded data.
- **Behavior-level regression tests** — a `pnpm eval` suite (eve's `defineEval`) drives the live
  agent through real conversations and asserts on what it actually did, catching prompt/tool
  regressions a type-level test can't see.
- **Model choice validated by evals, not vibes** — four Mistral models were run against the same
  eval suite; the shipped model (`mistral-medium-2508`) is the only one that passed consistently
  and gave a materially better answer on open-ended reasoning.

## Technical highlights

- **Color-accurate, order-aware chart tooltips** — a custom Recharts tooltip pairs every value with
  the exact swatch color the chart draws it in, and orders rows by value (crossing lines) or by
  declared order (grouped bars/stacks) so the tooltip matches what's on screen.
- **Expand-to-near-fullscreen charts** — every chart renders twice (compact inline and at dialog
  scale, 96vw × 92vh) from the same pure, data-driven component — no duplicated chart logic.
- **Always-fresh agent context, never a hardcoded date** — a `defineDynamic` resolver fires on
  `session.started` and computes "today" plus the live data-coverage range every session, instead
  of a literal date baked into the compiled instructions at build time.
- **One shared analytics layer, two front doors** — `agent/lib/finance.ts` is called by both the
  agent tools and the REST routes (via a shared `parseQuery` Zod helper): natural language for
  people, plain HTTP for machines/scripts.

## Tech stack

| Layer | Choice |
| --- | --- |
| Agent framework | [eve](https://github.com/vercel/eve) (filesystem-first durable agent framework, by Vercel) |
| Model | Mistral `mistral-medium-2508` via `@ai-sdk/mistral` |
| Frontend | Next.js 16 App Router, React 19, `useEveAgent` |
| Database | Postgres (Neon via Vercel Marketplace), `postgres.js` |
| Charts | Recharts |
| UI | Tailwind CSS 4, shadcn/ui, Vercel AI Elements |
| Validation | Zod (every tool input and REST query param) |
| Deploy | Vercel |

## Project structure

```
agent/
├── agent.ts                     # Model config (Mistral mistral-medium-2508)
├── instructions.md              # Static persona + rules, no literal dates
├── instructions/dates.ts        # Dynamic "today" + data-range resolver
├── skills/financial-analysis/   # On-demand ratios/formulas skill
├── hooks/log-action-failures.ts # Logs any failed tool/skill call
├── lib/
│   ├── finance.ts               # Shared analytics queries
│   ├── finance.types.ts
│   ├── api-route.ts             # REST query-parsing helper
│   └── db.ts / stats.ts / rng.ts
└── tools/
    ├── get_summary.ts
    ├── get_trend.ts
    ├── get_budget_status.ts
    ├── get_anomalies.ts
    ├── get_category_breakdown.ts
    ├── get_cashflow.ts
    ├── get_profitability.ts
    └── get_data_overview.ts

app/
├── _components/
│   ├── agent-chat.tsx           # Chat orchestration
│   ├── agent-chat/              # Nav, empty-state, highlights hook
│   └── tool-result/             # One file per chart type
└── api/finance/*/route.ts       # REST endpoints, thin over the shared lib

evals/
├── evals.config.ts
└── *.eval.ts                    # Behavior-level regression tests (pnpm eval)

db/
├── schema.sql
├── migrate.ts
└── seed.ts                      # 3-year deterministic synthetic data
```

## Getting started

Uses **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml` at the root) — not npm or yarn.

### Prerequisites

- Node.js 24.x
- pnpm
- A Postgres database (Neon recommended) and Mistral / Vercel AI Gateway credentials

### Setup

```bash
pnpm install

# Create .env.local with your credentials (gitignored):
#   DATABASE_URL=postgres://...
#   (plus AI Gateway / Mistral credentials)

pnpm db:migrate   # apply db/schema.sql
pnpm db:seed      # generate 3 years of deterministic synthetic data

pnpm dev          # Next.js dev server (drives eve via withEve())
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js dev server (drives eve via `withEve()`) |
| `pnpm exec eve dev --no-ui` | Headless agent-only verification, no Next.js |
| `pnpm db:migrate` / `pnpm db:seed` | Apply schema / reseed |
| `pnpm typecheck` | `tsc`, no emit |
| `pnpm test` | Unit + DB-gated integration tests (Vitest) |
| `pnpm eval` | Behavior-level agent evals (`eve eval`) |

## License

Open source — see the repository for details.
