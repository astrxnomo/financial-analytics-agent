# Financial Analytics Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a portfolio-grade eve agent that answers natural-language questions about a fictional company's finances (revenue, expenses, budgets, anomalies) and renders real charts in a Next.js web chat.

**Architecture:** One repo. Analytics SQL lives once in `agent/lib/finance.ts`. Authored eve tools (`agent/tools/*`) call that lib directly (no cross-service HTTP), so the agent works standalone under `eve dev --no-ui`. A Next.js app (added via `withEve()`) hosts the web chat plus a thin `/api/finance/*` REST API that reuses the same lib. A custom tool-result renderer draws Recharts charts from tool outputs.

**Tech Stack:** eve (framework), Mistral via Vercel AI Gateway, Postgres (Neon via Vercel Marketplace), `postgres` (postgres.js) client, Zod, Next.js (App Router) + React, Recharts, Vitest, tsx.

## Global Constraints

- Node `24.x`; ESM (`"type": "module"`); `#*` import alias maps to `./agent/*` (from `package.json`).
- Agent model: `mistral/mistral-large-latest` (plain AI Gateway `provider/model` string).
- Tool filenames are snake_case ASCII; the filename is the model-facing tool name.
- All finance data access is **read-only**. No mutation tools, no approval gates.
- Money stored as Postgres `numeric`; always convert to JS `number` at the lib boundary (never return raw strings/`Decimal` to the model or charts).
- Dates: `transactions.date` is `date`; `budgets.month` is the first-of-month `date`.
- Seed is deterministic (fixed RNG seed) so the demo reproduces exactly.
- Postgres connection string read from `process.env.DATABASE_URL`.
- Charts follow the `dataviz` skill's palette/accessibility rules (load that skill before writing any chart code).

---

## Phase 1 — Agent core (data + tools), verifiable via `eve dev --no-ui`

### Task 1: Dependencies, Postgres provisioning, and schema

**Files:**
- Modify: `package.json` (add deps + scripts)
- Create: `db/schema.sql`
- Create: `db/migrate.ts`
- Create: `.env.local` (gitignored; holds `DATABASE_URL`)

**Interfaces:**
- Produces: a reachable Postgres database with tables `departments`, `categories`, `transactions`, `budgets`; `process.env.DATABASE_URL` set for local dev.

- [ ] **Step 1: Install runtime and dev dependencies**

Run:
```bash
npm install postgres
npm install -D tsx vitest dotenv
```
Expected: installs succeed; `postgres`, `tsx`, `vitest`, `dotenv` appear in `package.json`.

- [ ] **Step 2: Provision Postgres (Neon via Vercel Marketplace)**

Use the `vercel:marketplace` skill (or the Vercel dashboard) to add a **Neon** Postgres integration to the project, then pull env vars:
```bash
vercel link          # if not linked yet
vercel env pull .env.local
```
Neon exposes a pooled connection string. Ensure `.env.local` contains a `DATABASE_URL` line pointing at the **pooled** connection (copy from the Neon-provided var, e.g. `POSTGRES_URL`/`DATABASE_URL`, if the name differs add `DATABASE_URL=...`).

If you prefer a local Postgres for development instead, set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/finance` and run a local server; the rest of the plan is identical.

Expected: `.env.local` has a working `DATABASE_URL`.

- [ ] **Step 3: Confirm `.env.local` is gitignored**

Read `.gitignore`. If `.env.local` (or `.env*`) is not already ignored, add a line:
```
.env.local
```
Expected: `git status` does not list `.env.local`.

- [ ] **Step 4: Write the schema**

Create `db/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS departments (
  id   integer PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
  id   integer PRIMARY KEY,
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('expense', 'revenue'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id            integer PRIMARY KEY,
  date          date NOT NULL,
  amount        numeric(12, 2) NOT NULL,
  department_id integer NOT NULL REFERENCES departments(id),
  category_id   integer NOT NULL REFERENCES categories(id),
  type          text NOT NULL CHECK (type IN ('income', 'expense')),
  description   text NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  id            integer PRIMARY KEY,
  department_id integer NOT NULL REFERENCES departments(id),
  month         date NOT NULL,
  amount        numeric(12, 2) NOT NULL,
  UNIQUE (department_id, month)
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_dept ON transactions(department_id);
CREATE INDEX IF NOT EXISTS idx_tx_cat  ON transactions(category_id);
```

- [ ] **Step 5: Write the migration runner**

Create `db/migrate.ts`:
```ts
import "dotenv/config";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.local).");

const sql = postgres(url, { max: 1 });

const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
await sql.unsafe(schema);
console.log("Schema applied.");
await sql.end();
```

- [ ] **Step 6: Add scripts to `package.json`**

Add to the `"scripts"` block:
```json
"db:migrate": "tsx db/migrate.ts",
"db:seed": "tsx db/seed.ts",
"test": "vitest run"
```

- [ ] **Step 7: Run the migration**

Run:
```bash
npm run db:migrate
```
Expected: prints `Schema applied.` with no error.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json db/schema.sql db/migrate.ts .gitignore
git commit -m "feat: add postgres deps and finance schema"
```

---

### Task 2: Seed data (deterministic synthetic finances)

**Files:**
- Create: `agent/lib/rng.ts`
- Create: `agent/lib/rng.test.ts`
- Create: `db/seed.ts`

**Interfaces:**
- Produces: `mulberry32(seed: number): () => number` — deterministic RNG in `[0,1)`.
- Produces: a seeded database — ~18 months of `transactions`, `budgets` for every department/month, with a few deliberate expense outliers.

- [ ] **Step 1: Write the failing RNG test**

Create `agent/lib/rng.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng.js";

describe("mulberry32", () => {
  it("is deterministic for a fixed seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });

  it("returns values in [0, 1)", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run agent/lib/rng.test.ts`
Expected: FAIL — cannot resolve `./rng.js`.

- [ ] **Step 3: Implement the RNG**

Create `agent/lib/rng.ts`:
```ts
// Small deterministic PRNG (mulberry32). Same seed → same sequence.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run agent/lib/rng.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the seed script**

Create `db/seed.ts`:
```ts
import "dotenv/config";
import postgres from "postgres";
import { mulberry32 } from "../agent/lib/rng.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.local).");
const sql = postgres(url, { max: 1 });

const rand = mulberry32(2026);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const jitter = (base: number, pct: number) => base * (1 + (rand() * 2 - 1) * pct);

const departments = [
  { id: 1, name: "Sales" },
  { id: 2, name: "Marketing" },
  { id: 3, name: "Engineering" },
  { id: 4, name: "Operations" },
  { id: 5, name: "Finance" },
];

const categories = [
  { id: 1, name: "Product Revenue", kind: "revenue" },
  { id: 2, name: "Services Revenue", kind: "revenue" },
  { id: 3, name: "Payroll", kind: "expense" },
  { id: 4, name: "SaaS", kind: "expense" },
  { id: 5, name: "Advertising", kind: "expense" },
  { id: 6, name: "Travel", kind: "expense" },
  { id: 7, name: "Office", kind: "expense" },
] as const;

// Monthly baseline expense per department (before jitter/seasonality).
const deptExpenseBase: Record<number, number> = { 1: 60000, 2: 45000, 3: 90000, 4: 30000, 5: 25000 };
// Which expense categories each department spends on.
const deptExpenseCats: Record<number, number[]> = {
  1: [3, 4, 6, 7],
  2: [3, 4, 5, 6],
  3: [3, 4, 7],
  4: [3, 4, 7],
  5: [3, 4, 7],
};

const MONTHS = 18;
const now = new Date(Date.UTC(2026, 5, 1)); // June 2026 as the latest full-ish month
const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

function monthDate(offset: number): Date {
  return new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + offset, 1));
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type TxRow = {
  id: number; date: string; amount: number; department_id: number;
  category_id: number; type: "income" | "expense"; description: string;
};
type BudgetRow = { id: number; department_id: number; month: string; amount: number };

const txs: TxRow[] = [];
const budgets: BudgetRow[] = [];
let txId = 1;
let budgetId = 1;

for (let m = 0; m < MONTHS; m++) {
  const month = monthDate(m);
  const monthName = iso(month);
  const seasonal = 1 + 0.15 * Math.sin((m / 12) * Math.PI * 2); // yearly wave
  const growth = 1 + m * 0.01; // slow upward trend

  // Revenue: Sales(1) and Services via Engineering(3)/Ops(4)
  const revenueBase = 220000 * seasonal * growth;
  const revSplits: Array<[number, number, number]> = [
    [1, 1, revenueBase * 0.6], // Sales, Product Revenue
    [1, 2, revenueBase * 0.25], // Sales, Services Revenue
    [3, 2, revenueBase * 0.15], // Engineering, Services Revenue
  ];
  for (const [dept, cat, amt] of revSplits) {
    txs.push({
      id: txId++, date: iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 10))),
      amount: Math.round(jitter(amt, 0.08) * 100) / 100,
      department_id: dept, category_id: cat, type: "income",
      description: `${categories.find((c) => c.id === cat)!.name} — ${monthName}`,
    });
  }

  // Expenses per department
  for (const dept of departments) {
    const base = deptExpenseBase[dept.id] * seasonal * growth;
    const cats = deptExpenseCats[dept.id];
    for (const cat of cats) {
      const share = cat === 3 ? 0.55 : 0.45 / (cats.length - 1); // payroll dominates
      let amount = jitter(base * share, 0.12);
      // Deliberate outliers: Marketing Advertising spikes twice.
      if (dept.id === 2 && cat === 5 && (m === 6 || m === 13)) amount *= 3.2;
      txs.push({
        id: txId++, date: iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1 + Math.floor(rand() * 27)))),
        amount: Math.round(amount * 100) / 100,
        department_id: dept.id, category_id: cat, type: "expense",
        description: `${categories.find((c) => c.id === cat)!.name} — ${dept.name} ${monthName}`,
      });
    }
    // Budget = ~ expected monthly expense with a small cushion.
    budgets.push({
      id: budgetId++, department_id: dept.id, month: monthName,
      amount: Math.round(deptExpenseBase[dept.id] * seasonal * growth * 1.05 * 100) / 100,
    });
  }
}

await sql.begin(async (tx) => {
  await tx`TRUNCATE transactions, budgets, categories, departments RESTART IDENTITY CASCADE`;
  await tx`INSERT INTO departments ${tx(departments, "id", "name")}`;
  await tx`INSERT INTO categories ${tx(categories as any, "id", "name", "kind")}`;
  for (let i = 0; i < txs.length; i += 500) {
    await tx`INSERT INTO transactions ${tx(txs.slice(i, i + 500), "id", "date", "amount", "department_id", "category_id", "type", "description")}`;
  }
  await tx`INSERT INTO budgets ${tx(budgets, "id", "department_id", "month", "amount")}`;
});

console.log(`Seeded ${departments.length} departments, ${categories.length} categories, ${txs.length} transactions, ${budgets.length} budgets.`);
await sql.end();
```

- [ ] **Step 6: Run the seed**

Run:
```bash
npm run db:seed
```
Expected: prints a `Seeded ... transactions ...` line (roughly 300–400 transactions), no error.

- [ ] **Step 7: Spot-check the data**

Run:
```bash
npx tsx -e "import 'dotenv/config'; import postgres from 'postgres'; const sql=postgres(process.env.DATABASE_URL,{max:1}); console.log(await sql\`SELECT type, count(*), round(sum(amount)) FROM transactions GROUP BY type\`); await sql.end();"
```
Expected: two rows (income, expense) with plausible totals.

- [ ] **Step 8: Commit**

```bash
git add agent/lib/rng.ts agent/lib/rng.test.ts db/seed.ts package.json
git commit -m "feat: deterministic synthetic finance seed"
```

---

### Task 3: Anomaly math (pure, TDD)

**Files:**
- Create: `agent/lib/stats.ts`
- Create: `agent/lib/stats.test.ts`

**Interfaces:**
- Produces: `meanStdDev(values: number[]): { mean: number; stdDev: number }`
- Produces: `flagOutliers<T>(rows: T[], value: (row: T) => number, threshold: number): T[]` — returns rows whose value exceeds `mean + threshold*stdDev` (population stddev). Empty input → empty output.

- [ ] **Step 1: Write the failing test**

Create `agent/lib/stats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { meanStdDev, flagOutliers } from "./stats.js";

describe("meanStdDev", () => {
  it("computes population mean and stddev", () => {
    const { mean, stdDev } = meanStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(mean).toBe(5);
    expect(stdDev).toBeCloseTo(2, 5);
  });
  it("handles empty input", () => {
    expect(meanStdDev([])).toEqual({ mean: 0, stdDev: 0 });
  });
});

describe("flagOutliers", () => {
  it("flags values beyond mean + threshold*stddev", () => {
    const rows = [{ v: 10 }, { v: 11 }, { v: 9 }, { v: 10 }, { v: 100 }];
    const out = flagOutliers(rows, (r) => r.v, 2);
    expect(out).toEqual([{ v: 100 }]);
  });
  it("returns nothing when all values are similar", () => {
    const rows = [{ v: 10 }, { v: 11 }, { v: 9 }];
    expect(flagOutliers(rows, (r) => r.v, 2.5)).toEqual([]);
  });
  it("handles empty input", () => {
    expect(flagOutliers([], (r: { v: number }) => r.v, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run agent/lib/stats.test.ts`
Expected: FAIL — cannot resolve `./stats.js`.

- [ ] **Step 3: Implement the stats helpers**

Create `agent/lib/stats.ts`:
```ts
export function meanStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

export function flagOutliers<T>(rows: T[], value: (row: T) => number, threshold: number): T[] {
  if (rows.length === 0) return [];
  const { mean, stdDev } = meanStdDev(rows.map(value));
  if (stdDev === 0) return [];
  const limit = mean + threshold * stdDev;
  return rows.filter((r) => value(r) > limit);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run agent/lib/stats.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add agent/lib/stats.ts agent/lib/stats.test.ts
git commit -m "feat: anomaly-detection stats helpers"
```

---

### Task 4: Shared analytics lib (DB queries)

**Files:**
- Create: `agent/lib/db.ts`
- Create: `agent/lib/finance.ts`
- Create: `agent/lib/finance.types.ts`
- Create: `agent/lib/finance.test.ts` (integration; gated on `DATABASE_URL`)

**Interfaces:**
- Consumes: `flagOutliers` (Task 3), the seeded DB (Task 2).
- Produces (all `async`, all money as JS `number`):
  - `getSummary(input: { from: string; to: string }): Promise<Summary>` where `Summary = { from: string; to: string; income: number; expense: number; net: number }`
  - `getTrend(input: { metric: "income" | "expense"; groupBy: "month" | "department"; from: string; to: string }): Promise<TrendPoint[]>` where `TrendPoint = { period: string; department?: string; value: number }`
  - `getBudgetStatus(input: { month: string }): Promise<BudgetRow[]>` where `BudgetRow = { department: string; budget: number; actual: number; variance: number; pctUsed: number }`
  - `getAnomalies(input: { from: string; to: string; threshold?: number }): Promise<Anomaly[]>` where `Anomaly = { id: number; date: string; amount: number; department: string; category: string; description: string; categoryMean: number; categoryStdDev: number }`

- [ ] **Step 1: Write the shared postgres client**

Create `agent/lib/db.ts`:
```ts
import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set.");
    client = postgres(url);
  }
  return client;
}
```

- [ ] **Step 2: Write the shared types**

Create `agent/lib/finance.types.ts`:
```ts
export type Metric = "income" | "expense";
export type GroupBy = "month" | "department";

export interface Summary { from: string; to: string; income: number; expense: number; net: number; }
export interface TrendPoint { period: string; department?: string; value: number; }
export interface BudgetRow { department: string; budget: number; actual: number; variance: number; pctUsed: number; }
export interface Anomaly {
  id: number; date: string; amount: number; department: string; category: string;
  description: string; categoryMean: number; categoryStdDev: number;
}
```

- [ ] **Step 3: Implement the analytics functions**

Create `agent/lib/finance.ts`:
```ts
import { db } from "./db.js";
import { meanStdDev } from "./stats.js";
import type { Summary, TrendPoint, BudgetRow, Anomaly, Metric, GroupBy } from "./finance.types.js";

const num = (v: unknown) => Number(v);
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));

export async function getSummary(input: { from: string; to: string }): Promise<Summary> {
  const sql = db();
  const rows = await sql<{ type: string; total: string }[]>`
    SELECT type, COALESCE(SUM(amount), 0) AS total
    FROM transactions
    WHERE date >= ${input.from} AND date <= ${input.to}
    GROUP BY type`;
  const income = num(rows.find((r) => r.type === "income")?.total ?? 0);
  const expense = num(rows.find((r) => r.type === "expense")?.total ?? 0);
  return { from: input.from, to: input.to, income, expense, net: income - expense };
}

export async function getTrend(input: {
  metric: Metric; groupBy: GroupBy; from: string; to: string;
}): Promise<TrendPoint[]> {
  const sql = db();
  if (input.groupBy === "department") {
    const rows = await sql<{ period: Date; department: string; value: string }[]>`
      SELECT date_trunc('month', t.date)::date AS period, d.name AS department,
             COALESCE(SUM(t.amount), 0) AS value
      FROM transactions t JOIN departments d ON d.id = t.department_id
      WHERE t.type = ${input.metric} AND t.date >= ${input.from} AND t.date <= ${input.to}
      GROUP BY period, d.name
      ORDER BY period, d.name`;
    return rows.map((r) => ({ period: day(r.period), department: r.department, value: num(r.value) }));
  }
  const rows = await sql<{ period: Date; value: string }[]>`
    SELECT date_trunc('month', date)::date AS period, COALESCE(SUM(amount), 0) AS value
    FROM transactions
    WHERE type = ${input.metric} AND date >= ${input.from} AND date <= ${input.to}
    GROUP BY period
    ORDER BY period`;
  return rows.map((r) => ({ period: day(r.period), value: num(r.value) }));
}

export async function getBudgetStatus(input: { month: string }): Promise<BudgetRow[]> {
  const sql = db();
  const rows = await sql<{ department: string; budget: string; actual: string }[]>`
    SELECT d.name AS department,
           COALESCE(b.amount, 0) AS budget,
           COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS actual
    FROM departments d
    LEFT JOIN budgets b ON b.department_id = d.id AND b.month = date_trunc('month', ${input.month}::date)
    LEFT JOIN transactions t ON t.department_id = d.id
         AND date_trunc('month', t.date) = date_trunc('month', ${input.month}::date)
    GROUP BY d.name, b.amount
    ORDER BY d.name`;
  return rows.map((r) => {
    const budget = num(r.budget);
    const actual = num(r.actual);
    return {
      department: r.department, budget, actual,
      variance: actual - budget,
      pctUsed: budget === 0 ? 0 : actual / budget,
    };
  });
}

export async function getAnomalies(input: {
  from: string; to: string; threshold?: number;
}): Promise<Anomaly[]> {
  const sql = db();
  const threshold = input.threshold ?? 2.5;
  const rows = await sql<{
    id: number; date: Date; amount: string; department: string; category: string; description: string;
  }[]>`
    SELECT t.id, t.date, t.amount, d.name AS department, c.name AS category, t.description
    FROM transactions t
    JOIN departments d ON d.id = t.department_id
    JOIN categories c ON c.id = t.category_id
    WHERE t.type = 'expense' AND t.date >= ${input.from} AND t.date <= ${input.to}`;

  const byCat = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byCat.get(r.category) ?? [];
    list.push(r);
    byCat.set(r.category, list);
  }

  const out: Anomaly[] = [];
  for (const [category, list] of byCat) {
    const { mean, stdDev } = meanStdDev(list.map((r) => num(r.amount)));
    if (stdDev === 0) continue;
    const limit = mean + threshold * stdDev;
    for (const r of list) {
      if (num(r.amount) > limit) {
        out.push({
          id: r.id, date: day(r.date), amount: num(r.amount), department: r.department,
          category, description: r.description, categoryMean: mean, categoryStdDev: stdDev,
        });
      }
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}
```

- [ ] **Step 4: Write the integration test**

Create `agent/lib/finance.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import "dotenv/config";
import { getSummary, getTrend, getBudgetStatus, getAnomalies } from "./finance.js";

const RANGE = { from: "2025-01-01", to: "2026-12-31" };
const run = process.env.DATABASE_URL ? describe : describe.skip;

run("finance lib (integration, needs seeded DATABASE_URL)", () => {
  it("summary returns positive numeric income and expense", async () => {
    const s = await getSummary(RANGE);
    expect(typeof s.income).toBe("number");
    expect(s.income).toBeGreaterThan(0);
    expect(s.expense).toBeGreaterThan(0);
    expect(s.net).toBeCloseTo(s.income - s.expense, 2);
  });

  it("monthly income trend is ordered and numeric", async () => {
    const t = await getTrend({ metric: "income", groupBy: "month", ...RANGE });
    expect(t.length).toBeGreaterThan(6);
    expect(typeof t[0].value).toBe("number");
    const periods = t.map((p) => p.period);
    expect([...periods].sort()).toEqual(periods);
  });

  it("budget status has one row per department with pctUsed", async () => {
    const b = await getBudgetStatus({ month: "2026-01-01" });
    expect(b.length).toBe(5);
    expect(typeof b[0].pctUsed).toBe("number");
  });

  it("finds the seeded advertising outliers", async () => {
    const a = await getAnomalies(RANGE);
    expect(a.length).toBeGreaterThan(0);
    expect(a.some((x) => x.category === "Advertising")).toBe(true);
  });
});
```

- [ ] **Step 5: Run the integration test**

Run: `npx vitest run agent/lib/finance.test.ts`
Expected: PASS (4 tests). If `DATABASE_URL` is unset the suite is skipped — set it and re-run.

- [ ] **Step 6: Commit**

```bash
git add agent/lib/db.ts agent/lib/finance.ts agent/lib/finance.types.ts agent/lib/finance.test.ts
git commit -m "feat: shared finance analytics lib"
```

---

### Task 5: Agent tools

**Files:**
- Create: `agent/tools/get_summary.ts`
- Create: `agent/tools/get_trend.ts`
- Create: `agent/tools/get_budget_status.ts`
- Create: `agent/tools/get_anomalies.ts`

**Interfaces:**
- Consumes: `getSummary`, `getTrend`, `getBudgetStatus`, `getAnomalies` (Task 4).
- Produces: model-facing tools `get_summary`, `get_trend`, `get_budget_status`, `get_anomalies`. Each returns the lib output verbatim (JSON) so the web renderer can chart it.

- [ ] **Step 1: Write `get_summary`**

Create `agent/tools/get_summary.ts`:
```ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getSummary } from "#lib/finance.js";

export default defineTool({
  description:
    "Total income, expense, and net for a date range (inclusive). Dates are YYYY-MM-DD.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getSummary(input);
  },
});
```

- [ ] **Step 2: Write `get_trend`**

Create `agent/tools/get_trend.ts`:
```ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getTrend } from "#lib/finance.js";

export default defineTool({
  description:
    "Monthly time series of income or expense, optionally split by department. Use for 'trend', 'over time', 'growth', 'by department' questions.",
  inputSchema: z.object({
    metric: z.enum(["income", "expense"]),
    groupBy: z.enum(["month", "department"]).default("month"),
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getTrend(input);
  },
});
```

- [ ] **Step 3: Write `get_budget_status`**

Create `agent/tools/get_budget_status.ts`:
```ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getBudgetStatus } from "#lib/finance.js";

export default defineTool({
  description:
    "Per-department budget vs actual expense for one month, with variance and pctUsed. Use for 'over budget', 'budget status' questions. Pass any date in the target month (YYYY-MM-DD).",
  inputSchema: z.object({
    month: z.string().describe("Any date in the target month, YYYY-MM-DD"),
  }),
  async execute(input) {
    return await getBudgetStatus(input);
  },
});
```

- [ ] **Step 4: Write `get_anomalies`**

Create `agent/tools/get_anomalies.ts`:
```ts
import { defineTool } from "eve/tools";
import { z } from "zod";
import { getAnomalies } from "#lib/finance.js";

export default defineTool({
  description:
    "Unusual expense transactions in a date range: those exceeding mean + threshold*stddev within their category. Use for 'unusual', 'anomaly', 'outlier', 'suspicious' questions.",
  inputSchema: z.object({
    from: z.string().describe("Start date, YYYY-MM-DD"),
    to: z.string().describe("End date, YYYY-MM-DD"),
    threshold: z.number().min(1).max(6).default(2.5).describe("Std-dev multiplier"),
  }),
  async execute(input) {
    return await getAnomalies(input);
  },
});
```

- [ ] **Step 5: Verify the `#lib` import alias resolves**

The `package.json` `imports` map has `"#*": "./agent/*"`, so `#lib/finance.js` → `./agent/lib/finance.js`. Confirm the map is present (it is in the scaffold). Run:
```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add agent/tools/get_summary.ts agent/tools/get_trend.ts agent/tools/get_budget_status.ts agent/tools/get_anomalies.ts
git commit -m "feat: finance analytics tools"
```

---

### Task 6: Instructions and Mistral model

**Files:**
- Modify: `agent/instructions.md`
- Modify: `agent/agent.ts`

**Interfaces:**
- Consumes: the four tools (Task 5).
- Produces: analyst behavior; model set to Mistral.

- [ ] **Step 1: Replace the instructions**

Overwrite `agent/instructions.md`:
```md
# Identity

You are a senior financial analyst for Northwind Labs, a fictional company.
You answer questions about the company's finances using the data tools, and you
never invent numbers.

# Tools

- `get_summary` — totals (income/expense/net) for a date range.
- `get_trend` — monthly series of income or expense, optionally by department.
- `get_budget_status` — budget vs actual per department for a month.
- `get_anomalies` — unusual expense transactions in a range.

# How to answer

- Always call a tool to get real figures before answering. Never guess.
- Pick the tool that fits: trends/growth → `get_trend`; over/under budget →
  `get_budget_status`; unusual spend → `get_anomalies`; totals → `get_summary`.
- Today is 2026-07-02. When the user gives a relative range ("last 6 months",
  "Q2", "this year"), convert it to explicit YYYY-MM-DD dates for the tool.
- After a tool returns, give a short interpretation (1–2 sentences): the
  direction of the trend, the likely driver, and a recommendation when relevant.
- Be concise. The chart carries the detail; your text adds the insight.
- You are an automated AI assistant working on fictional demo data.
```

- [ ] **Step 2: Set the Mistral model**

Overwrite `agent/agent.ts`:
```ts
import { defineAgent } from "eve";

export default defineAgent({
  model: "mistral/mistral-large-latest",
});
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add agent/instructions.md agent/agent.ts
git commit -m "feat: analyst instructions and Mistral model"
```

---

### Task 7: End-to-end agent verification (HTTP, no UI)

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything in Phase 1. Requires seeded `DATABASE_URL` and a Vercel AI Gateway credential (`AI_GATEWAY_API_KEY` in `.env.local`, or `vercel env pull`).

- [ ] **Step 1: Confirm the gateway credential is available**

Ensure `.env.local` has `AI_GATEWAY_API_KEY` (from `vercel env pull`, or the AI Gateway dashboard). Without it, Mistral calls fail.

- [ ] **Step 2: Start eve headless in the background**

Run (background process): `npm exec -- eve dev --no-ui`
Wait for the line printing the server URL (default `http://127.0.0.1:2000`).

- [ ] **Step 3: Ask a trend question over the HTTP API**

Run:
```bash
curl -s -D - -X POST http://127.0.0.1:2000/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"Show me the revenue trend for the last 6 months."}'
```
Capture the `x-eve-session-id` response header.

- [ ] **Step 4: Stream the session and confirm the tool call**

Run (replace `<id>`):
```bash
curl -s http://127.0.0.1:2000/eve/v1/session/<id>/stream
```
Expected NDJSON contains an `actions.requested` event calling `get_trend`, an `action.result` with a non-empty series, and a `message.completed` with an interpretation sentence.

- [ ] **Step 5: Ask a budget and an anomaly question**

Repeat Steps 3–4 with:
- `"Which department went over budget in January 2026?"` → expect `get_budget_status`.
- `"Any unusual expenses in the last year?"` → expect `get_anomalies` returning the seeded advertising spikes.

- [ ] **Step 6: Stop the background eve process**

Terminate the background `eve dev` process.

- [ ] **Step 7: Phase 1 checkpoint commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore: phase 1 verification tweaks" || echo "nothing to commit"
```

---

## Phase 2 — Web chat with charts

### Task 8: Next.js app + `withEve` wiring

**Files:**
- Modify: `package.json` (Next/React deps + `dev`/`build` scripts)
- Create: `next.config.ts`
- Create: `tsconfig.json` changes or `next-env.d.ts` (as Next requires)
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx` (placeholder for now)

**Interfaces:**
- Produces: a Next.js app that boots the eve agent same-origin via `withEve()`.

- [ ] **Step 1: Install Next.js, React, Recharts**

Run:
```bash
npm install next react react-dom recharts
npm install -D @types/react @types/react-dom
```

- [ ] **Step 2: Wrap the Next config with `withEve`**

Create `next.config.ts`:
```ts
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

export default withEve(nextConfig);
```

- [ ] **Step 3: Point the eve HTTP channel at a public demo policy**

Overwrite `agent/channels/eve.ts` (demo is public; swap for real auth before using non-demo data):
```ts
import { eveChannel } from "eve/channels/eve";
import { localDev, none, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev(), none()],
});
```

- [ ] **Step 4: Add the root layout**

Create `app/layout.tsx`:
```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Northwind Labs — Financial Analyst" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Add global CSS**

Create `app/globals.css`:
```css
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: Canvas; color: CanvasText; }
```

- [ ] **Step 6: Add a placeholder page**

Create `app/page.tsx`:
```tsx
export default function Page() {
  return <main style={{ padding: 24 }}>Financial Analyst — chat coming next.</main>;
}
```

- [ ] **Step 7: Update `package.json` scripts**

Set the `dev`, `build`, `start` scripts (Next drives eve via `withEve`):
```json
"dev": "next dev",
"build": "next build",
"start": "next start"
```
Keep `"typecheck": "tsc"`. (The eve CLI is still available via `npm exec -- eve ...` for headless checks.)

- [ ] **Step 8: Run the dev server and load the page**

Run (background): `npm run dev`
Open `http://localhost:3000`. Expected: the placeholder text renders and the terminal shows the eve dev server booting alongside Next. Stop the server after confirming.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json next.config.ts agent/channels/eve.ts app/layout.tsx app/globals.css app/page.tsx
git commit -m "feat: next.js app wired to eve via withEve"
```

---

### Task 9: Finance REST API routes (portfolio surface)

**Files:**
- Create: `app/api/finance/summary/route.ts`
- Create: `app/api/finance/trend/route.ts`
- Create: `app/api/finance/budget-status/route.ts`
- Create: `app/api/finance/anomalies/route.ts`

**Interfaces:**
- Consumes: the shared lib (Task 4).
- Produces: `GET` JSON endpoints reusing the lib. Thin wrappers: validate params with Zod, call the lib, return `Response.json`.

- [ ] **Step 1: Summary route**

Create `app/api/finance/summary/route.ts`:
```ts
import { z } from "zod";
import { getSummary } from "#lib/finance.js";

const Q = z.object({ from: z.string(), to: z.string() });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getSummary(parsed.data));
}
```

- [ ] **Step 2: Trend route**

Create `app/api/finance/trend/route.ts`:
```ts
import { z } from "zod";
import { getTrend } from "#lib/finance.js";

const Q = z.object({
  metric: z.enum(["income", "expense"]),
  groupBy: z.enum(["month", "department"]).default("month"),
  from: z.string(),
  to: z.string(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getTrend(parsed.data));
}
```

- [ ] **Step 3: Budget-status route**

Create `app/api/finance/budget-status/route.ts`:
```ts
import { z } from "zod";
import { getBudgetStatus } from "#lib/finance.js";

const Q = z.object({ month: z.string() });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getBudgetStatus(parsed.data));
}
```

- [ ] **Step 4: Anomalies route**

Create `app/api/finance/anomalies/route.ts`:
```ts
import { z } from "zod";
import { getAnomalies } from "#lib/finance.js";

const Q = z.object({
  from: z.string(),
  to: z.string(),
  threshold: z.coerce.number().min(1).max(6).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = Q.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  return Response.json(await getAnomalies(parsed.data));
}
```

- [ ] **Step 5: Verify one endpoint**

Run (background): `npm run dev`, then:
```bash
curl -s "http://localhost:3000/api/finance/trend?metric=income&groupBy=month&from=2025-01-01&to=2026-12-31"
```
Expected: a JSON array of `{ period, value }`. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add app/api/finance
git commit -m "feat: finance REST API routes over shared lib"
```

---

### Task 10: Web chat UI (`useEveAgent`)

**Files:**
- Create: `app/chat/Chat.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: the eve HTTP routes (same-origin via `withEve`).
- Produces: a chat that renders text parts and delegates tool-result parts to `ToolResult` (Task 11).

- [ ] **Step 1: Write the chat component**

Create `app/chat/Chat.tsx`:
```tsx
"use client";

import { useEveAgent } from "eve/react";
import { ToolResult } from "./ToolResult";

export function Chat() {
  const agent = useEveAgent();
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20 }}>Northwind Labs — Financial Analyst</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "16px 0" }}>
        {agent.data.messages.map((message) => (
          <article key={message.id}>
            <header style={{ fontSize: 12, opacity: 0.6 }}>{message.role}</header>
            {message.parts.map((part, i) => {
              if (part.type === "text") return <p key={i}>{part.text}</p>;
              if (part.type === "dynamic-tool" && part.output !== undefined) {
                return <ToolResult key={i} name={part.toolName} output={part.output} />;
              }
              return null;
            })}
          </article>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const message = String(form.get("message") ?? "").trim();
          if (message) {
            void agent.send({ message });
            e.currentTarget.reset();
          }
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          name="message"
          placeholder="e.g. Revenue trend for the last 6 months"
          disabled={isBusy}
          style={{ flex: 1, padding: "8px 12px" }}
        />
        <button disabled={isBusy} type="submit">Send</button>
      </form>
    </div>
  );
}
```

Note: the exact part shape for a tool result comes from eve's `EveMessagePart` (AI SDK `UIMessage` convention). If `part.toolName`/`part.output` field names differ in the installed version, read `node_modules/eve/docs/guides/frontend/overview.mdx` and the exported `EveMessagePart` type, and adjust the guard. The renderer only needs the tool name and its JSON output.

- [ ] **Step 2: Render the chat on the home page**

Overwrite `app/page.tsx`:
```tsx
import { Chat } from "./chat/Chat";

export default function Page() {
  return <Chat />;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (ToolResult is created in Task 11 — do Task 11 Step 1 first if the import fails, or stub it).

- [ ] **Step 4: Commit**

```bash
git add app/chat/Chat.tsx app/page.tsx
git commit -m "feat: web chat with useEveAgent"
```

---

### Task 11: Chart renderer for tool results

**Files:**
- Create: `app/chat/charts.ts` (palette from the `dataviz` skill)
- Create: `app/chat/ToolResult.tsx`

**Interfaces:**
- Consumes: tool outputs shaped by `agent/lib/finance.types.ts` (`TrendPoint[]`, `BudgetRow[]`, `Anomaly[]`, `Summary`).
- Produces: `ToolResult({ name, output })` that switches on the tool name and renders the matching Recharts visualization.

**BEFORE THIS TASK:** load the `dataviz` skill and copy its validated palette into `app/chat/charts.ts`. Do not invent colors.

- [ ] **Step 1: Create the palette module**

Create `app/chat/charts.ts` using the `dataviz` skill's `references/palette.md` values (categorical series colors, plus an "alert" color for over-budget/anomaly highlights). Example shape (replace hex values with the skill's palette):
```ts
// Colors sourced from the dataviz skill palette (references/palette.md).
export const SERIES = ["#4f6cff", "#12a594", "#e5484d", "#f5a623", "#8b5cf6"];
export const ALERT = "#e5484d";
export const GRID = "color-mix(in oklab, CanvasText 12%, transparent)";
export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
```

- [ ] **Step 2: Write the ToolResult renderer**

Create `app/chat/ToolResult.tsx`:
```tsx
"use client";

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { SERIES, ALERT, GRID, fmtMoney } from "./charts";
import type { TrendPoint, BudgetRow, Anomaly, Summary } from "#lib/finance.types.js";

export function ToolResult({ name, output }: { name: string; output: unknown }) {
  if (name === "get_summary") return <SummaryTiles s={output as Summary} />;
  if (name === "get_trend") return <TrendChart points={output as TrendPoint[]} />;
  if (name === "get_budget_status") return <BudgetChart rows={output as BudgetRow[]} />;
  if (name === "get_anomalies") return <AnomalyList rows={output as Anomaly[]} />;
  return null;
}

function SummaryTiles({ s }: { s: Summary }) {
  const tiles = [
    { label: "Income", value: s.income },
    { label: "Expense", value: s.expense },
    { label: "Net", value: s.net },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "8px 0" }}>
      {tiles.map((t) => (
        <div key={t.label} style={{ border: `1px solid ${GRID}`, borderRadius: 8, padding: "12px 16px", minWidth: 140 }}>
          <div style={{ fontSize: 12, opacity: 0.6 }}>{t.label}</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{fmtMoney(t.value)}</div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const byDept = points.some((p) => p.department);
  if (!byDept) {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={72} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => fmtMoney(Number(v))} />
          <Line type="monotone" dataKey="value" stroke={SERIES[0]} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  // Pivot to one line per department.
  const depts = [...new Set(points.map((p) => p.department!))];
  const periods = [...new Set(points.map((p) => p.period))];
  const data = periods.map((period) => {
    const row: Record<string, number | string> = { period };
    for (const d of depts) row[d] = points.find((p) => p.period === period && p.department === d)?.value ?? 0;
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={72} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => fmtMoney(Number(v))} />
        <Legend />
        {depts.map((d, i) => (
          <Line key={d} type="monotone" dataKey={d} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function BudgetChart({ rows }: { rows: BudgetRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis dataKey="department" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={(v) => fmtMoney(Number(v))} width={72} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(v) => fmtMoney(Number(v))} />
        <Legend />
        <Bar dataKey="budget" fill={SERIES[0]} />
        <Bar dataKey="actual">
          {rows.map((r, i) => (
            <Cell key={i} fill={r.actual > r.budget ? ALERT : SERIES[1]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AnomalyList({ rows }: { rows: Anomaly[] }) {
  if (rows.length === 0) return <p style={{ opacity: 0.7 }}>No anomalies found.</p>;
  return (
    <div style={{ overflowX: "auto", margin: "8px 0" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
        <thead>
          <tr>
            {["Date", "Department", "Category", "Amount", "Category avg"].map((h) => (
              <th key={h} style={{ textAlign: "left", borderBottom: `1px solid ${GRID}`, padding: "6px 10px" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: "6px 10px" }}>{r.date}</td>
              <td style={{ padding: "6px 10px" }}>{r.department}</td>
              <td style={{ padding: "6px 10px" }}>{r.category}</td>
              <td style={{ padding: "6px 10px", color: ALERT, fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
              <td style={{ padding: "6px 10px", opacity: 0.7 }}>{fmtMoney(r.categoryMean)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/chat/charts.ts app/chat/ToolResult.tsx
git commit -m "feat: recharts renderer for finance tool results"
```

---

### Task 12: End-to-end web verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run (background): `npm run dev`. Wait for both Next and the eve dev server to report ready.

- [ ] **Step 2: Drive the chat in a browser**

Load `http://localhost:3000`. Ask, one at a time:
1. "Show me the revenue trend for the last 6 months." → a line chart + interpretation.
2. "Which departments are over budget in January 2026?" → grouped bar with over-budget bars in the alert color.
3. "Any unusual expenses in the last year?" → anomaly table listing the seeded advertising spikes.
4. "What were total income and expenses in 2026?" → summary tiles.

Use the `claude-in-chrome` or `chrome-devtools` tools to load the page, type each prompt, and screenshot the rendered charts. Confirm each renders a real chart (not raw JSON) with a short analyst interpretation above/below it.

- [ ] **Step 3: Fix any rendering mismatch**

If a tool-result part does not render, inspect the actual `part` shape via the browser console or `agent.events`, and adjust the `dynamic-tool` guard in `Chat.tsx` and/or the `output` access in `ToolResult.tsx` to match the installed eve version's `EveMessagePart`.

- [ ] **Step 4: Stop the server and final commit**

```bash
git add -A
git commit -m "chore: phase 2 verification" || echo "nothing to commit"
```

---

## Self-Review Notes

- **Spec coverage:** data layer (Tasks 1–2), analytics lib incl. trend/budget/anomaly logic (Tasks 3–4), authored tools (Task 5), Mistral model + analyst instructions (Task 6), agent HTTP verification (Task 7), Next.js + withEve (Task 8), REST API surface (Task 9), web chat (Task 10), chart rendering per tool with dataviz palette (Task 11), end-to-end web check (Task 12). Slack and auth-hardening are explicitly out of scope in the spec and deferred.
- **Types:** tool names (`get_summary`/`get_trend`/`get_budget_status`/`get_anomalies`) and lib return types (`Summary`/`TrendPoint`/`BudgetRow`/`Anomaly`) are consistent across lib, tools, REST routes, and the renderer.
- **Known version risk:** the exact `EveMessagePart` field names for a tool-result part (`toolName`, `output`, `type: "dynamic-tool"`) may differ in the installed eve version; Tasks 10–12 include explicit steps to confirm and adjust against `node_modules/eve/docs` and the exported types.
