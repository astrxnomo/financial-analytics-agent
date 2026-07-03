import { db } from "./db";
import { meanStdDev } from "./stats";
import type {
  Summary, TrendPoint, BudgetRow, Anomaly, Metric, GroupBy, Highlights,
  CategorySlice, CashflowPoint,
} from "./finance.types";

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

export async function getCategoryBreakdown(input: {
  from: string; to: string; metric?: Metric; department?: string;
}): Promise<CategorySlice[]> {
  const sql = db();
  const metric = input.metric ?? "expense";
  const rows = await sql<{ period: Date; category: string; value: string }[]>`
    SELECT date_trunc('month', t.date)::date AS period, c.name AS category,
           COALESCE(SUM(t.amount), 0) AS value
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    JOIN departments d ON d.id = t.department_id
    WHERE t.type = ${metric} AND t.date >= ${input.from} AND t.date <= ${input.to}
      AND (${input.department ?? null}::text IS NULL OR d.name = ${input.department ?? null})
    GROUP BY period, c.name
    ORDER BY period, c.name`;
  return rows.map((r) => ({ period: day(r.period), category: r.category, value: num(r.value) }));
}

export async function getCashflow(input: { from: string; to: string }): Promise<CashflowPoint[]> {
  const sql = db();
  const rows = await sql<{ period: Date; income: string; expense: string }[]>`
    SELECT date_trunc('month', date)::date AS period,
           COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
           COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense
    FROM transactions
    WHERE date >= ${input.from} AND date <= ${input.to}
    GROUP BY period
    ORDER BY period`;
  let running = 0;
  return rows.map((r) => {
    const income = num(r.income);
    const expense = num(r.expense);
    const net = income - expense;
    running += net;
    return { period: day(r.period), income, expense, net, cumulativeNet: running };
  });
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

export async function getHighlights(): Promise<Highlights> {
  const sql = db();

  const [range] = await sql<{ from: Date; to: Date }[]>`
    SELECT MIN(date) AS from, MAX(date) AS to FROM transactions`;
  const [latest] = await sql<{ month: Date }[]>`SELECT MAX(month) AS month FROM budgets`;
  if (!range || !latest) {
    throw new Error("No seeded finance data found.");
  }
  const dataFrom = day(range.from);
  const dataTo = day(range.to);
  const latestMonth = day(latest.month);

  // Payroll scales with headcount, so comparing it across departments of very
  // different sizes trips the category-wide threshold on routine growth, not
  // genuine one-off spend. Excluded here so the highlighted anomaly is one
  // that's actually interesting to surface, not just "the big department".
  const [topAnomaly] = (await getAnomalies({ from: dataFrom, to: dataTo })).filter(
    (a) => a.category !== "Payroll",
  );

  const [overBudget] = await sql<{ department: string; over_months: string }[]>`
    SELECT d.name AS department, COUNT(*) AS over_months
    FROM departments d
    JOIN budgets b ON b.department_id = d.id
    JOIN (
      SELECT department_id, date_trunc('month', date) AS month, SUM(amount) AS actual
      FROM transactions
      WHERE type = 'expense'
      GROUP BY department_id, month
    ) t ON t.department_id = d.id AND t.month = b.month
    WHERE t.actual > b.amount
    GROUP BY d.name
    ORDER BY over_months DESC
    LIMIT 1`;

  return {
    dataFrom,
    dataTo,
    latestMonth,
    mostOverBudgetDept: overBudget
      ? { department: overBudget.department, overMonths: num(overBudget.over_months) }
      : undefined,
    topAnomaly: topAnomaly
      ? {
          amount: topAnomaly.amount,
          category: topAnomaly.category,
          date: topAnomaly.date,
          department: topAnomaly.department,
        }
      : undefined,
  };
}
