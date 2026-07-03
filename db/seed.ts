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
