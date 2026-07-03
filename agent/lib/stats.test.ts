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
    const rows = [
      { v: 10 }, { v: 11 }, { v: 9 }, { v: 10 }, { v: 11 },
      { v: 9 }, { v: 10 }, { v: 11 }, { v: 9 }, { v: 100 },
    ];
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
