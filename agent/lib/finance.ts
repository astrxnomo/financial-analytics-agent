import { db } from "./db";
import { meanStdDev } from "./stats";
import type {
  Summary, TrendPoint, BudgetRow, Anomaly, Metric, GroupBy, Highlights,
  CategorySlice, CashflowPoint, DataOverview,
} from "./finance.types";
export { CATEGORY_BREAKDOWN_TOP_N } from "./finance.types";

const num = (v: unknown) => Number(v);
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const addMonths = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return day(d);
};

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
  metric: Metric; groupBy: GroupBy; from: string; to: string; departments?: string[];
}): Promise<TrendPoint[]> {
  const sql = db();
  const deptFilter = input.departments?.length ? sql`AND d.name IN ${sql(input.departments)}` : sql``;
  if (input.groupBy === "department") {
    const rows = await sql<{ period: Date; department: string; value: string }[]>`
      SELECT date_trunc('month', t.date)::date AS period, d.name AS department,
             COALESCE(SUM(t.amount), 0) AS value
      FROM transactions t JOIN departments d ON d.id = t.department_id
      WHERE t.type = ${input.metric} AND t.date >= ${input.from} AND t.date <= ${input.to}
        ${deptFilter}
      GROUP BY period, d.name
      ORDER BY period, d.name`;
    return rows.map((r) => ({ period: day(r.period), department: r.department, value: num(r.value) }));
  }
  const rows = await sql<{ period: Date; value: string }[]>`
    SELECT date_trunc('month', t.date)::date AS period, COALESCE(SUM(t.amount), 0) AS value
    FROM transactions t
    JOIN departments d ON d.id = t.department_id
    WHERE t.type = ${input.metric} AND t.date >= ${input.from} AND t.date <= ${input.to}
      ${deptFilter}
    GROUP BY period
    ORDER BY period`;
  return rows.map((r) => ({ period: day(r.period), value: num(r.value) }));
}

export async function getCategoryBreakdown(input: {
  from: string; to: string; metric?: Metric; department?: string; category?: string;
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
      AND (${input.category ?? null}::text IS NULL OR c.name = ${input.category ?? null})
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

export async function getBudgetStatus(input: { month: string; departments?: string[] }): Promise<BudgetRow[]> {
  const sql = db();
  const deptFilter = input.departments?.length ? sql`AND d.name IN ${sql(input.departments)}` : sql``;
  const rows = await sql<{ department: string; budget: string; actual: string }[]>`
    SELECT d.name AS department,
           COALESCE(b.amount, 0) AS budget,
           COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS actual
    FROM departments d
    LEFT JOIN budgets b ON b.department_id = d.id AND b.month = date_trunc('month', ${input.month}::date)
    LEFT JOIN transactions t ON t.department_id = d.id
         AND date_trunc('month', t.date) = date_trunc('month', ${input.month}::date)
    WHERE true ${deptFilter}
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
  from: string; to: string; threshold?: number; departments?: string[]; categories?: string[];
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
  // Statistical baseline (mean/stddev per category) is always computed from
  // the full unfiltered dataset above, then narrowed here — filtering the
  // source rows first would shrink the sample and change what counts as
  // "unusual" depending on which departments/categories happen to be asked
  // about, rather than just narrowing which already-computed outliers to show.
  const deptSet = input.departments?.length ? new Set(input.departments) : null;
  const catSet = input.categories?.length ? new Set(input.categories) : null;
  const filtered = out.filter(
    (a) => (!deptSet || deptSet.has(a.department)) && (!catSet || catSet.has(a.category)),
  );
  return filtered.sort((a, b) => b.amount - a.amount);
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

  // Compare each revenue category's first 6 months of activity against its
  // last 6 months, rather than a straight first-vs-last-year total — the
  // seeded range doesn't start/end on year boundaries, so whole-year totals
  // would compare uneven partial years. Whichever category compounded the
  // most is the one worth pointing a "how has X grown" suggestion at.
  const growthWindowStart = addMonths(dataFrom, 6);
  const growthWindowEnd = addMonths(dataTo, -6);
  const growthRows = await sql<{ category: string; first_total: string; last_total: string }[]>`
    SELECT c.name AS category,
           COALESCE(SUM(t.amount) FILTER (WHERE t.date < ${growthWindowStart}), 0) AS first_total,
           COALESCE(SUM(t.amount) FILTER (WHERE t.date >= ${growthWindowEnd}), 0) AS last_total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE c.kind = 'revenue'
    GROUP BY c.name`;
  let fastestGrowingCategory: Highlights["fastestGrowingCategory"];
  for (const r of growthRows) {
    const first = num(r.first_total);
    const last = num(r.last_total);
    if (first <= 0) continue;
    const multiple = last / first;
    if (!fastestGrowingCategory || multiple > fastestGrowingCategory.multiple) {
      fastestGrowingCategory = { category: r.category, multiple };
    }
  }

  return {
    dataFrom,
    dataTo,
    fastestGrowingCategory,
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

export async function getDataOverview(): Promise<DataOverview> {
  const sql = db();

  const [range] = await sql<{ from: Date; to: Date }[]>`
    SELECT MIN(date) AS from, MAX(date) AS to FROM transactions`;
  if (!range) throw new Error("No seeded finance data found.");

  const [counts] = await sql<
    { departments: string; categories: string; revenue_categories: string; transactions: string; budgets: string }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM departments) AS departments,
      (SELECT COUNT(*) FROM categories) AS categories,
      (SELECT COUNT(*) FROM categories WHERE kind = 'revenue') AS revenue_categories,
      (SELECT COUNT(*) FROM transactions) AS transactions,
      (SELECT COUNT(*) FROM budgets) AS budgets`;
  if (!counts) throw new Error("No seeded finance data found.");

  const totalCategories = num(counts.categories);
  const revenueCategories = num(counts.revenue_categories);

  return {
    budgets: num(counts.budgets),
    categories: {
      expense: totalCategories - revenueCategories,
      revenue: revenueCategories,
      total: totalCategories,
    },
    dataFrom: day(range.from),
    dataTo: day(range.to),
    departments: num(counts.departments),
    transactions: num(counts.transactions),
  };
}
