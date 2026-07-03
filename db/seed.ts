import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import postgres from "postgres";
import { mulberry32 } from "../agent/lib/rng.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.local).");
const sql = postgres(url, { max: 1 });

const rand = mulberry32(2026);
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
  { id: 8, name: "Subscription Revenue", kind: "revenue" },
  { id: 9, name: "Cloud Infrastructure", kind: "expense" },
  { id: 10, name: "Contractors", kind: "expense" },
  { id: 11, name: "Recruiting", kind: "expense" },
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

function pushExpense(
  m: number, dept: number, cat: number, amount: number, note?: string,
): void {
  const month = monthDate(m);
  const monthName = iso(month);
  const deptName = departments.find((d) => d.id === dept)!.name;
  txs.push({
    id: txId++,
    date: iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1 + Math.floor(rand() * 27)))),
    amount: Math.round(amount * 100) / 100,
    department_id: dept, category_id: cat, type: "expense",
    description: note ?? `${categories.find((c) => c.id === cat)!.name} — ${deptName} ${monthName}`,
  });
}

// Planned expense per department per month (excludes surprise multipliers
// like ad spikes and the cloud incident), accumulated while generating so
// budgets track what the department expected to spend — surprises then show
// up as genuine budget breaches.
const deptMonthPlanned = new Map<string, number>();
const addPlanned = (m: number, dept: number, amount: number) => {
  const key = `${dept}:${m}`;
  deptMonthPlanned.set(key, (deptMonthPlanned.get(key) ?? 0) + amount);
};

for (let m = 0; m < MONTHS; m++) {
  const month = monthDate(m);
  const monthName = iso(month);
  const seasonal = 1 + 0.15 * Math.sin((m / 12) * Math.PI * 2); // yearly wave
  const growth = 1 + m * 0.01; // slow upward trend

  // Revenue: Sales(1) and Services via Engineering(3)/Ops(4)
  const revenueBase = 220000 * seasonal * growth;
  // Subscriptions compound faster than the rest of the business and take a
  // visible churn hit partway through — a story get_trend can surface.
  const subscriptionBase = 42000 * 1.045 ** m * (m === 10 ? 0.72 : 1);
  const revSplits: Array<[number, number, number]> = [
    [1, 1, revenueBase * 0.6], // Sales, Product Revenue
    [1, 2, revenueBase * 0.25], // Sales, Services Revenue
    [3, 2, revenueBase * 0.15], // Engineering, Services Revenue
    [1, 8, subscriptionBase], // Sales, Subscription Revenue
  ];
  for (const [dept, cat, amt] of revSplits) {
    txs.push({
      id: txId++, date: iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 10))),
      amount: Math.round(jitter(amt, 0.08) * 100) / 100,
      department_id: dept, category_id: cat, type: "income",
      description: `${categories.find((c) => c.id === cat)!.name} — ${monthName}`,
    });
  }

  // Core expenses per department
  for (const dept of departments) {
    const base = deptExpenseBase[dept.id] * seasonal * growth;
    const cats = deptExpenseCats[dept.id];
    for (const cat of cats) {
      const share = cat === 3 ? 0.55 : 0.45 / (cats.length - 1); // payroll dominates
      const planned = jitter(base * share, 0.12);
      // Deliberate outliers: Marketing Advertising spikes twice.
      const spike = dept.id === 2 && cat === 5 && (m === 6 || m === 13) ? 3.2 : 1;
      pushExpense(m, dept.id, cat, planned * spike);
      addPlanned(m, dept.id, planned);
    }
  }

  // Cloud Infrastructure (Engineering): step change after a platform
  // migration at month 9, plus one incident month with runaway autoscaling.
  {
    const step = m >= 9 ? 1.6 : 1;
    const incident = m === 15 ? 2.4 : 1;
    const planned = jitter(16000 * growth * step, 0.1);
    pushExpense(
      m, 3, 9, planned * incident,
      m === 15
        ? `Cloud Infrastructure — Engineering ${monthName} (autoscaling incident)`
        : undefined,
    );
    addPlanned(m, 3, planned);
  }

  // Contractors (Engineering + Operations): a project ramp that rises,
  // peaks around month 7, and winds down — a bell curve, not a line.
  {
    const bell = Math.exp(-((m - 7) ** 2) / 8);
    const engAmount = jitter(4000 + 26000 * bell, 0.15);
    const opsAmount = jitter(2500 + 12000 * bell, 0.15);
    pushExpense(m, 3, 10, engAmount);
    addPlanned(m, 3, engAmount);
    pushExpense(m, 4, 10, opsAmount);
    addPlanned(m, 4, opsAmount);
  }

  // Recruiting (Sales + Engineering): sporadic by nature, with a visible
  // hiring push in months 12-14.
  for (const dept of [1, 3]) {
    const push = m >= 12 && m <= 14;
    if (!push && rand() > 0.45) continue;
    const amount = jitter(push ? 9000 : 3500, 0.35);
    pushExpense(m, dept, 11, amount);
    addPlanned(m, dept, amount);
  }

  // Budget = planned spend with a jittered cushion, so surprises (ad spikes,
  // the cloud incident) breach it and ordinary months mostly land under.
  for (const dept of departments) {
    const planned = deptMonthPlanned.get(`${dept.id}:${m}`) ?? 0;
    // Engineering runs structurally tight (the recurring over-budget story);
    // everyone else gets a healthier cushion.
    const cushion = dept.id === 3 ? jitter(1.0, 0.05) : jitter(1.06, 0.05);
    budgets.push({
      id: budgetId++, department_id: dept.id, month: monthName,
      amount: Math.round(planned * cushion * 100) / 100,
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
