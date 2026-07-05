import { describe, it, expect } from "vitest";
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { getSummary, getTrend, getBudgetStatus, getAnomalies, getCategoryBreakdown, getProfitability } from "./finance.js";

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

  it("budget status filters to the requested departments", async () => {
    const b = await getBudgetStatus({ month: "2026-01-01", departments: ["Engineering", "Marketing"] });
    expect(b.length).toBe(2);
    expect(new Set(b.map((r) => r.department))).toEqual(new Set(["Engineering", "Marketing"]));
  });

  it("trend filters to the requested departments", async () => {
    const t = await getTrend({
      metric: "expense", groupBy: "department", departments: ["Engineering", "Marketing"], ...RANGE,
    });
    expect(t.length).toBeGreaterThan(0);
    expect(new Set(t.map((r) => r.department))).toEqual(new Set(["Engineering", "Marketing"]));
  });

  it("category breakdown filters to a single named category", async () => {
    const c = await getCategoryBreakdown({ ...RANGE, category: "Cloud Infrastructure" });
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((r) => r.category === "Cloud Infrastructure")).toBe(true);
  });

  it("profitability returns income/expense/net per department, sorted by net desc", async () => {
    const p = await getProfitability(RANGE);
    expect(p.length).toBe(5);
    for (const r of p) expect(r.net).toBeCloseTo(r.income - r.expense, 2);
    const nets = p.map((r) => r.net);
    expect([...nets].sort((a, b) => b - a)).toEqual(nets);
    // Sales books revenue (a net contributor); a pure cost center has null margin.
    const sales = p.find((r) => r.department === "Sales");
    expect(sales?.income).toBeGreaterThan(0);
    expect(sales?.margin).not.toBeNull();
    const finance = p.find((r) => r.department === "Finance");
    expect(finance?.income).toBe(0);
    expect(finance?.margin).toBeNull();
  });

  it("profitability filters to the requested departments", async () => {
    const p = await getProfitability({ ...RANGE, departments: ["Sales", "Engineering"] });
    expect(p.length).toBe(2);
    expect(new Set(p.map((r) => r.department))).toEqual(new Set(["Sales", "Engineering"]));
  });

  it("finds the seeded advertising outliers", async () => {
    const a = await getAnomalies(RANGE);
    expect(a.length).toBeGreaterThan(0);
    expect(a.some((x) => x.category === "Advertising")).toBe(true);
  });

  it("anomalies filters the returned list to requested categories", async () => {
    const all = await getAnomalies(RANGE);
    const filtered = await getAnomalies({ ...RANGE, categories: ["Travel", "Office"] });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((a) => a.category === "Travel" || a.category === "Office")).toBe(true);
    expect(filtered.length).toBeLessThan(all.length);
    // Baseline stats must match the unfiltered run, proving the mean/stddev
    // is computed from the full dataset and not recomputed on the narrowed set.
    const unfilteredMatch = all.find((a) => a.id === filtered[0].id);
    expect(unfilteredMatch?.categoryMean).toBe(filtered[0].categoryMean);
  });
});
