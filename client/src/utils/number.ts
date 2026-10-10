// Adding decimals in binary floating point leaves noise in the last digits
// (2.3 + 5.14 = 7.4399999999999995), which would be printed as is. Totals are
// rounded to 6 decimal places, which removes the noise without capping
// precision: weights are entered with any number of decimals, so rounding to 2
// would change real values.
//
// Mirrored in main/reports/engine/number.js — keep the two in step.
export function stripFloatNoise(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

// Amounts and weights as the printed bill and the reports show them:
// 1,950.00 and 2.30. Pinned to en-US so a till's system locale can't turn
// 1,950.00 into 1.950,00.
export function formatAmount(value: unknown): string {
  return (Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatWeight(value: unknown): string {
  return (Number(value) || 0).toFixed(2)
}
