export type Metric = "income" | "expense";
export type GroupBy = "month" | "department";

export interface Summary { from: string; to: string; income: number; expense: number; net: number; }
export interface TrendPoint { period: string; department?: string; value: number; }
export interface BudgetRow { department: string; budget: number; actual: number; variance: number; pctUsed: number; }
export interface Anomaly {
  id: number; date: string; amount: number; department: string; category: string;
  description: string; categoryMean: number; categoryStdDev: number;
}

export interface Highlights {
  dataFrom: string;
  dataTo: string;
  latestMonth: string;
  topAnomaly?: { department: string; category: string; amount: number; date: string };
  mostOverBudgetDept?: { department: string; overMonths: number };
}
