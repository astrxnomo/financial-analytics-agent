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

  const byCat = new Map<string, (typeof rows)[number][]>();
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
