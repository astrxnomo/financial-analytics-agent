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
