export function meanStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

export function flagOutliers<T>(rows: T[], value: (row: T) => number, threshold: number): T[] {
  if (rows.length === 0) return [];
  const { mean, stdDev } = meanStdDev(rows.map(value));
  if (stdDev === 0) return [];
  const limit = mean + threshold * stdDev;
  return rows.filter((r) => value(r) > limit);
}
