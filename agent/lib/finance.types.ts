export type Metric = "income" | "expense";
export type GroupBy = "month" | "department";

// The category-breakdown chart only draws this many categories by total,
// folding the rest into an "Other" band (see category-breakdown-chart.tsx) —
// shared here (a types-only module, safe to import from client components)
// so both the server-side tool and the client chart agree on the same cutoff
// without either recomputing or duplicating it.
export const CATEGORY_BREAKDOWN_TOP_N = 8;

export interface Summary { from: string; to: string; income: number; expense: number; net: number; }
export interface TrendPoint { period: string; department?: string; value: number; }
export interface BudgetRow { department: string; budget: number; actual: number; variance: number; pctUsed: number; }
export interface Anomaly {
  id: number; date: string; amount: number; department: string; category: string;
  description: string; categoryMean: number; categoryStdDev: number;
}

export interface CategorySlice { period: string; category: string; value: number; }
export interface CashflowPoint {
  period: string; income: number; expense: number; net: number; cumulativeNet: number;
}

export interface Highlights {
  dataFrom: string;
  dataTo: string;
  latestMonth: string;
  topAnomaly?: { department: string; category: string; amount: number; date: string };
  mostOverBudgetDept?: { department: string; overMonths: number };
  fastestGrowingCategory?: { category: string; multiple: number };
}

// Meta-stats about the dataset itself (row counts, coverage), as opposed to
// the financial figures inside it — answers "how much data do we have"
// questions distinctly from "what did we earn/spend" ones.
export interface DataOverview {
  dataFrom: string;
  dataTo: string;
  departments: number;
  categories: { total: number; revenue: number; expense: number };
  transactions: number;
  budgets: number;
}
