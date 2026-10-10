// Adding decimals in binary floating point leaves noise in the last digits
// (2.3 + 5.14 = 7.4399999999999995), which `plain`-formatted totals and Excel
// cells would print as is. Totals are rounded to 6 decimal places, which
// removes the noise without capping precision: weights are entered with any
// number of decimals, so rounding to 2 would change real values.
//
// Mirrored in client/src/utils/number.ts — keep the two in step.
function stripFloatNoise(value) {
  return Math.round(value * 1e6) / 1e6;
}

module.exports = { stripFloatNoise };
