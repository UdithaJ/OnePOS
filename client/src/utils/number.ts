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
